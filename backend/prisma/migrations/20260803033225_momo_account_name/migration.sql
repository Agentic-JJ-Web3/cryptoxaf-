-- AlterTable: the name registered on momoNumber, shown to the customer
-- alongside it so they can confirm it matches what their MoMo app shows
-- before paying. Safe as NOT NULL with no default: PlatformSettings has
-- no rows yet (it's seeded, not migrated, with real values).
ALTER TABLE "PlatformSettings" ADD COLUMN "momoAccountName" TEXT NOT NULL;
