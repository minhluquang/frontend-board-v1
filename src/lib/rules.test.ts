import { describe, expect, it } from "vitest";
import type { HelpdeskRequest, Site, Staff } from "../types";
import {
  clampPage,
  countMissingTimezoneRequests,
  filterAndSortRequests,
  getRequestSiteLocalDate,
  isExcludedRequest,
  isRequestInDateRange,
  isRequestOverdue,
  paginateRequests,
  resolveAssigneeName,
} from "./rules";

const mockSites: Site[] = [
  {
    id: 11,
    name: "Robusttechhouse Tower Singapore",
    timezone: "Asia/Singapore",
    business_hours: {},
  },
  {
    id: 12,
    name: "Robusttechhouse Court Sydney",
    timezone: "Australia/Sydney",
    business_hours: {},
  },
  {
    id: 13,
    name: "Robusttechhouse Plaza Jakarta",
    timezone: "Asia/Jakarta",
    business_hours: {},
  },
];

const mockSitesMap = new Map<number, Site>(mockSites.map((s) => [s.id, s]));

function createMockRequest(overrides: Partial<HelpdeskRequest> = {}): HelpdeskRequest {
  return {
    id: 100,
    ref: "WO-100",
    title: "Test Request",
    location: "Level 1",
    site_id: 11,
    status: "pending",
    priority: "Medium",
    created_at: "2026-10-15T08:00:00Z",
    updated_at: "2026-10-15T08:00:00Z",
    due_on: "2026-10-20",
    assignee: { id: 338, name: "Stale Name" },
    deleted_at: null,
    merged_into_id: null,
    ...overrides,
  };
}

describe("Rule 1: isExcludedRequest", () => {
  it("allows standard active requests", () => {
    expect(isExcludedRequest(createMockRequest({ status: "pending" }))).toBe(false);
    expect(isExcludedRequest(createMockRequest({ status: "processing" }))).toBe(false);
    expect(isExcludedRequest(createMockRequest({ status: "complete" }))).toBe(false);
  });

  it("excludes requests with status canceled", () => {
    expect(isExcludedRequest(createMockRequest({ status: "canceled" }))).toBe(true);
  });

  it("excludes requests with deleted_at set", () => {
    expect(isExcludedRequest(createMockRequest({ deleted_at: "2026-10-16T00:00:00Z" }))).toBe(true);
  });

  it("excludes requests with merged_into_id set", () => {
    expect(isExcludedRequest(createMockRequest({ merged_into_id: 99 }))).toBe(true);
  });
});

describe("Rule 1: Site-local date range boundaries across timezones", () => {
  // At 2026-10-31T15:30:00Z:
  // - Jakarta (UTC+7): 2026-10-31 22:30 (date is 2026-10-31)
  // - Singapore (UTC+8): 2026-10-31 23:30 (date is 2026-10-31)
  // - Sydney (UTC+11 AEDT): 2026-11-01 02:30 (date is 2026-11-01)
  const instantUtcBoundary = "2026-10-31T15:30:00Z";

  it("converts instant to site local date in Singapore, Sydney, and Jakarta", () => {
    const req = createMockRequest({ created_at: instantUtcBoundary });
    expect(getRequestSiteLocalDate(req, "Asia/Jakarta")).toBe("2026-10-31");
    expect(getRequestSiteLocalDate(req, "Asia/Singapore")).toBe("2026-10-31");
    expect(getRequestSiteLocalDate(req, "Australia/Sydney")).toBe("2026-11-01");
  });

  it("evaluates date range boundaries correctly for each site timezone", () => {
    const req = createMockRequest({ created_at: instantUtcBoundary });

    // Range: 2026-10-01 to 2026-10-31
    expect(isRequestInDateRange(req, "Asia/Jakarta", "2026-10-01", "2026-10-31")).toBe(true);
    expect(isRequestInDateRange(req, "Asia/Singapore", "2026-10-01", "2026-10-31")).toBe(true);
    // Sydney is already on 2026-11-01, so it is outside [2026-10-01, 2026-10-31]
    expect(isRequestInDateRange(req, "Australia/Sydney", "2026-10-01", "2026-10-31")).toBe(false);

    // Range: 2026-11-01 to 2026-11-30
    expect(isRequestInDateRange(req, "Asia/Jakarta", "2026-11-01", "2026-11-30")).toBe(false);
    expect(isRequestInDateRange(req, "Asia/Singapore", "2026-11-01", "2026-11-30")).toBe(false);
    expect(isRequestInDateRange(req, "Australia/Sydney", "2026-11-01", "2026-11-30")).toBe(true);
  });

  it("is inclusive on exact start and end dates", () => {
    const startReq = createMockRequest({ created_at: "2026-10-01T00:00:00Z" });
    const endReq = createMockRequest({ created_at: "2026-10-31T00:00:00Z" });

    expect(isRequestInDateRange(startReq, "Asia/Singapore", "2026-10-01", "2026-10-31")).toBe(true);
    expect(isRequestInDateRange(endReq, "Asia/Singapore", "2026-10-01", "2026-10-31")).toBe(true);
  });

  it("does not silently use UTC when timezone is missing", () => {
    const req = createMockRequest({ created_at: "2026-10-15T12:00:00Z" });
    expect(getRequestSiteLocalDate(req, null)).toBeNull();
    expect(getRequestSiteLocalDate(req, undefined)).toBeNull();
    expect(getRequestSiteLocalDate(req, "")).toBeNull();
    expect(isRequestInDateRange(req, null, "2026-10-01", "2026-10-31")).toBe(false);
  });
});

