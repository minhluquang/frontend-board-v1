import { useEffect, useMemo, useState } from "react";
import { ApiError } from "@/api";
import type { Site, Staff } from "@/types";
import { parseUrlState, syncUrlState, type BoardState } from "../board-state";
import { isValidIsoDate } from "../dates";
import { useRequestsQuery, useSitesQuery, useStaffQuery } from "../queries";
import {
  clampPage,
  countMissingTimezoneRequests,
  filterAndSortRequests,
  PAGE_SIZE,
  paginateRequests,
  type SortField,
} from "../rules";
import { RequestsPagination } from "./requests-pagination";
import { RequestsTable } from "./requests-table";
import { RequestsToolbar } from "./requests-toolbar";

export function RequestsBoard() {
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
  }, [
    requestsQuery.data,
    sitesMap,
    state.from,
    state.to,
    state.siteId,
    state.status,
    state.sortField,
    state.sortDirection,
  ]);

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
    <div className="w-full">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Requests board
        </h1>
      </div>

      {/* Filter and sorting toolbar */}
      <RequestsToolbar
        state={state}
        sitesList={sitesList}
        onChange={setState}
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
      <p className="muted text-sm text-muted-foreground my-2" role="status" aria-live="polite">
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
        <div
          role="alert"
          className="error-banner my-4 rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive font-medium"
        >
          Could not load requests: {errorMessage}
        </div>
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
      {!isLoading && !errorMessage && totalRows === 0 && (
        <div
          role="status"
          className="empty-state my-4 rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground"
        >
          No requests found matching the selected filters.
        </div>
      )}

      {/* Requests table */}
      {!isLoading && totalRows > 0 && (
        <>
          <RequestsTable
            requests={paginatedRequests}
            sitesMap={sitesMap}
            staffMap={staffMap}
            sitesLoading={sitesQuery.isLoading}
            sortField={state.sortField}
            sortDirection={state.sortDirection}
            onToggleSort={toggleSort}
          />

          <RequestsPagination
            startRow={startRow}
            endRow={endRow}
            totalRows={totalRows}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) => setState((prev) => ({ ...prev, page }))}
          />
        </>
      )}
    </div>
  );
}
