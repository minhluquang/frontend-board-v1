import type { HelpdeskRequest, RequestEvent, Site, Staff, Status } from "@/features/requests/types";
import { localDate } from "./dates";

export type SortField = "created" | "due";
export type SortDirection = "asc" | "desc";

export interface FilterAndSortOptions {
  fromDate: string;
  toDate: string;
  siteId?: number | null;
  status?: Status | "all";
  sortField?: SortField;
  sortDirection?: SortDirection;
}

export const PAGE_SIZE = 25;

/**
 * Rule 1: Exclude requests with status canceled, deleted_at set, or merged_into_id set.
 */
export function isExcludedRequest(request: HelpdeskRequest): boolean {
  return (
    request.status === "canceled" ||
    request.deleted_at !== null ||
    request.merged_into_id !== null
  );
}

/**
 * Rule 1: Convert a request's UTC created_at instant to the site's local date (YYYY-MM-DD).
 * Returns null if site timezone is missing, to avoid inaccurate UTC fallback.
 */
export function getRequestSiteLocalDate(
  request: HelpdeskRequest,
  siteTimezone?: string | null,
): string | null {
  if (!siteTimezone || !siteTimezone.trim()) return null;
  const instant = new Date(request.created_at);
  if (isNaN(instant.getTime())) return null;
  return localDate(instant, siteTimezone);
}

/**
 * Rule 1: Check if request's created_at converted to the site's local date falls
 * within [fromDate, toDate] inclusive.
 * Returns false if site timezone is missing.
 */
export function isRequestInDateRange(
  request: HelpdeskRequest,
  siteTimezone: string | null | undefined,
  fromDate: string,
  toDate: string,
): boolean {
  const siteDate = getRequestSiteLocalDate(request, siteTimezone);
  if (!siteDate) return false;
  return siteDate >= fromDate && siteDate <= toDate;
}

/**
 * Rule 2: Overdue check in the site's timezone.
 * Returns:
 * - true if overdue
 * - false if not overdue (or due_on is null, or status is not pending/processing)
 * - null if site timezone is missing, avoiding inaccurate overdue assumptions.
 */
export function isRequestOverdue(
  request: HelpdeskRequest,
  siteTimezone?: string | null,
  referenceInstant: Date = new Date(),
): boolean | null {
  if (request.status !== "pending" && request.status !== "processing") {
    return false;
  }
  if (!request.due_on) {
    return false;
  }
  if (!siteTimezone || !siteTimezone.trim()) {
    return null;
  }
  const todayInSite = localDate(referenceInstant, siteTimezone);
  return request.due_on < todayInSite;
}

/**
 * Clamps a page number into valid 1-based bounds [1, totalPages].
 */
export function clampPage(page: number, totalRows: number, pageSize = PAGE_SIZE): number {
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  if (isNaN(page) || page < 1) return 1;
  if (page > totalPages) return totalPages;
  return Math.floor(page);
}

/**
 * Slices an array of items for the requested page.
 */
