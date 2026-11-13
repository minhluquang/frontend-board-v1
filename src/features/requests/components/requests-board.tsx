import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "@/api";
import { Button } from "@/components/ui/button";
import type { Site, Staff } from "@/features/requests/types";
import { createDefaultBoardState, parseUrlState, syncUrlState, type BoardState } from "../board-state";
import { isValidIsoDate } from "../dates";
import { useRequestsQuery, useSitesQuery, useStaffQuery } from "../hooks/queries";
import {
  clampPage,
  countMissingTimezoneRequests,
  filterAndSortRequests,
  paginateRequests,
  type SortField,
} from "../rules";
import { RequestsPagination } from "./requests-pagination";
import { RequestsStatusTabs } from "./requests-status-tabs";
import { RequestsTable } from "./requests-table";
import { RequestsToolbar } from "./requests-toolbar";
import { RequestDetail } from "./request-detail";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return `${error.status}: ${error.message}`;
  if (error instanceof Error) return error.message;
  return String(error);
}

interface QueryErrorNoticeProps {
  resource: string;
  error: unknown;
  hasData: boolean;
  onRetry: () => void;
}

function QueryErrorNotice({ resource, error, hasData, onRetry }: QueryErrorNoticeProps) {
  return (
    <div
      role="alert"
      className="my-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive"
    >
      <p className="min-w-0 break-words">
        {hasData
          ? `Could not refresh ${resource}. Showing the last available data.`
          : `Could not load ${resource}.`} {getErrorMessage(error)}
      </p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        Retry {resource}
      </Button>
    </div>
  );
}

