// Cameroon is WAT (UTC+1) year-round, no DST — computed explicitly via
// Intl rather than trusting the server's own OS timezone, which has
// nothing to do with where the business actually operates.
const TIMEZONE = 'Africa/Douala';
const OPEN_HOUR = 7;
const CLOSE_HOUR = 21; // 9pm, exclusive

const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

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

// Mon–Sat, 7am–9pm. Sunday is closed all day.
function isOpenNow(date = new Date()) {
  const { day, hour } = localParts(date);
  if (day === 0) return false;
  return hour >= OPEN_HOUR && hour < CLOSE_HOUR;
}

function reopenLabel(date = new Date()) {
  const { day, hour } = localParts(date);
  if (day === 0) return 'Monday at 7:00am';
  if (hour < OPEN_HOUR) return 'today at 7:00am';
  if (day === 6) return 'Monday at 7:00am'; // Saturday night
  return 'tomorrow at 7:00am'; // Mon–Fri night
}

module.exports = { isOpenNow, reopenLabel, TIMEZONE, OPEN_HOUR, CLOSE_HOUR };
