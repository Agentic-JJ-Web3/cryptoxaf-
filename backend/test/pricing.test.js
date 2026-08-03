const { prisma, seedPlatformSettings } = require('./testDb');
const { getRate, MIN_MARGIN_BPS, MAX_MARGIN_BPS } = require('../src/pricing/rateProvider');
const { computeQuote } = require('../src/pricing/quote');
const { RateUnavailableError, AmountTooSmallError } = require('../src/pricing/errors');

afterAll(async () => {
  await prisma.$disconnect();
});

describe('rate provider — fails closed', () => {
  test('throws when no settings row exists', async () => {
    await prisma.platformSettings.deleteMany({ where: { id: 'default' } });
    await expect(getRate(prisma, 'TRON')).rejects.toThrow(RateUnavailableError);
  });

  test('throws when the settings row is older than its own TTL', async () => {
    await seedPlatformSettings({ rateTtlSeconds: 1 });
    await new Promise((resolve) => {
      setTimeout(resolve, 1100);
    });
    await expect(getRate(prisma, 'TRON')).rejects.toThrow(RateUnavailableError);
  });

  test('returns a rate when fresh, with the correct per-chain fee', async () => {
    await seedPlatformSettings({ tronNetworkFeeXaf: 500, bscNetworkFeeXaf: 200 });

    const tron = await getRate(prisma, 'TRON');
    expect(tron.networkFeeXaf).toBe(500);
    expect(tron.marketRateMicros).toBe(650_000_000n);

    const bsc = await getRate(prisma, 'BSC');
    expect(bsc.networkFeeXaf).toBe(200);
  });

  test('clamps an out-of-bounds configured margin to [MIN_MARGIN_BPS, MAX_MARGIN_BPS]', async () => {
    await seedPlatformSettings({ targetMarginBps: 5 }); // below floor
    const tooLow = await getRate(prisma, 'TRON');
    expect(tooLow.targetMarginBps).toBe(MIN_MARGIN_BPS);

    await seedPlatformSettings({ targetMarginBps: 50_000 }); // absurdly high
    const tooHigh = await getRate(prisma, 'TRON');
    expect(tooHigh.targetMarginBps).toBe(MAX_MARGIN_BPS);
  });
});

describe('computeQuote', () => {
  test('deducts the network fee from the amount paid, not on top of it', () => {
    const quote = computeQuote({
      xafAmount: 32_500,
      chain: 'TRON',
      rate: { networkFeeXaf: 450, marketRateMicros: 650_000_000n, targetMarginBps: 290, quotedRateMicros: 668_850_000n },
    });

    // (32500 - 450) XAF worth of USDT at 668.85 XAF/USDT, 6dp.
    expect(quote.usdtAmount).toBe(47_918_068n);
  });

  test('rejects an amount that does not cover the network fee', () => {
    expect(() =>
      computeQuote({
        xafAmount: 100,
        chain: 'TRON',
        rate: { networkFeeXaf: 450, marketRateMicros: 650_000_000n, targetMarginBps: 290, quotedRateMicros: 668_850_000n },
      }),
    ).toThrow(AmountTooSmallError);
  });

  test('produces 18dp base units on BSC for the same XAF amount', () => {
    const quote = computeQuote({
      xafAmount: 32_500,
      chain: 'BSC',
      rate: { networkFeeXaf: 120, marketRateMicros: 650_000_000n, targetMarginBps: 290, quotedRateMicros: 668_850_000n },
    });

    expect(quote.usdtAmount).toBe(48_411_452_493_085_146_146n);
  });
});
