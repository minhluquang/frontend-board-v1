import { describe, expect, it } from "vitest";
import {
  daysAgo,
  formatSiteDateTime,
  formatSiteDueAt,
  formatUnixSeconds,
  isValidIsoDate,
  localDate,
  parseSiteDueAt,
  toApiDate,
} from "./dates";

describe("toApiDate", () => {
  it("turns an ISO date into the API's DD/MM/YYYY", () => {
    expect(toApiDate("2026-10-06")).toBe("06/10/2026");
  });

  it("refuses anything else", () => {
    expect(() => toApiDate("06/10/2026")).toThrow();
  });
});

describe("localDate", () => {
  it("is the next day in Sydney when it is still evening in UTC", () => {
    const instant = new Date("2026-10-06T15:30:00Z");
    expect(localDate(instant, "Australia/Sydney")).toBe("2026-10-07");
    expect(localDate(instant, "Asia/Singapore")).toBe("2026-10-06");
  });
});

describe("daysAgo", () => {
  it("counts back across a month boundary", () => {
    expect(daysAgo(30, new Date("2026-10-15T00:00:00Z"))).toBe("2026-09-15");
  });
});

describe("isValidIsoDate", () => {
  it("accepts valid YYYY-MM-DD dates", () => {
    expect(isValidIsoDate("2026-10-15")).toBe(true);
    expect(isValidIsoDate("2026-02-28")).toBe(true);
  });

  it("rejects invalid formats and non-existent calendar dates", () => {
    expect(isValidIsoDate("")).toBe(false);
    expect(isValidIsoDate("2026-10")).toBe(false);
    expect(isValidIsoDate("15/10/2026")).toBe(false);
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("invalid-date")).toBe(false);
  });
});

describe("formatSiteDateTime", () => {
  const boundaryUtc = "2026-10-31T15:30:00Z";

  it("formats instants for Singapore with timezone named", () => {
    // 15:30 UTC + 8h = 23:30 same day
    expect(formatSiteDateTime(boundaryUtc, "Asia/Singapore")).toBe(
      "2026-10-31 23:30:00 (Asia/Singapore)",
    );
  });

  it("formats instants for Jakarta with timezone named", () => {
    // 15:30 UTC + 7h = 22:30 same day
    expect(formatSiteDateTime(boundaryUtc, "Asia/Jakarta")).toBe(
      "2026-10-31 22:30:00 (Asia/Jakarta)",
    );
  });

  it("formats boundary instants for Sydney crossing midnight to next calendar date", () => {
    // Late October is AEDT (UTC+11): 15:30 UTC + 11h = 02:30 next day (Nov 1)
    expect(formatSiteDateTime(boundaryUtc, "Australia/Sydney")).toBe(
      "2026-11-01 02:30:00 (Australia/Sydney)",
    );
  });

  it("handles standard afternoon instant across Singapore, Sydney, and Jakarta", () => {
    const afternoonUtc = "2026-10-06T06:15:30Z";
    expect(formatSiteDateTime(afternoonUtc, "Asia/Jakarta")).toBe(
      "2026-10-06 13:15:30 (Asia/Jakarta)",
    );
    expect(formatSiteDateTime(afternoonUtc, "Asia/Singapore")).toBe(
      "2026-10-06 14:15:30 (Asia/Singapore)",
    );
    expect(formatSiteDateTime(afternoonUtc, "Australia/Sydney")).toBe(
      "2026-10-06 17:15:30 (Australia/Sydney)",
    );
  });

  it("visibly indicates missing timezone instead of silently defaulting to UTC", () => {
    expect(formatSiteDateTime(boundaryUtc, null)).toBe("Missing timezone");
    expect(formatSiteDateTime(boundaryUtc, undefined)).toBe("Missing timezone");
    expect(formatSiteDateTime(boundaryUtc, "")).toBe("Missing timezone");
    expect(formatSiteDateTime(boundaryUtc, "   ")).toBe("Missing timezone");
  });

  it("handles invalid date strings gracefully", () => {
    expect(formatSiteDateTime("not-a-date", "Asia/Singapore")).toBe("Invalid date");
  });
});

