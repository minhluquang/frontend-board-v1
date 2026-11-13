import { useQuery } from "@tanstack/react-query";
import {
  fetchAllRequestEvents,
  fetchAllRequests,
  getRequest,
  listSites,
  listStaff,
} from "../api/requests-api";
import { addCalendarDays, toApiDate } from "../dates";

export function useSitesQuery() {
  return useQuery({
    queryKey: ["sites"],
    queryFn: listSites,
    staleTime: 5 * 60 * 1000,
  });
}

export function useStaffQuery() {
  return useQuery({
    queryKey: ["staff"],
    queryFn: listStaff,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRequestsQuery(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: ["requests", from, to],
    queryFn: () =>
      fetchAllRequests({
        // The API does not document which timezone it uses for these date filters.
        // Fetch a one-day margin, then apply the exact site-local range in rules.ts.
        created_from: toApiDate(addCalendarDays(from, -1)),
        created_to: toApiDate(addCalendarDays(to, 1)),
      }),
    enabled,
  });
}

export function useRequestQuery(id: number | null) {
  return useQuery({
    queryKey: ["request", id],
    queryFn: () => getRequest(id!),
    enabled: id !== null && !isNaN(id),
  });
}

export function useRequestEventsQuery(id: number | null) {
  return useQuery({
    queryKey: ["request-events", id],
    queryFn: () => fetchAllRequestEvents(id!),
    enabled: id !== null && !isNaN(id),
  });
}
