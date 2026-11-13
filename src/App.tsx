import { useEffect, useMemo, useState } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import {
  ApiError,
  configured,
  fetchAllRequests,
  getQueryRetryDelay,
  listSites,
  listStaff,
  shouldRetryQuery,
} from "./api";
import { daysAgo, formatSiteDateTime, isValidIsoDate, toApiDate } from "./lib/dates";
import {
  clampPage,
  countMissingTimezoneRequests,
  filterAndSortRequests,
  isRequestOverdue,
  PAGE_SIZE,
  paginateRequests,
  resolveAssigneeName,
  type SortDirection,
  type SortField,
} from "./lib/rules";
import type { HelpdeskRequest, Site, Staff, Status } from "./types";

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

export function Board() {
  const [state, setState] = useState<BoardState>(parseUrlState);

  // Sync state to URL and listen to popstate for browser navigation
  useEffect(() => {
    syncUrlState(state);
  }, [state]);

  useEffect(() => {
    const handlePopState = () => {
      setState(parseUrlState());
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const isDateRangeValid =
    isValidIsoDate(state.from) && isValidIsoDate(state.to) && state.from <= state.to;

  // Load sites
  const sitesQuery = useQuery({
    queryKey: ["sites"],
    queryFn: listSites,
    staleTime: 5 * 60 * 1000,
  });

  // Load staff for resolving assignee names
  const staffQuery = useQuery({
    queryKey: ["staff"],
    queryFn: listStaff,
    staleTime: 5 * 60 * 1000,
  });

  // Load requests across every required page using documented DD/MM/YYYY format
  const requestsQuery = useQuery({
    queryKey: ["requests", state.from, state.to],
    queryFn: () =>
      fetchAllRequests({
        created_from: toApiDate(state.from),
        created_to: toApiDate(state.to),
      }),
    enabled: isDateRangeValid,
  });

  const sitesMap = useMemo(() => {
    const map = new Map<number, Site>();
    if (sitesQuery.data?.data) {
      for (const site of sitesQuery.data.data) {
        map.set(site.id, site);
      }
    }
    return map;
  }, [sitesQuery.data]);

  const staffMap = useMemo(() => {
    const map = new Map<number, Staff>();
    if (staffQuery.data?.data) {
      for (const staff of staffQuery.data.data) {
        map.set(staff.id, staff);
      }
    }
    return map;
  }, [staffQuery.data]);

  const sitesList: Site[] = sitesQuery.data?.data ?? [];

  // Filter and sort requests according to Rule 1 and Board options
  const filteredRequests = useMemo(() => {
    if (!requestsQuery.data) return [];
    return filterAndSortRequests(requestsQuery.data, sitesMap, {
      fromDate: state.from,
      toDate: state.to,
      siteId: state.siteId,
      status: state.status,
      sortField: state.sortField,
      sortDirection: state.sortDirection,
    });
  }, [requestsQuery.data, sitesMap, state.from, state.to, state.siteId, state.status, state.sortField, state.sortDirection]);

  // Pagination calculation and clamping
  const totalRows = filteredRequests.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));

  const missingTimezoneCount = useMemo(() => {
    if (!sitesQuery.isSuccess || !requestsQuery.data) return 0;
    return countMissingTimezoneRequests(requestsQuery.data, sitesMap, {
      siteId: state.siteId,
      status: state.status,
    });
  }, [sitesQuery.isSuccess, requestsQuery.data, sitesMap, state.siteId, state.status]);

  useEffect(() => {
    if (requestsQuery.isLoading) return;
    if (state.page > totalPages) {
      setState((prev) => ({ ...prev, page: totalPages }));
    } else if (state.page < 1) {
      setState((prev) => ({ ...prev, page: 1 }));
    }
  }, [requestsQuery.isLoading, state.page, totalPages]);

  const currentPage = clampPage(state.page, totalRows, PAGE_SIZE);
  const paginatedRequests = paginateRequests(filteredRequests, currentPage, PAGE_SIZE);
  const startRow = totalRows === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const endRow = Math.min(currentPage * PAGE_SIZE, totalRows);

  const isLoading = requestsQuery.isLoading || sitesQuery.isLoading || staffQuery.isLoading;
  const isRetrying = requestsQuery.isFetching && requestsQuery.failureCount > 0;

  const activeError = requestsQuery.error || sitesQuery.error || staffQuery.error;
  const errorMessage = activeError
    ? activeError instanceof ApiError
      ? `${activeError.status}: ${activeError.message}`
      : activeError instanceof Error
        ? activeError.message
        : String(activeError)
    : null;

  const toggleSort = (field: SortField) => {
    setState((prev) => {
      if (prev.sortField === field) {
        return {
          ...prev,
          sortDirection: prev.sortDirection === "asc" ? "desc" : "asc",
          page: 1, // Reset page on sort change
        };
      }
      return {
        ...prev,
        sortField: field,
        sortDirection: field === "created" ? "desc" : "asc",
        page: 1, // Reset page on sort change
      };
    });
  };

  return (
    <main>
      <h1>Requests board</h1>

      {/* Filter and sorting toolbar */}
      <form
        className="toolbar"
        role="search"
        aria-label="Filter and sort requests"
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="filter-group">
          <label htmlFor="filter-from">From</label>
          <input
            id="filter-from"
            type="date"
            value={state.from}
            aria-label="From date"
            onChange={(e) =>
              setState((prev) => ({ ...prev, from: e.target.value, page: 1 }))
            }
          />
        </div>

        <div className="filter-group">
          <label htmlFor="filter-to">To</label>
          <input
            id="filter-to"
            type="date"
            value={state.to}
            aria-label="To date"
            onChange={(e) =>
              setState((prev) => ({ ...prev, to: e.target.value, page: 1 }))
            }
          />
        </div>

        <div className="filter-group">
          <label htmlFor="filter-site">Site</label>
          <select
            id="filter-site"
            value={state.siteId ?? ""}
            aria-label="Filter by site"
            onChange={(e) =>
              setState((prev) => ({
                ...prev,
                siteId: e.target.value ? Number(e.target.value) : null,
                page: 1,
              }))
            }
          >
            <option value="">All sites</option>
            {sitesList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="filter-status">Status</label>
          <select
            id="filter-status"
            value={state.status}
            aria-label="Filter by status"
            onChange={(e) =>
              setState((prev) => ({
                ...prev,
                status: e.target.value as Status | "all",
                page: 1,
              }))
            }
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="complete">Complete</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="sort-field">Sort by</label>
          <select
            id="sort-field"
            value={state.sortField}
            aria-label="Sort by field"
            onChange={(e) =>
              setState((prev) => ({
                ...prev,
                sortField: e.target.value as SortField,
                page: 1,
              }))
            }
          >
            <option value="created">Created date</option>
            <option value="due">Due date</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="sort-direction">Direction</label>
          <select
            id="sort-direction"
            value={state.sortDirection}
            aria-label="Sort direction"
            onChange={(e) =>
              setState((prev) => ({
                ...prev,
                sortDirection: e.target.value as SortDirection,
                page: 1,
              }))
            }
          >
            <option value="desc">Newest first (Descending)</option>
            <option value="asc">Oldest first (Ascending)</option>
          </select>
        </div>
      </form>

      {/* Date range validation hint */}
      {!isDateRangeValid && (
        <div role="alert" className="error-banner">
          Please enter a valid date range (From date must be on or before To date).
        </div>
      )}

      {/* Retry indicator while query retry is pending */}
      {isRetrying && (
        <div role="status" className="retry-banner">
          Temporary API error or rate limit encountered. Retrying in background…
        </div>
      )}

      {/* Warning for otherwise eligible requests missing site/timezone */}
      {missingTimezoneCount > 0 && (
        <div role="status" className="warning-banner" aria-live="polite">
          <strong>Data Quality Warning:</strong> {missingTimezoneCount} request
          {missingTimezoneCount === 1 ? "" : "s"} could not be date-filtered because site or timezone data is missing. Their inclusion in the selected date range cannot be determined.
        </div>
      )}

      {/* Summary status text */}
      <p className="muted" role="status" aria-live="polite">
        {state.from} to {state.to}.{" "}
        {isLoading
          ? "Loading…"
          : `${totalRows} request${totalRows === 1 ? "" : "s"}${
              requestsQuery.data && totalRows !== requestsQuery.data.length
                ? ` (filtered from ${requestsQuery.data.length} loaded)`
                : ""
            }.`}
      </p>

      {/* Error state */}
      {errorMessage && (
        <div role="alert" className="error-banner">
          Could not load requests: {errorMessage}
        </div>
      )}

      {/* Loading state indicator */}
      {isLoading && (
        <div role="status" aria-live="polite" className="loading-banner">
          Loading requests…
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !errorMessage && totalRows === 0 && (
        <div role="status" className="empty-state">
          No requests found matching the selected filters.
        </div>
      )}

      {/* Requests table */}
      {!isLoading && totalRows > 0 && (
        <>
          <div
            className="table-container"
            tabIndex={0}
            role="region"
            aria-label="Requests table"
          >
            <table>
              <caption className="sr-only">Helpdesk Requests</caption>
              <thead>
                <tr>
                  <th scope="col">Site</th>
                  <th scope="col">Ref</th>
                  <th scope="col">Title</th>
                  <th scope="col">Priority</th>
                  <th scope="col">Status</th>
                  <th scope="col">Assignee</th>
                  <th
                    scope="col"
                    aria-sort={
                      state.sortField === "due"
                        ? state.sortDirection === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      type="button"
                      className="th-button"
                      aria-label={`Sort by due date, currently ${
                        state.sortField === "due" ? state.sortDirection : "unsorted"
                      }`}
                      onClick={() => toggleSort("due")}
                    >
                      Due {state.sortField === "due" ? (state.sortDirection === "asc" ? "▲" : "▼") : ""}
                    </button>
                  </th>
                  <th scope="col">Overdue</th>
                  <th
                    scope="col"
                    aria-sort={
                      state.sortField === "created"
                        ? state.sortDirection === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      type="button"
                      className="th-button"
                      aria-label={`Sort by created date, currently ${
                        state.sortField === "created" ? state.sortDirection : "unsorted"
                      }`}
                      onClick={() => toggleSort("created")}
                    >
                      Created {state.sortField === "created" ? (state.sortDirection === "asc" ? "▲" : "▼") : ""}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedRequests.map((r: HelpdeskRequest) => {
                  const site = sitesMap.get(r.site_id);
                  const siteName =
                    site?.name ??
                    (sitesQuery.isLoading ? "Loading…" : `Site ${r.site_id}`);
                  const siteTimezone = site?.timezone;
                  const overdue = isRequestOverdue(r, siteTimezone);
                  // Rule 3: Resolve assignee name strictly by id from staff endpoint
                  const assigneeName = resolveAssigneeName(r.assignee, staffMap);

                  return (
                    <tr key={r.id} className={overdue === true ? "row-overdue" : undefined}>
                      <td>{siteName}</td>
                      <td>{r.ref}</td>
                      <td>{r.title}</td>
                      <td>
                        {r.priority ? (
                          <span className={`badge badge-priority-${r.priority.toLowerCase()}`}>
                            {r.priority}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <span className={`badge badge-status-${r.status}`}>
                          {r.status}
                        </span>
                      </td>
                      <td>{assigneeName}</td>
                      <td>{r.due_on ?? "—"}</td>
                      <td>
                        {overdue === true ? (
                          <span className="badge badge-overdue" role="status">
                            Overdue
                          </span>
                        ) : overdue === null ? (
                          <span
                            className="badge badge-warning"
                            title="Cannot determine overdue status without site timezone"
                          >
                            Missing timezone
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {siteTimezone ? (
                          formatSiteDateTime(r.created_at, siteTimezone)
                        ) : (
                          <span className="muted">Missing timezone</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <nav className="pagination" aria-label="Requests pagination">
            <div className="pagination-info" role="status" aria-live="polite">
              Showing {startRow}–{endRow} of {totalRows} requests
            </div>
            <div className="pagination-controls">
              <button
                type="button"
                className="btn-pagination"
                onClick={() =>
                  setState((prev) => ({
                    ...prev,
                    page: Math.max(1, prev.page - 1),
                  }))
                }
                disabled={currentPage <= 1}
                aria-label="Previous page"
              >
                Previous
              </button>
              <span className="pagination-current-page" aria-current="page">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                className="btn-pagination"
                onClick={() =>
                  setState((prev) => ({
                    ...prev,
                    page: Math.min(totalPages, prev.page + 1),
                  }))
                }
                disabled={currentPage >= totalPages}
                aria-label="Next page"
              >
                Next
              </button>
            </div>
          </nav>
        </>
      )}
    </main>
  );
}

export default function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: shouldRetryQuery,
            retryDelay: getQueryRetryDelay,
          },
        },
      }),
  );

  if (!configured()) {
    return (
      <main>
        <p>
          Save <code>HELPDESK_URL</code> and <code>HELPDESK_TOKEN</code> in <code>.env</code>, then restart <code>npm run dev</code>.
        </p>
      </main>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Board />
    </QueryClientProvider>
  );
}