describe("formatUnixSeconds", () => {
  // 1791874530 = 2026-10-13T06:55:30Z (Unix seconds)
  // In Asia/Singapore (+8h): 2026-10-13 14:55:30 (Asia/Singapore)
  // In Australia/Sydney (AEDT, +11h): 2026-10-13 17:55:30 (Australia/Sydney)
  // In Asia/Jakarta (+7h): 2026-10-13 13:55:30 (Asia/Jakarta)
  const sampleUnixSeconds = 1791874530;

  it("converts Unix seconds to instant and formats in site timezone", () => {
    expect(formatUnixSeconds(sampleUnixSeconds, "Asia/Singapore")).toBe(
      "2026-10-13 14:55:30 (Asia/Singapore)",
    );
    expect(formatUnixSeconds(sampleUnixSeconds, "Australia/Sydney")).toBe(
      "2026-10-13 17:55:30 (Australia/Sydney)",
    );
    expect(formatUnixSeconds(sampleUnixSeconds, "Asia/Jakarta")).toBe(
      "2026-10-13 13:55:30 (Asia/Jakarta)",
    );
  });

  it("visibly indicates missing timezone instead of defaulting to UTC", () => {
    expect(formatUnixSeconds(sampleUnixSeconds, null)).toBe("Missing timezone");
    expect(formatUnixSeconds(sampleUnixSeconds, undefined)).toBe("Missing timezone");
    expect(formatUnixSeconds(sampleUnixSeconds, "")).toBe("Missing timezone");
  });

  it("handles null or non-finite inputs gracefully", () => {
    expect(formatUnixSeconds(null, "Asia/Singapore")).toBe("Missing timestamp");
    expect(formatUnixSeconds(undefined, "Asia/Singapore")).toBe("Missing timestamp");
    expect(formatUnixSeconds(NaN, "Asia/Singapore")).toBe("Invalid date");
  });
});

describe("Site-local due_at parsing and formatting (parseSiteDueAt and formatSiteDueAt)", () => {
  it("explicitly parses DD/MM/YYYY HH:mm fields without browser-local Date parsing or UTC shifts", () => {
    const parsed = parseSiteDueAt("07/10/2026 10:00");
    expect(parsed).toEqual({
      day: "07",
      month: "10",
      year: "2026",
      hour: "10",
      minute: "00",
      second: undefined,
    });
  });

  it("parses optional seconds field when present", () => {
    const parsed = parseSiteDueAt("31/12/2026 23:59:45");
    expect(parsed).toEqual({
      day: "31",
      month: "12",
      year: "2026",
      hour: "23",
      minute: "59",
      second: "45",
    });
  });

  it("formats due_at with site timezone explicitly named", () => {
    expect(formatSiteDueAt("07/10/2026 10:00", "Asia/Singapore")).toBe(
      "2026-10-07 10:00 (Asia/Singapore)",
    );
    expect(formatSiteDueAt("07/10/2026 10:00", "Australia/Sydney")).toBe(
      "2026-10-07 10:00 (Australia/Sydney)",
    );
  });

  it("returns dash for null or empty due_at", () => {
    expect(formatSiteDueAt(null, "Asia/Singapore")).toBe("—");
    expect(formatSiteDueAt(undefined, "Asia/Singapore")).toBe("—");
    expect(formatSiteDueAt("", "Asia/Singapore")).toBe("—");
  });

  it("returns Missing timezone when timezone is missing instead of defaulting to UTC", () => {
    expect(formatSiteDueAt("07/10/2026 10:00", null)).toBe("Missing timezone");
    expect(formatSiteDueAt("07/10/2026 10:00", undefined)).toBe("Missing timezone");
    expect(formatSiteDueAt("07/10/2026 10:00", "")).toBe("Missing timezone");
  });

  it("returns Invalid date format for malformed strings", () => {
    expect(formatSiteDueAt("2026-10-07", "Asia/Singapore")).toBe("Invalid date format");
    expect(formatSiteDueAt("invalid date", "Asia/Singapore")).toBe("Invalid date format");
  });
});
