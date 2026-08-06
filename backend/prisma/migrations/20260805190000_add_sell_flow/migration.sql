-- Sell flow (USDT -> XAF). See CLAUDE.md "Sell flow" for the design.

-- CreateEnum
CREATE TYPE "OrderDirection" AS ENUM ('BUY', 'SELL');

-- AlterEnum: new intermediate statuses, parallel to the buy-side ones,
-- sharing the existing terminal states (COMPLETED/EXPIRED/REFUND_DUE/REFUNDED).
ALTER TYPE "OrderStatus" ADD VALUE 'AWAITING_DEPOSIT';
ALTER TYPE "OrderStatus" ADD VALUE 'DEPOSIT_CLAIMED';
ALTER TYPE "OrderStatus" ADD VALUE 'DEPOSIT_VERIFIED';

-- RenameColumn: payoutTxHash -> payoutReference. Buy stores a real on-chain
-- hash here; sell stores a MoMo payout confirmation code, which is not a
-- tx hash at all, so the old name would be actively wrong for sell orders.
-- RENAME preserves the 2 existing non-null values (a plain drop+add, which
-- `prisma migrate dev` would have generated automatically, would have lost
-- them).
ALTER TABLE "Order" RENAME COLUMN "payoutTxHash" TO "payoutReference";
ALTER INDEX "Order_payoutTxHash_key" RENAME TO "Order_payoutReference_key";

-- AlterTable: new sell-flow columns on Order.
ALTER TABLE "Order"
  ADD COLUMN "direction" "OrderDirection" NOT NULL DEFAULT 'BUY',
  ADD COLUMN "customerMomoNetwork" "MomoNetwork",
  ADD COLUMN "depositReceiptImagePath" TEXT;

-- AlterTable: sell settings, all null until an operator turns sell on.
ALTER TABLE "PlatformSettings"
  ADD COLUMN "sellMarginBps" INTEGER,
  ADD COLUMN "sellDepositAddressTron" TEXT,
  ADD COLUMN "sellDepositAddressBsc" TEXT;

ALTER TABLE "PlatformSettings" ADD CONSTRAINT "platform_settings_sell_margin_non_negative"
  CHECK ("sellMarginBps" IS NULL OR "sellMarginBps" >= 0);

CREATE INDEX "Order_direction_idx" ON "Order"("direction");

-- Defense in depth alongside the transition trigger: a BUY order can never
-- sit in a sell-only intermediate status and vice versa. App code already
-- guarantees this by construction (sellOrderService only ever calls the
-- sell transitions), but CLAUDE.md's standard here is "enforced by the
-- database, not application code alone."
ALTER TABLE "Order" ADD CONSTRAINT "order_direction_status_consistency" CHECK (
  (direction = 'BUY'  AND status NOT IN ('AWAITING_DEPOSIT', 'DEPOSIT_CLAIMED', 'DEPOSIT_VERIFIED')) OR
  (direction = 'SELL' AND status NOT IN ('AWAITING_PAYMENT', 'PAYMENT_CLAIMED', 'PAYMENT_VERIFIED'))
);

-- Extend the state-transition guard with the sell edges. Same function,
-- same CREATE OR REPLACE pattern already used once before (when
-- AdminAuditLog's append-only guard was generalized) — additive, no
-- existing behavior changes for buy orders.
CREATE OR REPLACE FUNCTION enforce_order_state_transition() RETURNS trigger AS $$
BEGIN
  IF OLD.status IN ('COMPLETED', 'EXPIRED', 'REFUNDED') THEN
    RAISE EXCEPTION 'order % is in terminal state % and cannot be modified', OLD.id, OLD.status
      USING ERRCODE = '22000';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status = 'QUOTED'            AND NEW.status IN ('AWAITING_PAYMENT', 'AWAITING_DEPOSIT', 'EXPIRED')) OR
      (OLD.status = 'AWAITING_PAYMENT'  AND NEW.status IN ('PAYMENT_CLAIMED', 'EXPIRED')) OR
      (OLD.status = 'PAYMENT_CLAIMED'   AND NEW.status IN ('PAYMENT_VERIFIED', 'REFUND_DUE')) OR
      (OLD.status = 'PAYMENT_VERIFIED'  AND NEW.status = 'COMPLETED') OR
      (OLD.status = 'AWAITING_DEPOSIT'  AND NEW.status IN ('DEPOSIT_CLAIMED', 'EXPIRED')) OR
      (OLD.status = 'DEPOSIT_CLAIMED'   AND NEW.status IN ('DEPOSIT_VERIFIED', 'REFUND_DUE')) OR
      (OLD.status = 'DEPOSIT_VERIFIED'  AND NEW.status = 'COMPLETED') OR
      (OLD.status = 'REFUND_DUE'        AND NEW.status = 'REFUNDED')
    ) THEN
      RAISE EXCEPTION 'illegal order state transition from % to %', OLD.status, NEW.status
        USING ERRCODE = '22000';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
