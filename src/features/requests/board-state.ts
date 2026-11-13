import type { Status } from "@/features/requests/types";
import { browserLocalDaysAgo, isValidIsoDate } from "./dates";
import type { SortDirection, SortField } from "./rules";

export interface BoardState {
  from: string;
  to: string;
  siteId: number | null;
  status: Status | "all";
  sortField: SortField;
  sortDirection: SortDirection;
  page: number;
  requestId?: number | null;
}

export function createDefaultBoardState(): BoardState {
  return {
    // The selected range includes today, so 29 days back gives 30 calendar days total.
    from: browserLocalDaysAgo(29),
    to: browserLocalDaysAgo(0),
    siteId: null,
    status: "all",
    sortField: "created",
    sortDirection: "desc",
    page: 1,
    requestId: null,
  };
}

export function parseUrlState(): BoardState {
  if (typeof window === "undefined") return createDefaultBoardState();

  const params = new URLSearchParams(window.location.search);
  const fromParam = params.get("from");
  const toParam = params.get("to");
  const siteParam = params.get("site");
  const statusParam = params.get("status");
  const sortParam = params.get("sort");
  const dirParam = params.get("direction");
  const pageParam = params.get("page");
  const requestParam = params.get("requestId") || params.get("request");

  const from = fromParam && isValidIsoDate(fromParam) ? fromParam : browserLocalDaysAgo(29);
  const to = toParam && isValidIsoDate(toParam) ? toParam : browserLocalDaysAgo(0);
  const siteId = siteParam && /^\d+$/.test(siteParam) ? Number(siteParam) : null;
  const status =
    statusParam && ["pending", "processing", "complete"].includes(statusParam)
      ? (statusParam as Status)
      : "all";
  const sortField: SortField = sortParam === "due" ? "due" : "created";
  const sortDirection: SortDirection = dirParam === "asc" ? "asc" : "desc";
  const page = pageParam && /^[1-9]\d*$/.test(pageParam) ? Number(pageParam) : 1;
  const requestId = requestParam && /^\d+$/.test(requestParam) ? Number(requestParam) : null;

  return { from, to, siteId, status, sortField, sortDirection, page, requestId };
}

export function syncUrlState(state: BoardState, push = false): void {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);

  url.searchParams.set("from", state.from);
  url.searchParams.set("to", state.to);

  if (state.siteId !== null) {
    url.searchParams.set("site", String(state.siteId));
  } else {
    url.searchParams.delete("site");
  }

  if (state.status !== "all") {
    url.searchParams.set("status", state.status);
  } else {
    url.searchParams.delete("status");
  }

  url.searchParams.set("sort", state.sortField);
  url.searchParams.set("direction", state.sortDirection);
  url.searchParams.set("page", String(state.page));

  if (state.requestId !== null && state.requestId !== undefined) {
    url.searchParams.set("requestId", String(state.requestId));
  } else {
    url.searchParams.delete("requestId");
    url.searchParams.delete("request");
  }

  const newSearch = url.search;
  const newHref = url.pathname + newSearch;
  const currentHref = window.location.pathname + window.location.search;

  if (currentHref !== newHref) {
    if (push) {
      window.history.pushState(null, "", newHref);
    } else {
      window.history.replaceState(null, "", newHref);
    }
  }
}
