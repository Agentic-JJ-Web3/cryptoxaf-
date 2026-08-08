// Cameroon is WAT (UTC+1) year-round, no DST — computed explicitly via
// Intl rather than trusting the server's own OS timezone, which has
// nothing to do with where the business actually operates. The schedule
// itself (open/close hour, which weekdays) is admin-editable via
// PlatformSettings — see src/admin/settingsService.js — these functions
// are pure and take that config as a parameter rather than reading it.
const TIMEZONE = 'Africa/Douala';

const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function localParts(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(date);

  const weekday = parts.find((p) => p.type === 'weekday').value;
  let hour = Number(parts.find((p) => p.type === 'hour').value);
  if (hour === 24) hour = 0;
  return { day: WEEKDAY_INDEX[weekday], hour };
}

function formatHourLabel(hour) {
  const period = hour < 12 ? 'am' : 'pm';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:00${period}`;
}

// `hours` = { openHour, closeHour, openWeekdays } — the shape stored on
// PlatformSettings. closeHour is exclusive.
function isOpenNow(hours, date = new Date()) {
  const { day, hour } = localParts(date);
  if (!hours.openWeekdays.includes(day)) return false;
  return hour >= hours.openHour && hour < hours.closeHour;
}

function reopenLabel(hours, date = new Date()) {
  const { day, hour } = localParts(date);
  const openTimeLabel = formatHourLabel(hours.openHour);

  if (hours.openWeekdays.length === 0) {
    // Misconfigured (no open days at all) — shouldn't happen, admin
    // settings validation requires at least one, but don't throw here.
    return `at ${openTimeLabel}`;
  }

  if (hours.openWeekdays.includes(day) && hour < hours.openHour) {
    return `today at ${openTimeLabel}`;
  }

  for (let offset = 1; offset <= 7; offset += 1) {
    const nextDay = (day + offset) % 7;
    if (hours.openWeekdays.includes(nextDay)) {
      const dayLabel = offset === 1 ? 'tomorrow' : WEEKDAY_NAMES[nextDay];
      return `${dayLabel} at ${openTimeLabel}`;
    }
  }
  return `at ${openTimeLabel}`; // unreachable given the length check above
}

// The original hardcoded schedule, used as a fallback below — not a
// fail-closed posture like rateProvider's (that's specifically about
// pricing). If PlatformSettings doesn't exist yet at all, other things
// (quoting) already fail closed on their own; the hours gate shouldn't
// also throw a raw 500 on top of that, so it falls back to what this
// platform always did before hours became admin-editable.
const DEFAULT_HOURS = { openHour: 7, closeHour: 21, openWeekdays: [1, 2, 3, 4, 5, 6] };

// Loads the { openHour, closeHour, openWeekdays } shape isOpenNow/reopenLabel
// need, from the same PlatformSettings row everything else reads. No TTL
// gate here (unlike rateProvider's fail-closed staleness check) — hours
// don't go "stale," they're just admin-configured values, and a customer
// should still see an accurate open/closed read even if the *rate* is stale.
async function loadHoursConfig(prisma) {
  const settings = await prisma.platformSettings.findUnique({ where: { id: 'default' } });
  if (!settings) return DEFAULT_HOURS;
  return { openHour: settings.openHour, closeHour: settings.closeHour, openWeekdays: settings.openWeekdays };
}

module.exports = { isOpenNow, reopenLabel, loadHoursConfig, TIMEZONE };
