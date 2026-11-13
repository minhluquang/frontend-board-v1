import type { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/api";
import { getChanges } from "./requests-api";
import { syncStorage, type SyncStorage } from "./sync-storage";
import type {
  ChangeItem,
  EventCreatedChange,
  RequestCreatedChange,
  RequestUpdatedChange,
} from "../types";

export interface SyncCycleResult {
  syncedAt: Date;
  processedCount: number;
  latestCursor: string | null;
}

/**
 * Invalidate corresponding query caches according to documented change types.
 * Safely invalidates queries if an unknown change type is encountered.
 */
export function applyChangesToQueryCache(
  queryClient: QueryClient,
  changes: ChangeItem[],
): void {
  if (changes.length === 0) return;

  let invalidateRequests = false;
  let invalidateStaff = false;
  let invalidateAllFeatureData = false;
  const requestIds = new Set<number>();
  const eventRequestIds = new Set<number>();

  for (const change of changes) {
    switch (change.type) {
      case "request.created":
      case "request.updated": {
        // Request created or updated: refresh request list and affected request detail
        invalidateRequests = true;
        const req = (change as RequestCreatedChange | RequestUpdatedChange)
          .request;
        if (req && typeof req.id === "number") {
          requestIds.add(req.id);
        }
        break;
      }
      case "event.created": {
        // New event: refresh event history and affected request detail
        const evt = change as EventCreatedChange;
        // An event can represent a status/assignment change reflected on the board.
        invalidateRequests = true;
        if (typeof evt.request_id === "number") {
          eventRequestIds.add(evt.request_id);
          requestIds.add(evt.request_id);
        }
        break;
      }
      case "staff.updated": {
        // Staff updated: refresh staff registry so display names reflect updates
        invalidateStaff = true;
        break;
      }
      default: {
        // Unknown change type: keep all feature data fresh without breaking polling.
        invalidateAllFeatureData = true;
        break;
      }
    }
  }

  if (invalidateRequests) {
    queryClient.invalidateQueries({ queryKey: ["requests"] });
  }

  if (invalidateStaff) {
    queryClient.invalidateQueries({ queryKey: ["staff"] });
  }

  if (invalidateAllFeatureData) {
    queryClient.invalidateQueries({ queryKey: ["requests"] });
    queryClient.invalidateQueries({ queryKey: ["request"] });
    queryClient.invalidateQueries({ queryKey: ["request-events"] });
    queryClient.invalidateQueries({ queryKey: ["sites"] });
    queryClient.invalidateQueries({ queryKey: ["staff"] });
  }

  for (const reqId of requestIds) {
    queryClient.invalidateQueries({ queryKey: ["request", reqId] });
  }

  for (const reqId of eventRequestIds) {
    queryClient.invalidateQueries({ queryKey: ["request-events", reqId] });
  }
}

/**
 * Executes a full synchronization cycle:
 * 1. Reads current cursor from storage (null on first run).
 * 2. Fetches changes pages up to limit: 500 until has_more: false.
 * 3. Recovers from HTTP 410 (expired cursor) by clearing cursor and starting over without cursor.
 * 4. Deduplicates items using sequence numbers (seq) and skips already processed changes.
 * 5. Applies cache invalidations.
 * 6. Commits newly processed seqs and latest next_cursor to storage only upon full cycle completion.
 *    Mid-cycle errors abort and leave previously persisted cursor and sync state untouched.
 */
export async function executeChangesSyncCycle(
  queryClient: QueryClient,
  storage: SyncStorage = syncStorage,
): Promise<SyncCycleResult> {
  const initialCursor = storage.getCursor();
  let currentCursor: string | undefined = initialCursor ?? undefined;
  let restartedAfter410 = false;
  let latestNextCursor: string | undefined = undefined;
  const cycleChanges: ChangeItem[] = [];
  const seenCursors = new Set<string>();

  let hasMore = true;

  while (hasMore) {
    let response;
    try {
      response = await getChanges({
        cursor: currentCursor,
        limit: 500,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 410) {
        if (!restartedAfter410) {
          restartedAfter410 = true;
          // Clear expired cursor from storage and restart from the beginning without cursor
          storage.clearCursor();
          currentCursor = undefined;
          cycleChanges.length = 0;
          continue;
        }
      }
      // If error occurs mid-cycle, do not commit any cursor, rethrow error
      throw err;
    }

    if (
      !Array.isArray(response.data) ||
      typeof response.has_more !== "boolean" ||
      typeof response.next_cursor !== "string" ||
      response.next_cursor.length === 0
    ) {
      throw new Error("Invalid change feed response: expected data, next_cursor, and has_more.");
    }

    cycleChanges.push(...response.data);

    const nextCursor = response.next_cursor;
    hasMore = response.has_more;
    if (hasMore) {
      if (nextCursor === currentCursor || seenCursors.has(nextCursor)) {
        throw new Error("Invalid change feed response: cursor did not advance while more pages remain.");
      }
      seenCursors.add(nextCursor);
    }

    latestNextCursor = nextCursor;
    currentCursor = nextCursor;
  }

  // Deduplicate items against already processed seqs in storage as well as within this cycle
  const changesToApply: ChangeItem[] = [];
  const newSeqs: number[] = [];
  const seenSeqs = new Set<number>();

  for (const change of cycleChanges) {
    if (typeof change.seq === "number") {
      if (storage.hasSeq(change.seq) || seenSeqs.has(change.seq)) {
        continue;
      }
      seenSeqs.add(change.seq);
      newSeqs.push(change.seq);
    }
    changesToApply.push(change);
  }

  // Apply invalidations to cache
  applyChangesToQueryCache(queryClient, changesToApply);

  // Commit processed seqs and new cursor to storage only after all pages processed & cache handled
  if (newSeqs.length > 0) {
    storage.addSeqs(newSeqs);
  }

  if (latestNextCursor) {
    storage.setCursor(latestNextCursor);
  }

  return {
    syncedAt: new Date(),
    processedCount: changesToApply.length,
    latestCursor: storage.getCursor(),
  };
}
