import { get } from "@/api";
import type { HelpdeskRequest, Page, RequestEvent, Site, Staff } from "../types";

export const listRequests = (params: {
  page?: number;
  per_page?: number;
  created_from?: string;
  created_to?: string;
  status?: string;
}) => get<Page<HelpdeskRequest>>("/v1/requests", params);

/** Fetch every page of requests matching the provided filters. */
export async function fetchAllRequests(
  params: { created_from?: string; created_to?: string; status?: string; per_page?: number } = {},
): Promise<HelpdeskRequest[]> {
  const perPage = params.per_page ?? 100;
  let page = 1;
  const allRequests: HelpdeskRequest[] = [];

  while (true) {
    const response = await listRequests({ ...params, page, per_page: perPage });
    allRequests.push(...response.data);

    if (typeof response.total_pages === "number") {
      if (page >= response.total_pages || response.data.length === 0) break;
    } else if (typeof response.has_more === "boolean") {
      if (!response.has_more || response.data.length === 0) break;
    } else if (response.data.length < perPage) {
      break;
    }

    page += 1;
  }

  return allRequests;
}

export const getRequest = (id: number) => get<HelpdeskRequest>(`/v1/requests/${id}`);

export const listRequestEvents = (id: number, page = 1) =>
  get<Page<RequestEvent>>(`/v1/requests/${id}/events`, { page });

/** Fetch every documented 50-event page for a request. */
export async function fetchAllRequestEvents(id: number): Promise<RequestEvent[]> {
  let page = 1;
  const allEvents: RequestEvent[] = [];

  while (true) {
    const response = await listRequestEvents(id, page);
    allEvents.push(...response.data);

    if (typeof response.has_more === "boolean") {
      if (!response.has_more || response.data.length === 0) break;
    } else if (typeof response.total_pages === "number") {
      if (page >= response.total_pages || response.data.length === 0) break;
    } else if (response.data.length < (response.per_page ?? 50)) {
      break;
    }

    page += 1;
  }

  return allEvents;
}

export const listSites = () => get<{ data: Site[] }>("/v1/sites");

export const listStaff = () => get<{ data: Staff[] }>("/v1/staff");
