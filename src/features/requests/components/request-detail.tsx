import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Clock, History, AlertTriangle } from "lucide-react";
import { ApiError } from "@/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Site, Staff } from "@/features/requests/types";
import { formatSiteDateTime, formatSiteDueAt, formatUnixSeconds } from "../dates";
import { useRequestEventsQuery, useRequestQuery } from "../hooks/queries";
import {
  filterTimelineEvents,
  findFirstResponse,
  isRequestOverdue,
  resolveActorName,
  resolveAssigneeName,
  sortEventsChronologically,
} from "../rules";

interface RequestDetailProps {
  requestId: number;
  sitesMap: Map<number, Site>;
  staffMap: Map<number, Staff>;
  sitesLoading?: boolean;
  staffLoading?: boolean;
  sitesError?: unknown;
  staffError?: unknown;
  onRetrySites?: () => void;
  onRetryStaff?: () => void;
  onBack: () => void;
}

export function RequestDetail({
  requestId,
  sitesMap,
  staffMap,
  sitesLoading = false,
  staffLoading = false,
  sitesError,
  staffError,
  onRetrySites,
  onRetryStaff,
  onBack,
}: RequestDetailProps) {
  const [showReverted, setShowReverted] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [requestId]);

  // Load single request using getRequest
  const requestQuery = useRequestQuery(requestId);

  // Load every page of events using documented 50 per page & has_more
  const eventsQuery = useRequestEventsQuery(requestId);

  const request = requestQuery.data;
  const allEvents = eventsQuery.data ?? [];

  // Site and timezone resolution
  const site = request ? sitesMap.get(request.site_id) : undefined;
  const siteTimezone = site?.timezone?.trim();
  const isSiteInfoLoading = sitesLoading && !site;
  const isTimezoneMissing = !isSiteInfoLoading && !siteTimezone;

  // First response calculation (Rule 6) - evaluates across the COMPLETE fetched history
  const firstResponseEvent = useMemo(() => {
    return findFirstResponse(allEvents);
  }, [allEvents]);

  // Timeline events calculation (Rule 5) - filters undone/reverting events unless showReverted is true
  const visibleEvents = useMemo(() => {
    const filtered = filterTimelineEvents(allEvents, showReverted);
    return sortEventsChronologically(filtered);
  }, [allEvents, showReverted]);

  const requestLoading = requestQuery.isLoading;
  const hasEventData = eventsQuery.data !== undefined;
  const requestError = requestQuery.error;
  const eventsError = eventsQuery.error;
  const isRetrying = [requestQuery, eventsQuery].some(
    (query) => query.isFetching && query.failureCount > 0,
  );

  const requestErrorMessage = requestError
    ? requestError instanceof ApiError
      ? `${requestError.status}: ${requestError.message}`
      : requestError instanceof Error
        ? requestError.message
        : String(requestError)
    : null;

  const eventsErrorMessage = eventsError
    ? eventsError instanceof ApiError
      ? `${eventsError.status}: ${eventsError.message}`
      : eventsError instanceof Error
        ? eventsError.message
        : String(eventsError)
    : null;

  return (
    <section className="w-full space-y-6" aria-labelledby="request-detail-heading">
      <h1
        id="request-detail-heading"
        ref={headingRef}
        tabIndex={-1}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-16 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-foreground focus:ring-2 focus:ring-ring"
      >
        {request ? `Request ${request.ref}: ${request.title}` : `Request ${requestId}`}
      </h1>

      {/* Back button & top navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          className="gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Back to requests board"
        >
          <ArrowLeft className="size-4" />
          <span>Back to requests</span>
        </Button>
      </div>

      {(sitesLoading || staffLoading) && (
        <div role="status" aria-live="off" className="text-sm text-muted-foreground">
          Loading related site and staff information…
        </div>
      )}
      {isRetrying && (
        <div role="status" aria-live="off" className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
          A temporary API error occurred. Retrying automatically…
        </div>
      )}

      {sitesError != null && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <span>Site information could not be loaded. Site-local dates may be unavailable.</span>
          {onRetrySites && (
            <Button type="button" variant="outline" size="sm" onClick={onRetrySites}>
              Retry site information
            </Button>
          )}
        </div>
      )}
      {staffError != null && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <span>Staff names may be unavailable until the staff directory loads.</span>
          {onRetryStaff && (
            <Button type="button" variant="outline" size="sm" onClick={onRetryStaff}>
              Retry staff directory
            </Button>
          )}
        </div>
      )}

      {/* Request Loading State */}
      {requestLoading && (
        <div
          role="status"
          aria-live="polite"
          className="loading-banner rounded-lg border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground"
        >
          Loading request details…
        </div>
      )}

      {/* Request Error State */}
      {requestErrorMessage && (
        <div role="alert" className="error-banner flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive font-medium">
          <span>
            {request
              ? "Could not refresh this request. Showing the last available details."
              : "Could not load this request."} {requestErrorMessage}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => void requestQuery.refetch()}>
            Retry request
          </Button>
        </div>
      )}

      {/* Request Content */}
      {!requestLoading && request && (
        <>
          {/* Missing Timezone State Warning */}
          {isTimezoneMissing && (
            <div
              role="status"
              aria-live="polite"
              className="warning-banner rounded-md border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 p-4 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-3"
            >
              <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <strong className="font-semibold">Missing Timezone:</strong> This request&apos;s site (Site #{request.site_id}) does not have an IANA timezone configured. Timestamps cannot be reliably determined in site-local time and will not default to UTC.
              </div>
            </div>
          )}

          {/* Request Header Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-start gap-2">
                  <span className="font-mono text-sm font-semibold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                    {request.ref}
                  </span>
                  <CardTitle className="min-w-0 flex-1 break-words text-xl font-bold tracking-tight text-foreground [overflow-wrap:anywhere]">
                    {request.title}
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {/* Status Badge */}
                  {request.status === "pending" ? (
                    <Badge variant="outline" className="badge-status-pending border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                      pending
                    </Badge>
                  ) : request.status === "processing" ? (
                    <Badge variant="outline" className="badge-status-processing border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                      processing
                    </Badge>
                  ) : request.status === "complete" ? (
                    <Badge variant="outline" className="badge-status-complete border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                      complete
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="badge-status-canceled">
                      {request.status}
                    </Badge>
                  )}

                  {/* Priority Badge */}
                  {request.priority === "High" ? (
                    <Badge variant="destructive">High</Badge>
                  ) : request.priority === "Medium" ? (
                    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                      Medium
                    </Badge>
                  ) : request.priority === "Low" ? (
                    <Badge variant="outline" className="text-muted-foreground">
                      Low
                    </Badge>
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground block text-xs">Location</span>
                  <span className="font-medium text-foreground">{request.location || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Site & Timezone</span>
                  <span className="font-medium text-foreground">
                    {site?.name ?? `Site #${request.site_id}`}{" "}
                    {siteTimezone ? (
                      <span className="text-xs font-mono text-muted-foreground">({siteTimezone})</span>
                    ) : (
                      <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-800 text-xs">
                        Missing timezone
                      </Badge>
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Assignee</span>
                  {/* Rule 3: strictly lookup assignee in /v1/staff */}
                  <span className="font-medium text-foreground">
                    {staffLoading && request.assignee
                      ? "Loading staff…"
                      : resolveAssigneeName(request.assignee, staffMap)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Created At</span>
                  <span className="text-foreground">
                    {siteTimezone ? (
                      formatSiteDateTime(request.created_at, siteTimezone)
                    ) : sitesLoading ? (
                      <span className="text-muted-foreground">Loading site timezone…</span>
                    ) : (
                      <span className="text-muted-foreground">Missing timezone</span>
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Updated At</span>
                  <span className="text-foreground">
                    {siteTimezone ? (
                      formatSiteDateTime(request.updated_at, siteTimezone)
                    ) : sitesLoading ? (
                      <span className="text-muted-foreground">Loading site timezone…</span>
                    ) : (
                      <span className="text-muted-foreground">Missing timezone</span>
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Due Date</span>
                  <span className="text-foreground flex items-center gap-2">
                    {request.due_on ?? "—"}
                    {isRequestOverdue(request, siteTimezone) === true && (
                      <Badge variant="destructive" className="font-semibold text-xs">
                        Overdue
                      </Badge>
                    )}
                    {isRequestOverdue(request, siteTimezone) === null && request.due_on && sitesLoading && (
                      <span className="text-xs text-muted-foreground">Loading timezone…</span>
                    )}
                    {isRequestOverdue(request, siteTimezone) === null && request.due_on && !sitesLoading && (
                      <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-800 text-xs">
                        Missing timezone
                      </Badge>
                    )}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* First Response Card (Rule 6) */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-primary" />
                <CardTitle className="text-base font-semibold">First Response</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {eventsQuery.isLoading ? (
                <div role="status" className="text-sm text-muted-foreground">
                  Calculating first response…
                </div>
              ) : eventsErrorMessage && !hasEventData ? (
                <div role="status" className="text-sm text-muted-foreground">
                  First response is unavailable because the event history could not be loaded.
                </div>
              ) : firstResponseEvent ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-sm">
                  <div>
                    <span className="text-muted-foreground block text-xs">Responder</span>
                    {/* Rule 3: strictly lookup actor by id from /v1/staff */}
                    <span className="font-semibold text-foreground">
                      {staffLoading
                        ? "Loading staff…"
                        : resolveActorName(firstResponseEvent.actor_id, staffMap)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Response Time</span>
                    <span className="text-foreground">
                      {siteTimezone ? (
                        formatUnixSeconds(firstResponseEvent.at, siteTimezone)
                      ) : sitesLoading ? (
                        <span className="text-muted-foreground">Loading site timezone…</span>
                      ) : (
                        <span className="text-muted-foreground">Missing timezone</span>
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Status After Event</span>
                    <Badge variant="outline" className="badge-status-processing border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                      processing
                    </Badge>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No staff response recorded yet (earliest processing event with assigned staff).
                </p>
              )}
            </CardContent>
          </Card>

          {/* Timeline Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <History className="size-4 text-primary" />
                  <CardTitle className="text-base font-semibold">Event Timeline</CardTitle>
                  <span className="text-xs text-muted-foreground">
                    ({visibleEvents.length} event{visibleEvents.length === 1 ? "" : "s"})
                  </span>
                </div>
                {/* Reverted Events Toggle */}
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showReverted}
                    onChange={(e) => setShowReverted(e.target.checked)}
                    className="rounded-xs border-input accent-primary focus:ring-1 focus:ring-ring cursor-pointer"
                  />
                  <span>Show reverted events</span>
                </label>
              </div>
            </CardHeader>
            <CardContent>
              {/* Events Loading State */}
              {eventsQuery.isLoading && (
                <div
                  role="status"
                  aria-live="polite"
                  className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground"
                >
                  Loading timeline events…
                </div>
              )}

              {/* Events Error State */}
              {eventsErrorMessage && (
                <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive font-medium">
                  <span>
                    {hasEventData
                      ? "Could not refresh event history. Showing the last available events."
                      : "Could not load events."} {eventsErrorMessage}
                  </span>
                  <Button type="button" variant="outline" size="sm" onClick={() => void eventsQuery.refetch()}>
                    Retry events
                  </Button>
                </div>
              )}

              {/* Empty Events State */}
              {!eventsQuery.isLoading && (!eventsErrorMessage || hasEventData) && visibleEvents.length === 0 && (
                <div
                  role="status"
                  className="empty-events rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground"
                >
                  No timeline events found for this request.
                </div>
              )}

              {/* Chronological Event Timeline */}
              {!eventsQuery.isLoading && hasEventData && visibleEvents.length > 0 && (
                <ol
                  className="relative space-y-4 border-l border-border ml-3 pl-6"
                  role="list"
                  aria-label="Request events timeline"
                >
                  {visibleEvents.map((event, index) => {
                    const actorName = staffLoading
                      ? "Loading staff…"
                      : resolveActorName(event.actor_id, staffMap);
                    const formattedAt = siteTimezone
                      ? formatUnixSeconds(event.at, siteTimezone)
                      : sitesLoading
                        ? "Loading site timezone…"
                        : "Missing timezone";
                    const isReverting = event.reverts_id !== null && event.reverts_id !== undefined;

                    return (
                      <li key={event.id} className="relative group">
                        {/* Bullet indicator */}
                        <div
                          className="absolute -left-[31px] top-1 size-3 rounded-full border-2 border-background bg-primary"
                          aria-hidden="true"
                        />
                        <div className="rounded-lg border border-border bg-card p-4 shadow-2xs space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground text-sm">
                                {actorName}
                              </span>
                              {event.actor_id === null && (
                                <Badge variant="secondary" className="text-2xs font-normal">
                                  System
                                </Badge>
                              )}
                              <Badge
                                variant="outline"
                                className={
                                  event.status === "pending"
                                    ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                                    : event.status === "processing"
                                      ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                                      : event.status === "complete"
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                                        : "badge-status-canceled"
                                }
                              >
                                {event.status}
                              </Badge>
                              {isReverting && (
                                <Badge
                                  variant="outline"
                                  className="border-amber-300 bg-amber-100 text-amber-800 text-2xs"
                                >
                                  Reverts event #{event.reverts_id}
                                </Badge>
                              )}
                            </div>
                            <time
                              dateTime={new Date(event.at * 1000).toISOString()}
                              className="text-muted-foreground font-mono"
                            >
                              {formattedAt}
                            </time>
                          </div>

                          {/* Event Note */}
                          {event.note && (
                            <p className="break-words text-sm text-foreground bg-muted/40 p-2.5 rounded-md font-sans [overflow-wrap:anywhere]">
                              {event.note}
                            </p>
                          )}

                          {/* Event Due At (wall-clock site-local time) */}
                          {event.due_at && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                              <span>Deadline set:</span>
                              <span className="font-mono text-foreground font-medium">
                                {sitesLoading
                                  ? "Loading site timezone…"
                                  : formatSiteDueAt(event.due_at, siteTimezone)}
                              </span>
                            </div>
                          )}
                        </div>
                        {index < visibleEvents.length - 1 && (
                          <Separator className="sr-only" />
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}