describe("Rule 2: Overdue calculation across timezones", () => {
  it("never marks due_on: null as overdue", () => {
    const req = createMockRequest({ due_on: null, status: "pending" });
    expect(isRequestOverdue(req, "Asia/Singapore", new Date("2026-11-20T00:00:00Z"))).toBe(false);
  });

  it("never marks status complete or canceled as overdue even if due_on is past", () => {
    const completedReq = createMockRequest({ due_on: "2026-10-01", status: "complete" });
    const canceledReq = createMockRequest({ due_on: "2026-10-01", status: "canceled" });
    const now = new Date("2026-11-13T00:00:00Z");

    expect(isRequestOverdue(completedReq, "Asia/Singapore", now)).toBe(false);
    expect(isRequestOverdue(canceledReq, "Asia/Singapore", now)).toBe(false);
  });

  it("marks overdue when due_on is strictly before today in site timezone", () => {
    const now = new Date("2026-11-13T04:00:00Z"); // Midday in Asia/Pacific

    // due yesterday: overdue
    const overdueReq = createMockRequest({ due_on: "2026-11-12", status: "pending" });
    expect(isRequestOverdue(overdueReq, "Asia/Singapore", now)).toBe(true);

    // due today: not overdue yet
    const dueTodayReq = createMockRequest({ due_on: "2026-11-13", status: "pending" });
    expect(isRequestOverdue(dueTodayReq, "Asia/Singapore", now)).toBe(false);

    // due tomorrow: not overdue
    const futureReq = createMockRequest({ due_on: "2026-11-14", status: "processing" });
    expect(isRequestOverdue(futureReq, "Asia/Singapore", now)).toBe(false);
  });

  it("correctly handles timezone differences across Sydney, Singapore, and Jakarta", () => {
    // At UTC 2026-11-13T14:30:00Z:
    // Sydney (UTC+11) is already 2026-11-14 01:30 (today = 2026-11-14)
    // Singapore (UTC+8) is 2026-11-13 22:30 (today = 2026-11-13)
    // Jakarta (UTC+7) is 2026-11-13 21:30 (today = 2026-11-13)
    const instant = new Date("2026-11-13T14:30:00Z");
    const reqDue13th = createMockRequest({ due_on: "2026-11-13", status: "pending" });

    // In Sydney, today is Nov 14, so due_on "2026-11-13" < "2026-11-14" => OVERDUE
    expect(isRequestOverdue(reqDue13th, "Australia/Sydney", instant)).toBe(true);

    // In Singapore, today is Nov 13, so due_on "2026-11-13" < "2026-11-13" => NOT OVERDUE
    expect(isRequestOverdue(reqDue13th, "Asia/Singapore", instant)).toBe(false);

    // In Jakarta, today is Nov 13, so due_on "2026-11-13" < "2026-11-13" => NOT OVERDUE
    expect(isRequestOverdue(reqDue13th, "Asia/Jakarta", instant)).toBe(false);
  });

  it("handles Singapore vs Jakarta timezone offset difference crossing midnight", () => {
    // At UTC 2026-11-13T16:30:00Z:
    // Singapore (UTC+8) is 2026-11-14 00:30 (today = 2026-11-14)
    // Jakarta (UTC+7) is 2026-11-13 23:30 (today = 2026-11-13)
    const instant = new Date("2026-11-13T16:30:00Z");
    const reqDue13th = createMockRequest({ due_on: "2026-11-13", status: "processing" });

    // In Singapore, today is Nov 14 => overdue
    expect(isRequestOverdue(reqDue13th, "Asia/Singapore", instant)).toBe(true);

    // In Jakarta, today is Nov 13 => not overdue
    expect(isRequestOverdue(reqDue13th, "Asia/Jakarta", instant)).toBe(false);
  });

  it("returns null for overdue when timezone is missing to avoid inaccurate result", () => {
    const reqWithDue = createMockRequest({ due_on: "2026-10-01", status: "pending" });
    expect(isRequestOverdue(reqWithDue, null)).toBeNull();
    expect(isRequestOverdue(reqWithDue, undefined)).toBeNull();
    expect(isRequestOverdue(reqWithDue, "")).toBeNull();

    // Still returns false if status complete or due_on null, regardless of timezone
    const completeReq = createMockRequest({ due_on: "2026-10-01", status: "complete" });
    const nullDueReq = createMockRequest({ due_on: null, status: "pending" });
    expect(isRequestOverdue(completeReq, null)).toBe(false);
    expect(isRequestOverdue(nullDueReq, null)).toBe(false);
  });
});

