import { useQuery } from "@tanstack/react-query";
import { fetchAllRequests, listSites, listStaff } from "@/api";
import { toApiDate } from "./dates";

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
