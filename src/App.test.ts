import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseUrlState, syncUrlState } from "./App";

describe("URL synchronization", () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    // Mock browser window and history
    const mockLocation = new URL("http://localhost:5173/");
    const mockHistory = {
      replaceState: vi.fn((_state: unknown, _title: string, url: string) => {
        mockLocation.href = new URL(url, mockLocation.origin).href;
      }),
    };

    vi.stubGlobal("window", {
      location: mockLocation,
      history: mockHistory,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.window = originalWindow;
  });

  it("parses default values when query string is empty", () => {
    window.location.search = "";
    const state = parseUrlState();

    expect(state.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(state.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(state.siteId).toBeNull();
    expect(state.status).toBe("all");
    expect(state.sortField).toBe("created");
    expect(state.sortDirection).toBe("desc");
    expect(state.page).toBe(1);
  });

  it("parses valid parameters from URL search string including page", () => {
    window.location.href =
      "http://localhost:5173/?from=2026-10-01&to=2026-10-31&site=12&status=pending&sort=due&direction=asc&page=3";
    window.location.search =
      "?from=2026-10-01&to=2026-10-31&site=12&status=pending&sort=due&direction=asc&page=3";

    const state = parseUrlState();

    expect(state.from).toBe("2026-10-01");
    expect(state.to).toBe("2026-10-31");
    expect(state.siteId).toBe(12);
    expect(state.status).toBe("pending");
    expect(state.sortField).toBe("due");
    expect(state.sortDirection).toBe("asc");
    expect(state.page).toBe(3);
  });

  it("falls back gracefully when URL parameters are invalid", () => {
    window.location.href =
      "http://localhost:5173/?from=invalid-date&to=bad&site=notanumber&status=unknown&sort=invalid&direction=unknown&page=bad";
    window.location.search =
      "?from=invalid-date&to=bad&site=notanumber&status=unknown&sort=invalid&direction=unknown&page=bad";

    const state = parseUrlState();

    expect(state.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(state.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(state.siteId).toBeNull();
    expect(state.status).toBe("all");
    expect(state.sortField).toBe("created");
    expect(state.sortDirection).toBe("desc");
    expect(state.page).toBe(1);
  });

  it("falls back page to 1 when page is zero or negative", () => {
    window.location.search = "?page=0";
    expect(parseUrlState().page).toBe(1);

    window.location.search = "?page=-4";
    expect(parseUrlState().page).toBe(1);
  });

  it("synchronizes board state back to URL query parameters", () => {
    syncUrlState({
      from: "2026-10-05",
      to: "2026-10-25",
      siteId: 11,
      status: "processing",
      sortField: "due",
      sortDirection: "asc",
      page: 2,
    });

    expect(window.history.replaceState).toHaveBeenCalledWith(
      null,
      "",
      "/?from=2026-10-05&to=2026-10-25&site=11&status=processing&sort=due&direction=asc&page=2",
    );
  });

  it("omits site and status when set to all / default but preserves page", () => {
    syncUrlState({
      from: "2026-10-01",
      to: "2026-10-31",
      siteId: null,
      status: "all",
      sortField: "created",
      sortDirection: "desc",
      page: 1,
    });

    expect(window.history.replaceState).toHaveBeenCalledWith(
      null,
      "",
      "/?from=2026-10-01&to=2026-10-31&sort=created&direction=desc&page=1",
    );
  });
});
