-- CreateEnum
CREATE TYPE "Chain" AS ENUM ('TRON', 'BSC');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('QUOTED', 'AWAITING_PAYMENT', 'PAYMENT_CLAIMED', 'PAYMENT_VERIFIED', 'COMPLETED', 'EXPIRED', 'REFUND_DUE', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('SYSTEM', 'CUSTOMER', 'OPERATOR');

-- CreateTable
CREATE TABLE "RateSnapshot" (
    "id" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "marketRateMicros" BIGINT NOT NULL,
    "networkFeeXaf" INTEGER NOT NULL,
    "targetMarginBps" INTEGER NOT NULL,
    "quotedRateMicros" BIGINT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'QUOTED',
    "chain" "Chain" NOT NULL,
    "destinationAddress" TEXT NOT NULL,
    "xafAmount" INTEGER NOT NULL,
    "usdtAmount" DECIMAL(38,0) NOT NULL,
    "rateSnapshotId" TEXT NOT NULL,
    "quoteExpiresAt" TIMESTAMP(3) NOT NULL,
    "paymentReference" TEXT,
    "payoutTxHash" TEXT,
    "refundReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderAuditLog" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus" NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actor" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateSnapshot_capturedAt_idx" ON "RateSnapshot"("capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_reference_key" ON "Order"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Order_rateSnapshotId_key" ON "Order"("rateSnapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_payoutTxHash_key" ON "Order"("payoutTxHash");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "OrderAuditLog_orderId_idx" ON "OrderAuditLog"("orderId");

-- CreateIndex
CREATE INDEX "OrderAuditLog_createdAt_idx" ON "OrderAuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_rateSnapshotId_fkey" FOREIGN KEY ("rateSnapshotId") REFERENCES "RateSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAuditLog" ADD CONSTRAINT "OrderAuditLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CheckConstraint: money sanity (ledger invariants, not just app-layer validation)
ALTER TABLE "Order" ADD CONSTRAINT "order_xaf_amount_positive" CHECK ("xafAmount" > 0);
ALTER TABLE "Order" ADD CONSTRAINT "order_usdt_amount_positive" CHECK ("usdtAmount" > 0);
ALTER TABLE "RateSnapshot" ADD CONSTRAINT "rate_snapshot_market_rate_positive" CHECK ("marketRateMicros" > 0);
ALTER TABLE "RateSnapshot" ADD CONSTRAINT "rate_snapshot_quoted_rate_positive" CHECK ("quotedRateMicros" > 0);
ALTER TABLE "RateSnapshot" ADD CONSTRAINT "rate_snapshot_network_fee_non_negative" CHECK ("networkFeeXaf" >= 0);
ALTER TABLE "RateSnapshot" ADD CONSTRAINT "rate_snapshot_margin_non_negative" CHECK ("targetMarginBps" >= 0);

-- Order state machine, enforced in the database so no code path — Prisma,
-- a raw query, a future service — can double-complete an order or skip a
-- guard. Terminal statuses (COMPLETED, EXPIRED, REFUNDED) are frozen: once
-- OLD.status is terminal, the row accepts no further UPDATE at all.
CREATE OR REPLACE FUNCTION enforce_order_state_transition() RETURNS trigger AS $$
BEGIN
  IF OLD.status IN ('COMPLETED', 'EXPIRED', 'REFUNDED') THEN
    RAISE EXCEPTION 'order % is in terminal state % and cannot be modified', OLD.id, OLD.status
      USING ERRCODE = '22000';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status = 'QUOTED'           AND NEW.status IN ('AWAITING_PAYMENT', 'EXPIRED')) OR
      (OLD.status = 'AWAITING_PAYMENT' AND NEW.status IN ('PAYMENT_CLAIMED', 'EXPIRED')) OR
      (OLD.status = 'PAYMENT_CLAIMED'  AND NEW.status IN ('PAYMENT_VERIFIED', 'REFUND_DUE')) OR
      (OLD.status = 'PAYMENT_VERIFIED' AND NEW.status = 'COMPLETED') OR
      (OLD.status = 'REFUND_DUE'       AND NEW.status = 'REFUNDED')
    ) THEN
      RAISE EXCEPTION 'illegal order state transition from % to %', OLD.status, NEW.status
        USING ERRCODE = '22000';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_state_transition
  BEFORE UPDATE ON "Order"
  FOR EACH ROW
  EXECUTE FUNCTION enforce_order_state_transition();

-- Audit log is append-only: block UPDATE and DELETE outright, at the
-- database level, regardless of which application code issues the query.
CREATE OR REPLACE FUNCTION prevent_order_audit_log_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'OrderAuditLog is append-only: % is not permitted', TG_OP
    USING ERRCODE = '22000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_audit_log_no_update
  BEFORE UPDATE ON "OrderAuditLog"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_order_audit_log_mutation();

CREATE TRIGGER trg_order_audit_log_no_delete
  BEFORE DELETE ON "OrderAuditLog"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_order_audit_log_mutation();