export function paginateRequests<T>(items: T[], page: number, pageSize = PAGE_SIZE): T[] {
  const clampedPage = clampPage(page, items.length, pageSize);
  const start = (clampedPage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

/**
 * Counts requests that are otherwise active (not canceled, not deleted, not merged)
 * and match any active status/site filter, but could not be date-filtered because
 * site or site timezone data is missing.
 */
export function countMissingTimezoneRequests(
  requests: HelpdeskRequest[],
  sitesMap: Map<number, Site>,
  options?: { siteId?: number | null; status?: Status | "all" },
): number {
  const siteId = options?.siteId ?? null;
  const status = options?.status ?? "all";

  return requests.reduce((count, req) => {
    // 1. Exclude canceled, deleted, or merged requests
    if (isExcludedRequest(req)) {
      return count;
    }

    // 2. Status filter if specified
    if (status !== "all" && req.status !== status) {
      return count;
    }

    // 3. Site filter if specified
    if (siteId !== null && siteId !== undefined && req.site_id !== siteId) {
      return count;
    }

    // 4. Check if site or timezone is missing
    const site = sitesMap.get(req.site_id);
    const timezone = site?.timezone?.trim();
    if (!timezone) {
      return count + 1;
    }

    return count;
  }, 0);
}

/**
 * Rule 3: Look people up by id in /v1/staff.
 * NEVER display assignee.name or actor_name from request or event data as they can be stale.
 */
export function resolveAssigneeName(
  assignee: { id: number; name?: string } | null,
  staffMap: Map<number, Staff> | Record<number, Staff>,
): string {
  if (!assignee) return "—";
  const staff = staffMap instanceof Map ? staffMap.get(assignee.id) : staffMap[assignee.id];
  if (staff && staff.name) {
    return staff.name;
  }
  return `Staff #${assignee.id}`;
}

/**
 * Rule 3: Look up event actor in /v1/staff by actor_id.
 * Automatic/system events have actor_id: null -> display "System".
 * NEVER display actor_name or assignee_name from event payload.
 */
export function resolveActorName(
  actorId: number | null | undefined,
  staffMap: Map<number, Staff> | Record<number, Staff>,
): string {
  if (actorId === null || actorId === undefined) {
    return "System";
  }
  const staff = staffMap instanceof Map ? staffMap.get(actorId) : staffMap[actorId];
  if (staff && staff.name) {
    return staff.name;
  }
  return `Staff #${actorId}`;
}

/**
 * Rule 5: Undone events.
 * An event with reverts_id undoes the event it references.
 * By default, hide both the undoing event and the event it undoes.
 */
export function filterTimelineEvents(
  events: RequestEvent[],
  includeReverted = false,
): RequestEvent[] {
  if (includeReverted) {
    return [...events];
  }

  const hiddenIds = new Set<number>();
  for (const event of events) {
    if (event.reverts_id !== null && event.reverts_id !== undefined) {
      hiddenIds.add(event.id);
      hiddenIds.add(event.reverts_id);
    }
  }

  return events.filter((event) => !hiddenIds.has(event.id));
}

/**
 * Sorts events in chronological order (earliest first).
 * Primary sort: at ascending.
 * Secondary sort: id ascending.
 */
export function sortEventsChronologically(events: RequestEvent[]): RequestEvent[] {
  return [...events].sort((a, b) => {
    const diff = a.at - b.at;
    if (diff !== 0) return diff;
    return a.id - b.id;
  });
}

/**
 * Rule 6: First response.
 * Follow docs/rules.md literally: find the earliest event in the complete fetched history
 * whose status is processing and whose actor_id is not null (System events have actor_id: null).
 *
 * Keep Rule 5 (timeline hiding) and Rule 6 (first response) calculations separate:
 * Even if the earliest qualifying processing event was subsequently reverted, under Rule 6
 * it still counts as the first response.
 */
export function findFirstResponse(events: RequestEvent[]): RequestEvent | null {
  const qualifying = events.filter(
    (e) => e.status === "processing" && e.actor_id !== null && e.actor_id !== undefined,
  );

  if (qualifying.length === 0) {
    return null;
  }

  return qualifying.reduce((earliest, current) => {
    if (current.at < earliest.at) return current;
    if (current.at === earliest.at && current.id < earliest.id) return current;
    return earliest;
  });
}

/**
 * Filters and sorts requests according to the business rules and user-selected options.
 */
export function filterAndSortRequests(
  requests: HelpdeskRequest[],
  sitesMap: Map<number, Site>,
  options: FilterAndSortOptions,
): HelpdeskRequest[] {
  const {
    fromDate,
    toDate,
    siteId = null,
    status = "all",
    sortField = "created",
    sortDirection = "desc",
  } = options;

  // Filter stage
  const filtered = requests.filter((req) => {
    // 1. Exclude canceled, deleted, or merged
    if (isExcludedRequest(req)) {
      return false;
    }

    // 2. Site filter if specified
    if (siteId !== null && siteId !== undefined && req.site_id !== siteId) {
      return false;
    }

    // 3. Status filter if specified
    if (status !== "all" && req.status !== status) {
      return false;
    }

    // 4. Date range filter based on site timezone (do not silently default to UTC)
    const site = sitesMap.get(req.site_id);
    const timezone = site?.timezone;
    if (!timezone || !isRequestInDateRange(req, timezone, fromDate, toDate)) {
      return false;
    }

    return true;
  });

  // Sort stage
  return filtered.sort((a, b) => {
    if (sortField === "created") {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      const diff = sortDirection === "asc" ? timeA - timeB : timeB - timeA;
      if (diff !== 0) return diff;
    } else if (sortField === "due") {
      // Sort by due date. Null due dates go to the bottom in both directions.
      if (a.due_on === null && b.due_on === null) {
        // Equal nulls: fall through to secondary sort
      } else if (a.due_on === null) {
        return 1;
      } else if (b.due_on === null) {
        return -1;
      } else {
        const comp = a.due_on.localeCompare(b.due_on);
        const diff = sortDirection === "asc" ? comp : -comp;
        if (diff !== 0) return diff;
      }
    }

    // Secondary deterministic sort: newest created, then ID desc
    const createdFallback = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (createdFallback !== 0) return createdFallback;
    return b.id - a.id;
  });
}
