import type { Status } from "@/types";
import { daysAgo, isValidIsoDate } from "./dates";
import type { SortDirection, SortField } from "./rules";

export interface BoardState {
  from: string;
  to: string;
  siteId: number | null;
  status: Status | "all";
  sortField: SortField;
  sortDirection: SortDirection;
  page: number;
}

export function parseUrlState(): BoardState {
  if (typeof window === "undefined") {
    return {
      from: daysAgo(30),
      to: daysAgo(0),
      siteId: null,
      status: "all",
      sortField: "created",
      sortDirection: "desc",
      page: 1,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const fromParam = params.get("from");
  const toParam = params.get("to");
  const siteParam = params.get("site");
  const statusParam = params.get("status");
  const sortParam = params.get("sort");
  const dirParam = params.get("direction");
  const pageParam = params.get("page");

  const from = fromParam && isValidIsoDate(fromParam) ? fromParam : daysAgo(30);
  const to = toParam && isValidIsoDate(toParam) ? toParam : daysAgo(0);
  const siteId = siteParam && /^\d+$/.test(siteParam) ? Number(siteParam) : null;
  const status =
    statusParam && ["pending", "processing", "complete"].includes(statusParam)
      ? (statusParam as Status)
      : "all";
  const sortField: SortField = sortParam === "due" ? "due" : "created";
  const sortDirection: SortDirection = dirParam === "asc" ? "asc" : "desc";
  const page = pageParam && /^[1-9]\d*$/.test(pageParam) ? Number(pageParam) : 1;

  return { from, to, siteId, status, sortField, sortDirection, page };
}

export function syncUrlState(state: BoardState): void {
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

  const newSearch = url.search;
  if (window.location.search !== newSearch) {
    window.history.replaceState(null, "", url.pathname + newSearch);
  }
}