export function RequestsBoard() {
  const [state, setState] = useState<BoardState>(parseUrlState);
  const [pageSize, setPageSize] = useState(10);
  const boardHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousRequestId = useRef(state.requestId ?? null);

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

  useEffect(() => {
    if (previousRequestId.current !== null && state.requestId == null) {
      boardHeadingRef.current?.focus();
    }
    previousRequestId.current = state.requestId ?? null;
  }, [state.requestId]);

  const isDateRangeValid =
    isValidIsoDate(state.from) && isValidIsoDate(state.to) && state.from <= state.to;

  // Load sites
  const sitesQuery = useSitesQuery();

  // Load staff for resolving assignee names
  const staffQuery = useStaffQuery();

  // Load requests across every required page using documented DD/MM/YYYY format
  const requestsQuery = useRequestsQuery(state.from, state.to, isDateRangeValid);

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

  // Filter requests by date/site first so the status tabs show matching counts.
  const matchingRequests = useMemo(() => {
    if (!requestsQuery.data) return [];
    return filterAndSortRequests(requestsQuery.data, sitesMap, {
      fromDate: state.from,
      toDate: state.to,
      siteId: state.siteId,
      status: "all",
      sortField: state.sortField,
      sortDirection: state.sortDirection,
    });
  }, [
    requestsQuery.data,
    sitesMap,
    state.from,
    state.to,
    state.siteId,
    state.sortField,
    state.sortDirection,
  ]);

  const statusCounts = useMemo(() => ({
    all: matchingRequests.length,
    pending: matchingRequests.filter((request) => request.status === "pending").length,
    processing: matchingRequests.filter((request) => request.status === "processing").length,
    complete: matchingRequests.filter((request) => request.status === "complete").length,
  }), [matchingRequests]);

  const filteredRequests = useMemo(
    () => state.status === "all"
      ? matchingRequests
      : matchingRequests.filter((request) => request.status === state.status),
    [matchingRequests, state.status],
  );

  // Pagination calculation and clamping
  const totalRows = filteredRequests.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

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
  }, [requestsQuery.isLoading, state.page, totalPages, pageSize]);

  const currentPage = clampPage(state.page, totalRows, pageSize);
  const paginatedRequests = paginateRequests(filteredRequests, currentPage, pageSize);
  const startRow = totalRows === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRow = Math.min(currentPage * pageSize, totalRows);

  // Requests need site data for correct site-local date filtering; staff can load in parallel.
  const isLoading = requestsQuery.isLoading || sitesQuery.isLoading;
  const isRetrying = [requestsQuery, sitesQuery, staffQuery].some(
    (query) => query.isFetching && query.failureCount > 0,
  );

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

  const resetBoard = () => {
    setState(createDefaultBoardState());
    setPageSize(10);
  };

  const handleSelectRequest = (id: number) => {
    const nextState: BoardState = { ...state, requestId: id };
    syncUrlState(nextState, true);
    setState(nextState);
  };

  const handleBackToBoard = () => {
    const nextState: BoardState = { ...state, requestId: null };
    syncUrlState(nextState, false);
    setState(nextState);
  };

  if (typeof state.requestId === "number" && !isNaN(state.requestId)) {
    return (
      <RequestDetail
        requestId={state.requestId}
        sitesMap={sitesMap}
        staffMap={staffMap}
        sitesLoading={sitesQuery.isLoading}
        staffLoading={staffQuery.isLoading}
        sitesError={sitesQuery.error}
        staffError={staffQuery.error}
        onRetrySites={() => void sitesQuery.refetch()}
        onRetryStaff={() => void staffQuery.refetch()}
        onBack={handleBackToBoard}
      />
    );
  }

  return (
    <div className="w-full">
      <div className="mb-5">
        <h1
          ref={boardHeadingRef}
          tabIndex={-1}
          className="text-2xl font-semibold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Requests board
        </h1>
      </div>

      <RequestsStatusTabs
        value={state.status === "canceled" ? "all" : state.status}
        counts={statusCounts}
        loading={isLoading || !requestsQuery.data}
        onChange={(status) =>
          setState((prev) => ({ ...prev, status, page: 1 }))
        }
      />

      {/* Filter and sorting toolbar */}
      <RequestsToolbar
        state={state}
        sitesList={sitesList}
        onChange={setState}
        onReset={resetBoard}
      />

      {/* Date range validation hint */}
      {!isDateRangeValid && (
        <div
          role="alert"
          className="error-banner mb-4 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive font-medium"
        >
          Please enter a valid date range (From date must be on or before To date).
        </div>
      )}

      {/* Retry indicator while query retry is pending */}
      {isRetrying && (
        <div
          role="status"
          className="retry-banner mb-4 rounded-md border border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/40 p-3 text-sm text-sky-700 dark:text-sky-300"
        >
          Temporary API error or rate limit encountered. Retrying in background…
        </div>
      )}

      {/* Warning for otherwise eligible requests missing site/timezone */}
      {missingTimezoneCount > 0 && (
        <div
          role="status"
          className="warning-banner mb-4 rounded-md border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 p-3 text-sm text-amber-800 dark:text-amber-300"
          aria-live="polite"
        >
          <strong>Data Quality Warning:</strong> {missingTimezoneCount} request
          {missingTimezoneCount === 1 ? "" : "s"} could not be date-filtered because site or timezone data is missing. Their inclusion in the selected date range cannot be determined.
        </div>
      )}

      {/* Summary status text */}
      <p className="muted my-3 text-sm text-muted-foreground" role="status" aria-live="polite">
        {state.from} to {state.to}.{" "}
        {isLoading
          ? "Loading…"
          : `${totalRows} request${totalRows === 1 ? "" : "s"}${
              requestsQuery.data && totalRows !== requestsQuery.data.length
                ? ` (filtered from ${requestsQuery.data.length} loaded)`
                : ""
            }.`}
      </p>

      {requestsQuery.error && (
        <QueryErrorNotice
          resource="requests"
          error={requestsQuery.error}
          hasData={requestsQuery.data !== undefined}
          onRetry={() => void requestsQuery.refetch()}
        />
      )}
      {sitesQuery.error && (
        <QueryErrorNotice
          resource="site information"
          error={sitesQuery.error}
          hasData={sitesQuery.data !== undefined}
          onRetry={() => void sitesQuery.refetch()}
        />
      )}
      {staffQuery.error && (
        <QueryErrorNotice
          resource="staff directory"
          error={staffQuery.error}
          hasData={staffQuery.data !== undefined}
          onRetry={() => void staffQuery.refetch()}
        />
      )}

      {/* Loading state indicator */}
      {isLoading && (
        <div
          role="status"
          aria-live="polite"
          className="loading-banner my-4 rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground"
        >
          Loading requests…
        </div>
      )}

      {/* Empty state */}
      {!isLoading && isDateRangeValid && requestsQuery.isSuccess && sitesQuery.isSuccess && totalRows === 0 && (
        <div
          role="status"
          className="empty-state my-4 rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground"
        >
          No requests found matching the selected filters.
        </div>
      )}

      {/* Requests table */}
      {!isLoading && requestsQuery.data !== undefined && sitesQuery.data !== undefined && totalRows > 0 && (
        <>
          <RequestsTable
            requests={paginatedRequests}
            sitesMap={sitesMap}
            staffMap={staffMap}
            sitesLoading={sitesQuery.isLoading}
            staffLoading={staffQuery.isLoading}
            sortField={state.sortField}
            sortDirection={state.sortDirection}
            onToggleSort={toggleSort}
            onSelectRequest={handleSelectRequest}
          />

          <RequestsPagination
            startRow={startRow}
            endRow={endRow}
            totalRows={totalRows}
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={(page) => setState((prev) => ({ ...prev, page }))}
            onPageSizeChange={(newPageSize) => {
              setPageSize(newPageSize);
              setState((prev) => ({ ...prev, page: 1 }));
            }}
          />
        </>
      )}
    </div>
  );
}
