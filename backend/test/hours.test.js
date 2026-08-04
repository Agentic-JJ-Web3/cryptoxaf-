const { isOpenNow, reopenLabel } = require('../src/config/hours');

// Each case is a UTC instant with the equivalent Douala (UTC+1) wall-clock
// time noted, since Douala is what the function actually cares about.
describe('operating hours (Africa/Douala, Mon-Sat 7am-9pm)', () => {
  test.each([
    ['Mon 10:00', '2026-08-03T09:00:00Z', true],
    ['Mon 06:59', '2026-08-03T05:59:00Z', false],
    ['Mon 21:00 (closing instant, exclusive)', '2026-08-03T20:00:00Z', false],
    ['Mon 20:59', '2026-08-03T19:59:00Z', true],
    ['Sat 12:00', '2026-08-08T11:00:00Z', true],
    ['Sat 22:00', '2026-08-08T21:00:00Z', false],
    ['Sun 12:00', '2026-08-09T11:00:00Z', false],
  ])('%s -> isOpenNow = %s', (_label, iso, expected) => {
    expect(isOpenNow(new Date(iso))).toBe(expected);
  });

  test('reopen label: before opening today', () => {
    expect(reopenLabel(new Date('2026-08-04T04:00:00Z'))).toBe('today at 7:00am'); // Tue 05:00
  });

  test('reopen label: weeknight after close', () => {
    expect(reopenLabel(new Date('2026-08-04T22:00:00Z'))).toBe('tomorrow at 7:00am'); // Tue 23:00
  });

  test('reopen label: Saturday night rolls to Monday', () => {
    expect(reopenLabel(new Date('2026-08-08T21:00:00Z'))).toBe('Monday at 7:00am'); // Sat 22:00
  });

  test('reopen label: Sunday any time rolls to Monday', () => {
    expect(reopenLabel(new Date('2026-08-09T11:00:00Z'))).toBe('Monday at 7:00am'); // Sun 12:00
  });
});