describe("Rule 3: Staff name lookup", () => {
  const staffMap = new Map<number, Staff>([
    [338, { id: 338, name: "Benjamin Tan" }],
    [344, { id: 344, name: "Darren Goh" }],
  ]);

  it("resolves current staff name from staff registry and ignores stale request assignee name", () => {
    const assignee = { id: 338, name: "Outdated Old Name" };
    expect(resolveAssigneeName(assignee, staffMap)).toBe("Benjamin Tan");
  });

  it("returns em dash when assignee is null", () => {
    expect(resolveAssigneeName(null, staffMap)).toBe("—");
  });

  it("falls back safely without using stale assignee name when id is unknown", () => {
    const unknownAssignee = { id: 999, name: "Should Not Be Used" };
    expect(resolveAssigneeName(unknownAssignee, staffMap)).toBe("Staff #999");
  });
});

describe("filterAndSortRequests", () => {
  it("filters out excluded requests (canceled, deleted, merged)", () => {
    const requests = [
      createMockRequest({ id: 1, status: "pending" }),
      createMockRequest({ id: 2, status: "canceled" }),
      createMockRequest({ id: 3, deleted_at: "2026-10-16T00:00:00Z" }),
      createMockRequest({ id: 4, merged_into_id: 1 }),
    ];

    const result = filterAndSortRequests(requests, mockSitesMap, {
      fromDate: "2026-10-01",
      toDate: "2026-10-31",
    });

    expect(result.map((r) => r.id)).toEqual([1]);
  });

  it("filters by siteId", () => {
    const requests = [
      createMockRequest({ id: 1, site_id: 11 }),
      createMockRequest({ id: 2, site_id: 12 }),
      createMockRequest({ id: 3, site_id: 13 }),
    ];

    const result = filterAndSortRequests(requests, mockSitesMap, {
      fromDate: "2026-10-01",
      toDate: "2026-10-31",
      siteId: 12,
    });

    expect(result.map((r) => r.id)).toEqual([2]);
  });

  it("filters by status", () => {
    const requests = [
      createMockRequest({ id: 1, status: "pending" }),
      createMockRequest({ id: 2, status: "processing" }),
      createMockRequest({ id: 3, status: "complete" }),
    ];

    const result = filterAndSortRequests(requests, mockSitesMap, {
      fromDate: "2026-10-01",
      toDate: "2026-10-31",
      status: "processing",
    });

    expect(result.map((r) => r.id)).toEqual([2]);
  });

  it("sorts by created date descending by default (newest first)", () => {
    const requests = [
      createMockRequest({ id: 1, created_at: "2026-10-10T10:00:00Z" }),
      createMockRequest({ id: 2, created_at: "2026-10-20T10:00:00Z" }),
      createMockRequest({ id: 3, created_at: "2026-10-15T10:00:00Z" }),
    ];

    const result = filterAndSortRequests(requests, mockSitesMap, {
      fromDate: "2026-10-01",
      toDate: "2026-10-31",
      sortField: "created",
      sortDirection: "desc",
    });

    expect(result.map((r) => r.id)).toEqual([2, 3, 1]);
  });

  it("sorts by created date ascending (oldest first)", () => {
    const requests = [
      createMockRequest({ id: 1, created_at: "2026-10-10T10:00:00Z" }),
      createMockRequest({ id: 2, created_at: "2026-10-20T10:00:00Z" }),
      createMockRequest({ id: 3, created_at: "2026-10-15T10:00:00Z" }),
    ];

    const result = filterAndSortRequests(requests, mockSitesMap, {
      fromDate: "2026-10-01",
      toDate: "2026-10-31",
      sortField: "created",
      sortDirection: "asc",
    });

    expect(result.map((r) => r.id)).toEqual([1, 3, 2]);
  });

  it("sorts by due date with nulls placed at the bottom", () => {
    const requests = [
      createMockRequest({ id: 1, due_on: "2026-10-25" }),
      createMockRequest({ id: 2, due_on: null }),
      createMockRequest({ id: 3, due_on: "2026-10-05" }),
      createMockRequest({ id: 4, due_on: "2026-10-15" }),
    ];

    // Ascending: earliest due first, nulls at bottom
    const ascResult = filterAndSortRequests(requests, mockSitesMap, {
      fromDate: "2026-10-01",
      toDate: "2026-10-31",
      sortField: "due",
      sortDirection: "asc",
    });
    expect(ascResult.map((r) => r.id)).toEqual([3, 4, 1, 2]);

    // Descending: latest due first, nulls at bottom
    const descResult = filterAndSortRequests(requests, mockSitesMap, {
      fromDate: "2026-10-01",
      toDate: "2026-10-31",
      sortField: "due",
      sortDirection: "desc",
    });
    expect(descResult.map((r) => r.id)).toEqual([1, 4, 3, 2]);
  });
});

