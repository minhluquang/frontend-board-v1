// A thin client for the helpdesk API. Extend it; don't scatter fetch calls through components.

import type { HelpdeskRequest, Page, RequestEvent, Site, Staff } from "./types";

const BASE = (import.meta.env.HELPDESK_URL ?? "").replace(/\/$/, "");
const TOKEN = import.meta.env.HELPDESK_TOKEN ?? "";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfterSeconds: number | null = null,
  ) {
    super(message);
  }
}

export const MAX_RETRY_COUNT = 2;

export function parseRetryAfterSeconds(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

/**
 * Bounded query retry policy:
 * TanStack Query failureCount starts at 0 for the first failure.
 * - Ordinary 4xx errors (400, 401, 403, 404, 410, etc.) are never retried.
 * - HTTP 429 and 5xx/network errors are retried up to MAX_RETRY_COUNT times:
 *   failureCount 0 (1st retry) and 1 (2nd retry) return true;
 *   failureCount 2 (3rd retry) returns false.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRY_COUNT) {
    return false;
  }

  if (error instanceof ApiError) {
    // Ordinary 4xx errors are client errors and should never be retried
    if (error.status >= 400 && error.status < 500 && error.status !== 429) {
      return false;
    }

    // Rate limited (429) or 5xx server errors: retry bounded
    return true;
  }

  // Network failures or generic runtime errors: retry bounded
  return true;
}

/**
 * Calculates retry delay in milliseconds:
 * - For HTTP 429, honors a valid non-negative Retry-After value (including values above 60s).
 * - When Retry-After is missing, negative, or invalid on 429, falls back to standard exponential backoff.
 * - For non-429 errors, uses exponential backoff starting at 1000ms (1s) and increasing on each retry (1000 * 2^failureCount).
 */
export function getQueryRetryDelay(failureCount: number, error: unknown): number {
  if (error instanceof ApiError && error.status === 429) {
    if (
      typeof error.retryAfterSeconds === "number" &&
      Number.isFinite(error.retryAfterSeconds) &&
      error.retryAfterSeconds >= 0
    ) {
      return error.retryAfterSeconds * 1000;
    }
  }

  const safeCount = Math.max(0, failureCount);
  return 1000 * Math.pow(2, safeCount);
}

export function configured(): boolean {
  return Boolean(BASE && TOKEN);
}

export async function get<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const url = new URL(BASE + path);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    const retryAfterSeconds = parseRetryAfterSeconds(response.headers.get("Retry-After"));
    throw new ApiError(response.status, body.error ?? response.statusText, retryAfterSeconds);
  }
  return (await response.json()) as T;
}

export const listRequests = (params: { page?: number; per_page?: number; created_from?: string; created_to?: string; status?: string }) =>
  get<Page<HelpdeskRequest>>("/v1/requests", params);

/**
 * Fetch all pages of requests matching the provided filters.
 * Inspects `total_pages`, `has_more`, or page size cutoff to traverse all pages.
 */
export async function fetchAllRequests(
  params: { created_from?: string; created_to?: string; status?: string; per_page?: number } = {},
): Promise<HelpdeskRequest[]> {
  const perPage = params.per_page ?? 100;
  let page = 1;
  const allRequests: HelpdeskRequest[] = [];

  while (true) {
    const res = await listRequests({ ...params, page, per_page: perPage });
    allRequests.push(...res.data);

    if (typeof res.total_pages === "number") {
      if (page >= res.total_pages || res.data.length === 0) {
        break;
      }
    } else if (typeof res.has_more === "boolean") {
      if (!res.has_more || res.data.length === 0) {
        break;
      }
    } else {
      if (res.data.length < perPage) {
        break;
      }
    }

    page++;
  }

  return allRequests;
}

export const getRequest = (id: number) => get<HelpdeskRequest>(`/v1/requests/${id}`);

export const listEvents = (id: number, page = 1) => get<Page<RequestEvent>>(`/v1/requests/${id}/events`, { page });

export const listSites = () => get<{ data: Site[] }>("/v1/sites");

export const listStaff = () => get<{ data: Staff[] }>("/v1/staff");
