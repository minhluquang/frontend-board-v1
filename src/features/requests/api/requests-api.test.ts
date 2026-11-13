import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  getQueryRetryDelay,
  parseRetryAfterSeconds,
  shouldRetryQuery,
} from "@/api";
import { fetchAllRequestEvents, fetchAllRequests } from "./requests-api";
import type { HelpdeskRequest, Page, RequestEvent } from "../types";

function createMockReq(id: number): HelpdeskRequest {
  return {
    id,
    ref: `WO-${id}`,
    title: `Request ${id}`,
    location: "L1",
    site_id: 11,
    status: "pending",
    priority: "Medium",
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    due_on: null,
    assignee: null,
    deleted_at: null,
    merged_into_id: null,
  };
}

describe("fetchAllRequests", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.fetch = originalFetch;
  });

  it("returns requests for a single page response", async () => {
    const pageResponse: Page<HelpdeskRequest> = {
      data: [createMockReq(1), createMockReq(2)],
      page: 1,
      per_page: 100,
      total_pages: 1,
      total: 2,
    };

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => pageResponse,
    } as Response);

    const result = await fetchAllRequests({ created_from: "01/10/2026", created_to: "31/10/2026" });

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual([1, 2]);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    const calledUrl = new URL(vi.mocked(globalThis.fetch).mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get("created_from")).toBe("01/10/2026");
    expect(calledUrl.searchParams.get("created_to")).toBe("31/10/2026");
    expect(calledUrl.searchParams.get("page")).toBe("1");
  });

  it("fetches every page when multiple pages exist", async () => {
    const page1: Page<HelpdeskRequest> = {
      data: [createMockReq(10), createMockReq(11)],
      page: 1,
      per_page: 2,
      total_pages: 3,
      total: 6,
    };
    const page2: Page<HelpdeskRequest> = {
      data: [createMockReq(12), createMockReq(13)],
      page: 2,
      per_page: 2,
      total_pages: 3,
      total: 6,
    };
    const page3: Page<HelpdeskRequest> = {
      data: [createMockReq(14), createMockReq(15)],
      page: 3,
      per_page: 2,
      total_pages: 3,
      total: 6,
    };

    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => page1 } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => page2 } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => page3 } as Response);

    const result = await fetchAllRequests({ created_from: "01/10/2026", created_to: "31/10/2026" });

    expect(result).toHaveLength(6);
    expect(result.map((r) => r.id)).toEqual([10, 11, 12, 13, 14, 15]);
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  it("handles has_more pagination when total_pages is omitted", async () => {
    const page1: Page<HelpdeskRequest> = {
      data: [createMockReq(1)],
      page: 1,
      per_page: 1,
      has_more: true,
    };
    const page2: Page<HelpdeskRequest> = {
      data: [createMockReq(2)],
      page: 2,
      per_page: 1,
      has_more: false,
    };

    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => page1 } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => page2 } as Response);

    const result = await fetchAllRequests();

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual([1, 2]);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("throws ApiError when fetch fails", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      headers: new Headers({ "Retry-After": "10" }),
      json: async () => ({ error: "Rate limit exceeded" }),
    } as unknown as Response);

    await expect(fetchAllRequests()).rejects.toThrow(ApiError);
  });
});

describe("fetchAllRequestEvents", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.fetch = originalFetch;
  });

  function createMockEvent(id: number): RequestEvent {
    return {
      id,
      status: "processing",
      at: 1791874530 + id,
      actor_id: 304,
      actor_name: "Benjamin Tan",
      assignee_name: null,
      due_at: "07/10/2026 10:00",
      note: `Event note ${id}`,
      reverts_id: null,
    };
  }

  it("loads single page when has_more is false", async () => {
    const page1: Page<RequestEvent> = {
      data: [createMockEvent(1), createMockEvent(2)],
      page: 1,
      per_page: 50,
      has_more: false,
    };

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => page1,
    } as Response);

    const events = await fetchAllRequestEvents(41210);

    expect(events).toHaveLength(2);
    expect(events.map((e) => e.id)).toEqual([1, 2]);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    const calledUrl = new URL(vi.mocked(globalThis.fetch).mock.calls[0][0] as string);
    expect(calledUrl.pathname).toContain("/v1/requests/41210/events");
    expect(calledUrl.searchParams.get("page")).toBe("1");
  });

  it("loads every page across pagination using has_more", async () => {
    const page1: Page<RequestEvent> = {
      data: [createMockEvent(101), createMockEvent(102)],
      page: 1,
      per_page: 2,
      has_more: true,
    };
    const page2: Page<RequestEvent> = {
      data: [createMockEvent(103), createMockEvent(104)],
      page: 2,
      per_page: 2,
      has_more: true,
    };
    const page3: Page<RequestEvent> = {
      data: [createMockEvent(105)],
      page: 3,
      per_page: 2,
      has_more: false,
    };

    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => page1 } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => page2 } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => page3 } as Response);

    const events = await fetchAllRequestEvents(41210);

    expect(events).toHaveLength(5);
    expect(events.map((e) => e.id)).toEqual([101, 102, 103, 104, 105]);
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  it("throws ApiError when fetch fails", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      headers: new Headers(),
      json: async () => ({ error: "Database error" }),
    } as unknown as Response);

    await expect(fetchAllRequestEvents(41210)).rejects.toThrow(ApiError);
  });
});

