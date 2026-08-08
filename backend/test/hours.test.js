const { isOpenNow, reopenLabel } = require('../src/config/hours');

const MON_SAT_7_21 = { openHour: 7, closeHour: 21, openWeekdays: [1, 2, 3, 4, 5, 6] };

// Each case is a UTC instant with the equivalent Douala (UTC+1) wall-clock
// time noted, since Douala is what the function actually cares about.
describe('operating hours (Africa/Douala, Mon-Sat 7am-9pm default config)', () => {
  test.each([
    ['Mon 10:00', '2026-08-03T09:00:00Z', true],
    ['Mon 06:59', '2026-08-03T05:59:00Z', false],
    ['Mon 21:00 (closing instant, exclusive)', '2026-08-03T20:00:00Z', false],
    ['Mon 20:59', '2026-08-03T19:59:00Z', true],
    ['Sat 12:00', '2026-08-08T11:00:00Z', true],
    ['Sat 22:00', '2026-08-08T21:00:00Z', false],
    ['Sun 12:00', '2026-08-09T11:00:00Z', false],
  ])('%s -> isOpenNow = %s', (_label, iso, expected) => {
    expect(isOpenNow(MON_SAT_7_21, new Date(iso))).toBe(expected);
  });

  test('reopen label: before opening today', () => {
    expect(reopenLabel(MON_SAT_7_21, new Date('2026-08-04T04:00:00Z'))).toBe('today at 7:00am'); // Tue 05:00
  });

  test('reopen label: weeknight after close', () => {
    expect(reopenLabel(MON_SAT_7_21, new Date('2026-08-04T22:00:00Z'))).toBe('tomorrow at 7:00am'); // Tue 23:00
  });

  test('reopen label: Saturday night rolls to Monday', () => {
    expect(reopenLabel(MON_SAT_7_21, new Date('2026-08-08T21:00:00Z'))).toBe('Monday at 7:00am'); // Sat 22:00
  });

  test('reopen label: Sunday any time says "tomorrow" — Monday genuinely is tomorrow', () => {
    // The old hardcoded logic special-cased Sunday to always say "Monday";
    // the generalized (admin-editable-schedule) logic is more consistent —
    // it says "tomorrow" whenever the next open day is one day out, exactly
    // like the Mon-Fri-night case below, and only names the day when it's
    // further out (see the Saturday-night case, which skips Sunday).
    expect(reopenLabel(MON_SAT_7_21, new Date('2026-08-09T11:00:00Z'))).toBe('tomorrow at 7:00am'); // Sun 12:00
  });
});

describe('operating hours with an admin-edited schedule', () => {
  const everyDay9to17 = { openHour: 9, closeHour: 17, openWeekdays: [0, 1, 2, 3, 4, 5, 6] };

  test('open every day including Sunday', () => {
    expect(isOpenNow(everyDay9to17, new Date('2026-08-09T09:00:00Z'))).toBe(true); // Sun 10:00
  });

  test('reopen label skips straight to tomorrow when every day is open', () => {
    expect(reopenLabel(everyDay9to17, new Date('2026-08-09T20:00:00Z'))).toBe('tomorrow at 9:00am'); // Sun 21:00
  });

  test('a single open weekday rolls forward to its own name, not just "tomorrow"', () => {
    const fridaysOnly = { openHour: 8, closeHour: 18, openWeekdays: [5] };
    // Monday 09:00 Douala -> next open day is Friday
    expect(reopenLabel(fridaysOnly, new Date('2026-08-03T08:00:00Z'))).toBe('Friday at 8:00am');
  });

  test('no open weekdays at all does not throw', () => {
    const alwaysClosed = { openHour: 9, closeHour: 17, openWeekdays: [] };
    expect(isOpenNow(alwaysClosed, new Date())).toBe(false);
    expect(() => reopenLabel(alwaysClosed, new Date())).not.toThrow();
  });
});
