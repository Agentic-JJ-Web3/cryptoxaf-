const { prisma, seedPlatformSettings } = require('./testDb');
const { getSellRate, MIN_SELL_MARGIN_BPS, MAX_SELL_MARGIN_BPS } = require('../src/pricing/rateProvider');
const { computeSellQuote } = require('../src/pricing/quote');
const { RateUnavailableError, AmountTooSmallError } = require('../src/pricing/errors');

afterAll(async () => {
  await prisma.$disconnect();
});

describe('sell rate provider — fails closed', () => {
  test('throws when sellMarginBps is unset, even with a fresh buy-side rate', async () => {
    await seedPlatformSettings({ sellMarginBps: null, sellDepositAddressTron: null, sellDepositAddressBsc: null });
    await expect(getSellRate(prisma, 'TRON')).rejects.toThrow(RateUnavailableError);
  });

  test('throws when the deposit address for the requested chain is unset', async () => {
    await seedPlatformSettings({ sellMarginBps: 150, sellDepositAddressTron: null, sellDepositAddressBsc: 'bsc-deposit-addr' });
    await expect(getSellRate(prisma, 'TRON')).rejects.toThrow(RateUnavailableError);
    // BSC is configured, so it should succeed independently of TRON's state.
    await expect(getSellRate(prisma, 'BSC')).resolves.toBeTruthy();
  });

  test('returns a rate below market when fully configured', async () => {
    await seedPlatformSettings({
      xafUsdtRateMicros: 650_000_000n,
      sellMarginBps: 150,
      sellDepositAddressTron: 'tron-deposit-addr',
      sellDepositAddressBsc: 'bsc-deposit-addr',
    });

    const rate = await getSellRate(prisma, 'TRON');
    expect(rate.depositAddress).toBe('tron-deposit-addr');
    expect(rate.quotedRateMicros).toBe(640_250_000n); // 650M * (1 - 1.5%)
    expect(rate.quotedRateMicros < rate.marketRateMicros).toBe(true);
  });

  test('clamps an out-of-bounds configured sell margin to [MIN_SELL_MARGIN_BPS, MAX_SELL_MARGIN_BPS]', async () => {
    await seedPlatformSettings({
      sellMarginBps: 5, // below floor
      sellDepositAddressTron: 'tron-deposit-addr',
      sellDepositAddressBsc: 'bsc-deposit-addr',
    });
    const tooLow = await getSellRate(prisma, 'TRON');
    expect(tooLow.targetMarginBps).toBe(MIN_SELL_MARGIN_BPS);

    await seedPlatformSettings({ sellMarginBps: 50_000 }); // absurdly high
    const tooHigh = await getSellRate(prisma, 'TRON');
    expect(tooHigh.targetMarginBps).toBe(MAX_SELL_MARGIN_BPS);
  });
});

describe('computeSellQuote', () => {
  const rate = { marketRateMicros: 650_000_000n, targetMarginBps: 150, quotedRateMicros: 640_250_000n };

  test('1 USDT converts to the same XAF payout regardless of chain decimals', () => {
    const tron = computeSellQuote({ usdtAmount: 1_000_000n, chain: 'TRON', rate }); // 1 USDT, 6dp
    const bsc = computeSellQuote({ usdtAmount: 1_000_000_000_000_000_000n, chain: 'BSC', rate }); // 1 USDT, 18dp

    expect(tron.xafAmount).toBe(640); // floor(640.25)
    expect(bsc.xafAmount).toBe(640);
  });

  test('rejects an amount too small to produce any XAF payout', () => {
    expect(() => computeSellQuote({ usdtAmount: 0n, chain: 'TRON', rate })).toThrow(AmountTooSmallError);
  });
});
