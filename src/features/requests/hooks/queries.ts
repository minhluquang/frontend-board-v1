import { useQuery } from "@tanstack/react-query";
import {
  fetchAllRequestEvents,
  fetchAllRequests,
  getRequest,
  listSites,
  listStaff,
} from "../api/requests-api";
import { toApiDate } from "../dates";

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
        created_from: toApiDate(from),
        created_to: toApiDate(to),
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
