// Date helpers. The API wants DD/MM/YYYY; the rules talk about each site's local date.

/** "2026-10-06" -> "06/10/2026" (the format the API's created_from/created_to expect). */
export function toApiDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) throw new Error(`Not a YYYY-MM-DD date: ${isoDate}`);
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

/** The YYYY-MM-DD date of an instant in a given IANA timezone. */
export function localDate(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Today's date, as YYYY-MM-DD, minus `days` days (UTC arithmetic on the calendar date). */
export function daysAgo(days: number, today = new Date()): string {
  const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - days));
  return date.toISOString().slice(0, 10);
}

/** Check if a string is a valid YYYY-MM-DD calendar date. */
export function isValidIsoDate(isoDate: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false;
  const date = new Date(`${isoDate}T00:00:00Z`);
  return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === isoDate;
}

/**
 * Format a UTC instant in the site's IANA timezone and visibly append the timezone name.
 * Returns "Missing timezone" if timezone is omitted or blank, avoiding inaccurate UTC fallback.
 * Example: "2026-10-06 10:15:07 (Asia/Singapore)"
 */
export function formatSiteDateTime(instant: Date | string, timeZone?: string | null): string {
  if (!timeZone || !timeZone.trim()) {
    return "Missing timezone";
  }

  const date = typeof instant === "string" ? new Date(instant) : instant;
  if (isNaN(date.getTime())) {
    return "Invalid date";
  }

  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(date);

    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const yyyy = get("year");
    const mm = get("month");
    const dd = get("day");
    const hh = get("hour");
    const min = get("minute");
    const ss = get("second");

    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss} (${timeZone})`;
  } catch {
    return `Invalid timezone (${timeZone})`;
  }
}

/**
 * Convert an event's Unix seconds timestamp to an instant, format it in the site's IANA timezone,
 * and visibly name the timezone.
 * Returns "Missing timezone" if timezone is omitted or blank.
 */
export function formatUnixSeconds(seconds: number | null | undefined, timeZone?: string | null): string {
  if (seconds === null || seconds === undefined) {
    return "Missing timestamp";
  }
  if (!timeZone || !timeZone.trim()) {
    return "Missing timezone";
  }
  if (!Number.isFinite(seconds)) {
    return "Invalid date";
  }
  const instant = new Date(seconds * 1000);
  return formatSiteDateTime(instant, timeZone);
}

export interface ParsedSiteDueAt {
  day: string;
  month: string;
  year: string;
  hour: string;
  minute: string;
  second?: string;
}

/**
 * Parses site-local wall-clock due_at text in "DD/MM/YYYY HH:mm" (or with optional seconds) format.
 * Parses fields explicitly; does not pass through browser-local Date parsing or apply UTC shifting.
 */
export function parseSiteDueAt(value: string | null | undefined): ParsedSiteDueAt | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  const match = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (!match) return null;
  const [, day, month, year, hour, minute, second] = match;
  return { day, month, year, hour, minute, second };
}

/**
 * Formats event due_at site-local wall-clock text in the site's timezone, visibly naming the timezone.
 * Explicitly parses fields without Date conversions.
 * Returns "—" if due_at is null/empty.
 * Returns "Missing timezone" if site timezone is missing.
 */
export function formatSiteDueAt(dueAt: string | null | undefined, timeZone?: string | null): string {
  if (dueAt === null || dueAt === undefined || dueAt.trim() === "") {
    return "—";
  }
  if (!timeZone || !timeZone.trim()) {
    return "Missing timezone";
  }
  const parsed = parseSiteDueAt(dueAt);
  if (!parsed) {
    return "Invalid date format";
  }
  const secPart = parsed.second ? `:${parsed.second}` : "";
  return `${parsed.year}-${parsed.month}-${parsed.day} ${parsed.hour}:${parsed.minute}${secPart} (${timeZone})`;
}