describe("Pagination helpers", () => {
  it("clampPage bounds page within valid range", () => {
    expect(clampPage(1, 100, 25)).toBe(1);
    expect(clampPage(4, 100, 25)).toBe(4);
    // Over max page
    expect(clampPage(5, 100, 25)).toBe(4);
    expect(clampPage(99, 100, 25)).toBe(4);
    // Under min page
    expect(clampPage(0, 100, 25)).toBe(1);
    expect(clampPage(-5, 100, 25)).toBe(1);
    // Empty dataset
    expect(clampPage(1, 0, 25)).toBe(1);
    expect(clampPage(5, 0, 25)).toBe(1);
  });

  it("paginateRequests slices exact 25 items per page", () => {
    const items = Array.from({ length: 60 }, (_, i) => ({ id: i + 1 }));

    const page1 = paginateRequests(items, 1, 25);
    expect(page1).toHaveLength(25);
    expect(page1[0].id).toBe(1);
    expect(page1[24].id).toBe(25);

    const page2 = paginateRequests(items, 2, 25);
    expect(page2).toHaveLength(25);
    expect(page2[0].id).toBe(26);
    expect(page2[24].id).toBe(50);

    const page3 = paginateRequests(items, 3, 25);
    expect(page3).toHaveLength(10);
    expect(page3[0].id).toBe(51);
    expect(page3[9].id).toBe(60);
  });
});

describe("countMissingTimezoneRequests", () => {
  const sitesMapWithMissingTz = new Map<number, Site>([
    ...mockSitesMap.entries(),
    [98, { id: 98, name: "Site Without Tz", timezone: "", business_hours: {} }],
  ]);

  it("counts active requests where site is unknown or timezone is missing", () => {
    const requests = [
      createMockRequest({ id: 1, site_id: 99, status: "pending" }), // unknown site
      createMockRequest({ id: 2, site_id: 98, status: "processing" }), // site has empty tz
      createMockRequest({ id: 3, site_id: 11, status: "pending" }), // valid site with tz
    ];

    expect(countMissingTimezoneRequests(requests, sitesMapWithMissingTz)).toBe(2);
  });

  it("ensures canceled, deleted, and merged requests are NOT counted as warnings", () => {
    const requests = [
      createMockRequest({ id: 1, site_id: 99, status: "pending" }), // eligible -> counted
      createMockRequest({ id: 2, site_id: 99, status: "canceled" }), // canceled -> ignored
      createMockRequest({ id: 3, site_id: 99, deleted_at: "2026-10-16T00:00:00Z" }), // deleted -> ignored
      createMockRequest({ id: 4, site_id: 99, merged_into_id: 10 }), // merged -> ignored
    ];

    expect(countMissingTimezoneRequests(requests, sitesMapWithMissingTz)).toBe(1);
  });

  it("respects active status and site filters when counting warnings", () => {
    const requests = [
      createMockRequest({ id: 1, site_id: 99, status: "pending" }),
      createMockRequest({ id: 2, site_id: 99, status: "complete" }),
      createMockRequest({ id: 3, site_id: 98, status: "pending" }),
    ];

    // Filter by status = "pending"
    expect(
      countMissingTimezoneRequests(requests, sitesMapWithMissingTz, { status: "pending" }),
    ).toBe(2);

    // Filter by status = "complete"
    expect(
      countMissingTimezoneRequests(requests, sitesMapWithMissingTz, { status: "complete" }),
    ).toBe(1);

    // Filter by siteId = 98
    expect(
      countMissingTimezoneRequests(requests, sitesMapWithMissingTz, { siteId: 98 }),
    ).toBe(1);

    // Filter by siteId = 11 (valid site with no missing tz)
    expect(
      countMissingTimezoneRequests(requests, sitesMapWithMissingTz, { siteId: 11 }),
    ).toBe(0);
  });
});
