import type { Site, Status } from "@/features/requests/types";
import type { BoardState } from "../board-state";
import type { SortDirection, SortField } from "../rules";

interface RequestsToolbarProps {
  state: BoardState;
  sitesList: Site[];
  onChange: (updater: (prev: BoardState) => BoardState) => void;
}

export function RequestsToolbar({ state, sitesList, onChange }: RequestsToolbarProps) {
  return (
    <form
      className="toolbar flex flex-wrap gap-4 items-end p-4 mb-4 bg-card rounded-lg border border-border shadow-xs"
      role="search"
      aria-label="Filter and sort requests"
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="filter-group flex flex-col gap-1.5 flex-1 min-w-[130px]">
        <label
          htmlFor="filter-from"
          className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
        >
          From
        </label>
        <input
          id="filter-from"
          type="date"
          className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={state.from}
          aria-label="From date"
          onChange={(e) =>
            onChange((prev) => ({ ...prev, from: e.target.value, page: 1 }))
          }
        />
      </div>

      <div className="filter-group flex flex-col gap-1.5 flex-1 min-w-[130px]">
        <label
          htmlFor="filter-to"
          className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
        >
          To
        </label>
        <input
          id="filter-to"
          type="date"
          className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={state.to}
          aria-label="To date"
          onChange={(e) =>
            onChange((prev) => ({ ...prev, to: e.target.value, page: 1 }))
          }
        />
      </div>

      <div className="filter-group flex flex-col gap-1.5 flex-1 min-w-[150px]">
        <label
          htmlFor="filter-site"
          className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
        >
          Site
        </label>
        <select
          id="filter-site"
          className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={state.siteId ?? ""}
          aria-label="Filter by site"
          onChange={(e) =>
            onChange((prev) => ({
              ...prev,
              siteId: e.target.value ? Number(e.target.value) : null,
              page: 1,
            }))
          }
        >
          <option value="">All sites</option>
          {sitesList.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group flex flex-col gap-1.5 flex-1 min-w-[140px]">
        <label
          htmlFor="filter-status"
          className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
        >
          Status
        </label>
        <select
          id="filter-status"
          className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={state.status}
          aria-label="Filter by status"
          onChange={(e) =>
            onChange((prev) => ({
              ...prev,
              status: e.target.value as Status | "all",
              page: 1,
            }))
          }
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="complete">Complete</option>
        </select>
      </div>

      <div className="filter-group flex flex-col gap-1.5 flex-1 min-w-[140px]">
        <label
          htmlFor="sort-field"
          className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
        >
          Sort by
        </label>
        <select
          id="sort-field"
          className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={state.sortField}
          aria-label="Sort by field"
          onChange={(e) =>
            onChange((prev) => ({
              ...prev,
              sortField: e.target.value as SortField,
              page: 1,
            }))
          }
        >
          <option value="created">Created date</option>
          <option value="due">Due date</option>
        </select>
      </div>

      <div className="filter-group flex flex-col gap-1.5 flex-1 min-w-[160px]">
        <label
          htmlFor="sort-direction"
          className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
        >
          Direction
        </label>
        <select
          id="sort-direction"
          className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={state.sortDirection}
          aria-label="Sort direction"
          onChange={(e) =>
            onChange((prev) => ({
              ...prev,
              sortDirection: e.target.value as SortDirection,
              page: 1,
            }))
          }
        >
          <option value="desc">Newest first (Descending)</option>
          <option value="asc">Oldest first (Ascending)</option>
        </select>
      </div>
    </form>
  );
}
