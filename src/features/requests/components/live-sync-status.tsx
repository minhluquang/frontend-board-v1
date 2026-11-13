import { RefreshCw, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ApiError } from "@/api";
import { useLiveUpdates, type LiveUpdatesState } from "../hooks/use-live-updates";

export interface LiveSyncStatusViewProps {
  state: LiveUpdatesState;
}

export function formatSyncTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function LiveSyncStatusView({ state }: LiveSyncStatusViewProps) {
  const { isSyncing, isError, error, lastSyncedAt } = state;

  const formattedLastSync = lastSyncedAt ? formatSyncTime(lastSyncedAt) : null;

  const errorText = error
    ? error instanceof ApiError
      ? `${error.status}: ${error.message}`
      : error instanceof Error
        ? error.message
        : String(error)
    : "Could not sync updates";

  // Error state: Never display success or up-to-date while error is active
  if (isError) {
    return (
      <div className="flex items-center gap-2">
        <span role="alert" aria-live="assertive" className="sr-only">
          Live update synchronization failed. {errorText}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void state.refetch()}
              aria-label={`Retry live update synchronization${formattedLastSync ? `. Last successful sync at ${formattedLastSync}` : ""}`}
              className="border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15"
            >
              <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
              <span>Sync error · Retry</span>
              {formattedLastSync && (
                <span className="text-muted-foreground ml-1 font-mono text-[11px]">
                  (Last: {formattedLastSync})
                </span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs max-w-xs">
            <p className="font-semibold text-destructive">Synchronization failed</p>
            <p className="text-muted-foreground">{errorText}</p>
            {formattedLastSync && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Last successful sync: {formattedLastSync}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  // Active sync/polling state
  if (isSyncing) {
    return (
      <div
        role="status"
        aria-live="off"
        aria-label="Checking for updates"
        className="flex items-center gap-2"
      >
        <Badge
          variant="outline"
          className="border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300 text-xs font-normal gap-1.5 py-1 px-2.5"
        >
          <RefreshCw className="size-3.5 shrink-0 animate-spin" />
          <span>Syncing…</span>
          {formattedLastSync && (
            <span className="text-muted-foreground ml-1 font-mono text-[11px]">
              ({formattedLastSync})
            </span>
          )}
        </Badge>
      </div>
    );
  }

  // Normal connected/up-to-date state
  return (
    <div
      role="status"
      aria-live="off"
      aria-label={`Live updates active. ${formattedLastSync ? `Synced at ${formattedLastSync}.` : ""}`}
      className="flex items-center gap-2"
    >
      <Badge
        variant="outline"
        className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs font-normal gap-1.5 py-1 px-2.5"
      >
        <span className="size-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
        <span>Live</span>
        {formattedLastSync ? (
          <span className="text-muted-foreground ml-1 font-mono text-[11px]">
            {formattedLastSync}
          </span>
        ) : (
          <span className="text-muted-foreground ml-1 text-[11px]">Connected</span>
        )}
      </Badge>
    </div>
  );
}

export function LiveSyncStatus() {
  const liveState = useLiveUpdates();
  return <LiveSyncStatusView state={liveState} />;
}
