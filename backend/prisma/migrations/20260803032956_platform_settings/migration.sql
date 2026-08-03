-- CreateEnum
CREATE TYPE "MomoNetwork" AS ENUM ('MTN', 'ORANGE');

-- CreateTable: single-row settings table (id is always 'default'). This is
-- the manual RateProvider's data source — see src/pricing/rateProvider.js.
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "xafUsdtRateMicros" BIGINT NOT NULL,
    "tronNetworkFeeXaf" INTEGER NOT NULL,
    "bscNetworkFeeXaf" INTEGER NOT NULL,
    "targetMarginBps" INTEGER NOT NULL,
    "rateTtlSeconds" INTEGER NOT NULL DEFAULT 86400,
    "momoNetwork" "MomoNetwork" NOT NULL,
    "momoNumber" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PlatformSettings" ADD CONSTRAINT "platform_settings_rate_ttl_positive" CHECK ("rateTtlSeconds" > 0);
ALTER TABLE "PlatformSettings" ADD CONSTRAINT "platform_settings_market_rate_positive" CHECK ("xafUsdtRateMicros" > 0);
ALTER TABLE "PlatformSettings" ADD CONSTRAINT "platform_settings_margin_non_negative" CHECK ("targetMarginBps" >= 0);
ALTER TABLE "PlatformSettings" ADD CONSTRAINT "platform_settings_tron_fee_non_negative" CHECK ("tronNetworkFeeXaf" >= 0);
ALTER TABLE "PlatformSettings" ADD CONSTRAINT "platform_settings_bsc_fee_non_negative" CHECK ("bscNetworkFeeXaf" >= 0);

-- Only the singleton row is ever allowed to exist.
ALTER TABLE "PlatformSettings" ADD CONSTRAINT "platform_settings_singleton" CHECK ("id" = 'default');
