-- AlterTable: customer's MoMo number, submitted alongside paymentReference
-- at PAYMENT_CLAIMED so the operator can cross-check it in their MoMo app.
ALTER TABLE "Order" ADD COLUMN "customerMomoNumber" TEXT;

-- CreateTable
CREATE TABLE "Operator" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Operator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Operator_email_key" ON "Operator"("email");

-- CreateIndex
CREATE INDEX "Operator_email_idx" ON "Operator"("email");

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- AdminAuditLog is append-only, same guarantee as OrderAuditLog. Rename the
-- existing trigger function now that it's shared across log tables — the
-- rename doesn't touch the triggers already bound to it on OrderAuditLog.
ALTER FUNCTION prevent_order_audit_log_mutation() RENAME TO prevent_append_only_mutation;

CREATE TRIGGER trg_admin_audit_log_no_update
  BEFORE UPDATE ON "AdminAuditLog"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_append_only_mutation();

CREATE TRIGGER trg_admin_audit_log_no_delete
  BEFORE DELETE ON "AdminAuditLog"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_append_only_mutation();
