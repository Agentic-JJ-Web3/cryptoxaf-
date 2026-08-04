-- CreateTable: "notify me when you reopen" capture from the closed-state
-- screen. Followed up manually — no SMS integration yet.
CREATE TABLE "NotifyRequest" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotifyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotifyRequest_createdAt_idx" ON "NotifyRequest"("createdAt");
