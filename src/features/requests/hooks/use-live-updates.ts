import { useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getQueryRetryDelay, shouldRetryQuery } from "@/api";
import { executeChangesSyncCycle, type SyncCycleResult } from "../api/changes-sync";
import { syncStorage, type SyncStorage } from "../api/sync-storage";

export const LIVE_UPDATES_QUERY_KEY = ["live-updates"] as const;
export const SYNC_INTERVAL_MS = 30_000;

export interface LiveUpdatesState {
  isSyncing: boolean;
  isError: boolean;
  error: unknown;
  lastSyncedAt: Date | null;
  processedCount: number;
  refetch: () => Promise<unknown>;
}

export function useLiveUpdates(customStorage?: SyncStorage): LiveUpdatesState {
  const queryClient = useQueryClient();
  const storage = customStorage ?? syncStorage;
  const lastSuccessfulSyncRef = useRef<Date | null>(null);

  const query = useQuery<SyncCycleResult>({
    queryKey: LIVE_UPDATES_QUERY_KEY,
    queryFn: async () => {
      const result = await executeChangesSyncCycle(queryClient, storage);
      lastSuccessfulSyncRef.current = result.syncedAt;
      return result;
    },
    refetchInterval: SYNC_INTERVAL_MS,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: false,
    retry: shouldRetryQuery,
    retryDelay: getQueryRetryDelay,
  });

  if (query.isSuccess && query.data?.syncedAt) {
    lastSuccessfulSyncRef.current = query.data.syncedAt;
  }

  return {
    isSyncing: query.isFetching,
    isError: query.isError,
    error: query.error,
    lastSyncedAt: lastSuccessfulSyncRef.current,
    processedCount: query.data?.processedCount ?? 0,
    refetch: query.refetch,
  };
}
