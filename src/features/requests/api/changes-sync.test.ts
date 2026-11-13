import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/api";
import {
  applyChangesToQueryCache,
  executeChangesSyncCycle,
} from "./changes-sync";
import { ChangesSyncStorage } from "./sync-storage";
import type {
  ChangesResponse,
  EventCreatedChange,
  HelpdeskRequest,
  RequestCreatedChange,
  RequestEvent,
  RequestUpdatedChange,
  Staff,
  StaffUpdatedChange,
  UnknownChange,
} from "../types";

function mockRequest(id: number): HelpdeskRequest {
  return {
    id,
    ref: `WO-${id}`,
    title: `Request ${id}`,
    location: "Level 1",
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

function mockEvent(id: number): RequestEvent {
  return {
    id,
    status: "processing",
    at: 1791874530,
    actor_id: 304,
    actor_name: "Benjamin Tan",
    assignee_name: null,
    due_at: "07/10/2026 10:00",
    note: "Notes",
    reverts_id: null,
  };
}

describe("Changes Sync & Cache Invalidation", () => {
  const originalFetch = globalThis.fetch;
  let queryClient: QueryClient;
  let storage: ChangesSyncStorage;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    queryClient = new QueryClient();
    vi.spyOn(queryClient, "invalidateQueries");
    storage = new ChangesSyncStorage();
    storage.clearAll();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.fetch = originalFetch;
  });

  it("polls and paginates until has_more: false with limit: 500", async () => {
    const page1: ChangesResponse = {
      data: [
        {
          seq: 101,
          type: "request.created",
          at: "2026-10-01T00:00:00Z",
          request: mockRequest(1),
        } as RequestCreatedChange,
      ],
      next_cursor: "cursor_p1",
      has_more: true,
    };

    const page2: ChangesResponse = {
      data: [
        {
          seq: 102,
          type: "request.updated",
          at: "2026-10-01T01:00:00Z",
          request: mockRequest(1),
        } as RequestUpdatedChange,
      ],
      next_cursor: "cursor_p2",
      has_more: false,
    };

    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => page1,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => page2,
      } as Response);

    const result = await executeChangesSyncCycle(queryClient, storage);

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);

    // Call 1: initial run without cursor, limit: 500
    const url1 = new URL(vi.mocked(globalThis.fetch).mock.calls[0][0] as string);
    expect(url1.pathname).toContain("/v1/changes");
    expect(url1.searchParams.has("cursor")).toBe(false);
    expect(url1.searchParams.get("limit")).toBe("500");

    // Call 2: next_cursor from page 1, limit: 500
    const url2 = new URL(vi.mocked(globalThis.fetch).mock.calls[1][0] as string);
    expect(url2.searchParams.get("cursor")).toBe("cursor_p1");
    expect(url2.searchParams.get("limit")).toBe("500");

    expect(result.processedCount).toBe(2);
    expect(result.latestCursor).toBe("cursor_p2");
    expect(storage.getCursor()).toBe("cursor_p2");
    expect(storage.hasSeq(101)).toBe(true);
    expect(storage.hasSeq(102)).toBe(true);
  });

  it("deduplicates items by sequence number (seq) both within batch and across cycles", async () => {
    const page1: ChangesResponse = {
      data: [
        {
          seq: 101,
          type: "request.created",
          at: "2026-10-01T00:00:00Z",
          request: mockRequest(1),
        } as RequestCreatedChange,
        // Duplicate seq within the same page
        {
          seq: 101,
          type: "request.created",
          at: "2026-10-01T00:00:00Z",
          request: mockRequest(1),
        } as RequestCreatedChange,
      ],
      next_cursor: "cursor_p1",
      has_more: false,
    };

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => page1,
    } as Response);

    const result1 = await executeChangesSyncCycle(queryClient, storage);
    expect(result1.processedCount).toBe(1);

    // Second poll returns duplicate 101 plus new seq 102
    const page2: ChangesResponse = {
      data: [
        {
          seq: 101,
          type: "request.created",
          at: "2026-10-01T00:00:00Z",
          request: mockRequest(1),
        } as RequestCreatedChange,
        {
          seq: 102,
          type: "staff.updated",
          at: "2026-10-01T02:00:00Z",
          staff: { id: 304, name: "Benjamin Tan Updated" } as Staff,
        } as StaffUpdatedChange,
      ],
      next_cursor: "cursor_p2",
      has_more: false,
    };

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => page2,
    } as Response);

    const result2 = await executeChangesSyncCycle(queryClient, storage);
    expect(result2.processedCount).toBe(1);
    expect(storage.hasSeq(102)).toBe(true);
  });

  it("invalidates cache according to documented change types and handles unknown types safely", () => {
    // 1. Request created/updated: invalidates ["requests"] and ["request", id]
    const reqChange: RequestCreatedChange = {
      seq: 201,
      type: "request.created",
      at: "2026-10-01T00:00:00Z",
      request: mockRequest(41210),
    };
    applyChangesToQueryCache(queryClient, [reqChange]);
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["requests"],
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["request", 41210],
    });

    vi.clearAllMocks();

    // 2. Event created: invalidates ["request-events", reqId] and ["request", reqId]
    const evtChange: EventCreatedChange = {
      seq: 202,
      type: "event.created",
      at: "2026-10-01T00:00:00Z",
      request_id: 41210,
      event: mockEvent(300912),
    };
    applyChangesToQueryCache(queryClient, [evtChange]);
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["requests"],
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["request-events", 41210],
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["request", 41210],
    });

    vi.clearAllMocks();

    // 3. Staff updated: invalidates ["staff"]
    const staffChange: StaffUpdatedChange = {
      seq: 203,
      type: "staff.updated",
      at: "2026-10-01T00:00:00Z",
      staff: { id: 304, name: "Benjamin Tan" },
    };
    applyChangesToQueryCache(queryClient, [staffChange]);
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["staff"],
    });

    vi.clearAllMocks();

    // 4. Unknown change type: does not throw, safely invalidates ["requests"]
    const unknownChange: UnknownChange = {
      seq: 204,
      type: "custom.unknown_event",
      at: "2026-10-01T00:00:00Z",
      extra: 123,
    };
    expect(() =>
      applyChangesToQueryCache(queryClient, [unknownChange]),
    ).not.toThrow();
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["requests"],
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["request"],
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["request-events"],
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["sites"],
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["staff"],
    });
  });

  it("persists cursor across poll cycles and continues with saved cursor", async () => {
    storage.setCursor("persisted_cursor_1");

    const page: ChangesResponse = {
      data: [
        {
          seq: 301,
          type: "staff.updated",
          at: "2026-10-01T00:00:00Z",
          staff: { id: 304, name: "Benjamin Tan" },
        } as StaffUpdatedChange,
      ],
      next_cursor: "persisted_cursor_2",
      has_more: false,
    };

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => page,
    } as Response);

    const result = await executeChangesSyncCycle(queryClient, storage);

    const calledUrl = new URL(
      vi.mocked(globalThis.fetch).mock.calls[0][0] as string,
    );
    expect(calledUrl.searchParams.get("cursor")).toBe("persisted_cursor_1");
    expect(result.latestCursor).toBe("persisted_cursor_2");
    expect(storage.getCursor()).toBe("persisted_cursor_2");
  });

  it("handles HTTP 410 by clearing cursor, restarting without cursor, and skipping already processed seqs", async () => {
    storage.setCursor("expired_cursor_123");
    storage.addSeqs([101, 102]); // Already processed earlier

    // First request with expired cursor returns HTTP 410 Gone
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      status: 410,
      statusText: "Gone",
      headers: new Headers(),
      json: async () => ({ error: "Cursor expired" }),
    } as unknown as Response);

    // Second request (restart without cursor) succeeds and returns full feed
    const restartPage: ChangesResponse = {
      data: [
        {
          seq: 101, // already processed -> must be skipped
          type: "request.created",
          at: "2026-10-01T00:00:00Z",
          request: mockRequest(1),
        } as RequestCreatedChange,
        {
          seq: 102, // already processed -> must be skipped
          type: "request.updated",
          at: "2026-10-01T01:00:00Z",
          request: mockRequest(1),
        } as RequestUpdatedChange,
        {
          seq: 103, // new change -> must be processed
          type: "staff.updated",
          at: "2026-10-01T02:00:00Z",
          staff: { id: 304, name: "Benjamin Tan New" },
        } as StaffUpdatedChange,
      ],
      next_cursor: "brand_new_cursor",
      has_more: false,
    };

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => restartPage,
    } as Response);

    const result = await executeChangesSyncCycle(queryClient, storage);

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);

    // Call 1 used the expired cursor
    const call1Url = new URL(
      vi.mocked(globalThis.fetch).mock.calls[0][0] as string,
    );
    expect(call1Url.searchParams.get("cursor")).toBe("expired_cursor_123");

    // Call 2 restarted from beginning with NO cursor
    const call2Url = new URL(
      vi.mocked(globalThis.fetch).mock.calls[1][0] as string,
    );
    expect(call2Url.searchParams.has("cursor")).toBe(false);

    // Only seq 103 was new and processed
    expect(result.processedCount).toBe(1);
    expect(storage.getCursor()).toBe("brand_new_cursor");
    expect(storage.hasSeq(103)).toBe(true);
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["staff"],
    });
  });

  it("preserves previous cursor when a mid-cycle request fails", async () => {
    storage.setCursor("stable_cursor_v1");

    const page1: ChangesResponse = {
      data: [
        {
          seq: 401,
          type: "request.created",
          at: "2026-10-01T00:00:00Z",
          request: mockRequest(1),
        } as RequestCreatedChange,
      ],
      next_cursor: "intermediate_cursor_p1",
      has_more: true,
    };

    // Page 1 succeeds
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => page1,
    } as Response);

    // Page 2 fails mid-cycle
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      headers: new Headers(),
      json: async () => ({ error: "Server crashed" }),
    } as unknown as Response);

    await expect(
      executeChangesSyncCycle(queryClient, storage),
    ).rejects.toThrow(ApiError);

    // Storage cursor must retain previous stable cursor, NOT intermediate cursor
    expect(storage.getCursor()).toBe("stable_cursor_v1");
    // Seq 401 must not be marked as processed since cycle failed
    expect(storage.hasSeq(401)).toBe(false);
  });

  it("fails the sync cycle when has_more is true but the response has no cursor", async () => {
    storage.setCursor("stable_cursor_v1");
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [], has_more: true }),
    } as Response);

    await expect(executeChangesSyncCycle(queryClient, storage)).rejects.toThrow(
      "Invalid change feed response",
    );
    expect(storage.getCursor()).toBe("stable_cursor_v1");
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });

  it("fails safely if the feed repeats a cursor while claiming more pages", async () => {
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [], next_cursor: "stuck_cursor", has_more: true }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [], next_cursor: "stuck_cursor", has_more: true }),
      } as Response);

    await expect(executeChangesSyncCycle(queryClient, storage)).rejects.toThrow(
      "cursor did not advance",
    );
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(storage.getCursor()).toBeNull();
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });

  it("bounds processed sequence memory to the latest 5,000 values", () => {
    storage.addSeqs(Array.from({ length: 5001 }, (_, index) => index + 1));

    expect(storage.getProcessedSeqs()).toHaveLength(5000);
    expect(storage.hasSeq(1)).toBe(false);
    expect(storage.hasSeq(2)).toBe(true);
    expect(storage.hasSeq(5001)).toBe(true);
  });

  it("safely falls back to in-memory storage if window is undefined or sessionStorage throws", () => {
    // Case 1: Node environment where window is undefined
    const nodeStorage = new ChangesSyncStorage();
    nodeStorage.setCursor("node_cursor");
    expect(nodeStorage.getCursor()).toBe("node_cursor");
    nodeStorage.addSeqs([1, 2]);
    expect(nodeStorage.hasSeq(1)).toBe(true);
    expect(nodeStorage.hasSeq(3)).toBe(false);

    // Case 2: Browser environment where sessionStorage throws (SecurityError / QuotaExceeded)
    const throwingSessionStorage = {
      getItem: vi.fn(() => {
        throw new Error("SecurityError: Access is denied");
      }),
      setItem: vi.fn(() => {
        throw new Error("QuotaExceededError");
      }),
      removeItem: vi.fn(() => {
        throw new Error("SecurityError");
      }),
    };

    vi.stubGlobal("window", {
      sessionStorage: throwingSessionStorage,
    });

    const fallbackStorage = new ChangesSyncStorage();
    fallbackStorage.setCursor("fallback_cursor_1");
    expect(fallbackStorage.getCursor()).toBe("fallback_cursor_1");

    fallbackStorage.addSeqs([501, 502]);
    expect(fallbackStorage.hasSeq(501)).toBe(true);
    expect(fallbackStorage.hasSeq(502)).toBe(true);
    expect(fallbackStorage.hasSeq(503)).toBe(false);

    fallbackStorage.clearCursor();
    expect(fallbackStorage.getCursor()).toBeNull();
  });
});