describe("Query retry policy (shouldRetryQuery and getQueryRetryDelay)", () => {
  it("parses only finite non-negative Retry-After values", () => {
    expect(parseRetryAfterSeconds("15")).toBe(15);
    expect(parseRetryAfterSeconds("0")).toBe(0);
    expect(parseRetryAfterSeconds(null)).toBeNull();
    expect(parseRetryAfterSeconds("")).toBeNull();
    expect(parseRetryAfterSeconds("-1")).toBeNull();
    expect(parseRetryAfterSeconds("invalid")).toBeNull();
    expect(parseRetryAfterSeconds("Infinity")).toBeNull();
  });

  it("never retries ordinary 4xx client errors even on first failure (failureCount: 0)", () => {
    expect(shouldRetryQuery(0, new ApiError(400, "Bad Request"))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError(401, "Unauthorized"))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError(403, "Forbidden"))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError(404, "Not Found"))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError(410, "Gone"))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError(422, "Unprocessable Entity"))).toBe(false);
  });

  it("allows exactly two retries (failureCount 0 and 1) and rejects the third retry (failureCount 2)", () => {
    const error429 = new ApiError(429, "Rate limit", 5);
    const error500 = new ApiError(500, "Internal Server Error");
    const networkError = new Error("Failed to fetch");

    // First retry attempt (failureCount = 0) is allowed
    expect(shouldRetryQuery(0, error429)).toBe(true);
    expect(shouldRetryQuery(0, error500)).toBe(true);
    expect(shouldRetryQuery(0, networkError)).toBe(true);

    // Second retry attempt (failureCount = 1) is allowed
    expect(shouldRetryQuery(1, error429)).toBe(true);
    expect(shouldRetryQuery(1, error500)).toBe(true);
    expect(shouldRetryQuery(1, networkError)).toBe(true);

    // Third retry attempt (failureCount = 2) is rejected
    expect(shouldRetryQuery(2, error429)).toBe(false);
    expect(shouldRetryQuery(2, error500)).toBe(false);
    expect(shouldRetryQuery(2, networkError)).toBe(false);

    // Any subsequent attempt is also rejected
    expect(shouldRetryQuery(3, error429)).toBe(false);
    expect(shouldRetryQuery(4, error500)).toBe(false);
  });

  it("honors valid non-negative Retry-After for HTTP 429, including values above 60s", () => {
    // 5 seconds -> 5000ms
    expect(getQueryRetryDelay(0, new ApiError(429, "Rate limit", 5))).toBe(5000);
    // 15 seconds -> 15000ms
    expect(getQueryRetryDelay(1, new ApiError(429, "Rate limit", 15))).toBe(15000);
    // 90 seconds (above 60s cap) -> 90000ms honored without artificial capping
    expect(getQueryRetryDelay(0, new ApiError(429, "Rate limit", 90))).toBe(90000);
    // 0 seconds -> 0ms
    expect(getQueryRetryDelay(0, new ApiError(429, "Rate limit", 0))).toBe(0);
  });

  it("handles missing or invalid Retry-After explicitly by falling back to exponential backoff", () => {
    // Missing Retry-After (null)
    expect(getQueryRetryDelay(0, new ApiError(429, "Rate limit", null))).toBe(1000);
    expect(getQueryRetryDelay(1, new ApiError(429, "Rate limit", null))).toBe(2000);

    // Invalid negative Retry-After
    expect(getQueryRetryDelay(0, new ApiError(429, "Rate limit", -10))).toBe(1000);
    // Non-finite Retry-After is invalid
    expect(getQueryRetryDelay(0, new ApiError(429, "Rate limit", Infinity))).toBe(1000);
  });

  it("calculates exponential backoff for non-429 errors starting at 1s and increasing on each retry", () => {
    const serverError = new ApiError(500, "Server Error");
    const networkError = new Error("Network timeout");

    // Retry #1 (failureCount: 0) starts at 1 second
    expect(getQueryRetryDelay(0, serverError)).toBe(1000);
    expect(getQueryRetryDelay(0, networkError)).toBe(1000);

    // Retry #2 (failureCount: 1) increases to 2 seconds
    expect(getQueryRetryDelay(1, serverError)).toBe(2000);
    expect(getQueryRetryDelay(1, networkError)).toBe(2000);

    // Retry #3 (failureCount: 2) increases to 4 seconds
    expect(getQueryRetryDelay(2, serverError)).toBe(4000);
  });
});
