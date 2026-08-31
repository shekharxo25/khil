export const DAY_MS = 24 * 60 * 60 * 1000;

/** Parse a DD/MM/YYYY string. Returns null when the date is not a real calendar date. */
export function parseDob(input: string): Date | null {
  const match = input.trim().match(/^(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function ageInMonths(dobIso: string, now: Date = new Date()): number {
  const dob = new Date(dobIso);
  let months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
  if (now.getDate() < dob.getDate()) months -= 1;
  return Math.max(0, months);
}

export function ageInYears(dobIso: string, now: Date = new Date()): number {
  return Math.floor(ageInMonths(dobIso, now) / 12);
}

/** Monday-anchored start of the week containing `now`. */
export function startOfWeek(now: Date = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekday = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - weekday);
  return d;
}

export function isSameDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function formatDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function relativeDay(ms: number, now: number = Date.now()): string {
  if (isSameDay(ms, now)) return 'Today';
  if (isSameDay(ms, now - DAY_MS)) return 'Yesterday';
  const days = Math.round((now - ms) / DAY_MS);
  if (days < 7) return `${days} days ago`;
  return formatDate(ms);
}
