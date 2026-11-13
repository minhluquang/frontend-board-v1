import { RotateCcw } from "lucide-react";
import type { Site } from "@/features/requests/types";
import type { BoardState } from "../board-state";
import type { SortDirection, SortField } from "../rules";

interface RequestsToolbarProps {
  state: BoardState;
  sitesList: Site[];
  onChange: (updater: (prev: BoardState) => BoardState) => void;
  onReset: () => void;
}

const controlClassName =
  "h-10 w-full cursor-pointer rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-xs transition-colors hover:border-foreground/25 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/15";

const labelClassName = "text-xs font-medium text-muted-foreground";

export function RequestsToolbar({ state, sitesList, onChange, onReset }: RequestsToolbarProps) {
  return (
    <form
      className="toolbar mb-4 grid grid-cols-1 gap-3 border-b border-border pb-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
      role="search"
      aria-label="Filter and sort requests"
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="filter-group flex min-w-0 flex-col gap-1.5">
        <label htmlFor="filter-from" className={labelClassName}>From</label>
        <input
          id="filter-from"
          type="date"
          className={controlClassName}
          value={state.from}
          aria-label="From date"
          onChange={(e) =>
            onChange((prev) => ({ ...prev, from: e.target.value, page: 1 }))
          }
        />
      </div>

      <div className="filter-group flex min-w-0 flex-col gap-1.5">
        <label htmlFor="filter-to" className={labelClassName}>To</label>
        <input
          id="filter-to"
          type="date"
          className={controlClassName}
          value={state.to}
          aria-label="To date"
          onChange={(e) =>
            onChange((prev) => ({ ...prev, to: e.target.value, page: 1 }))
          }
        />
      </div>

      <div className="filter-group flex min-w-0 flex-col gap-1.5">
        <label htmlFor="filter-site" className={labelClassName}>Site</label>
        <select
          id="filter-site"
          className={controlClassName}
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
          {sitesList.map((site) => (
            <option key={site.id} value={site.id}>{site.name}</option>
          ))}
        </select>
      </div>

      <div className="filter-group flex min-w-0 flex-col gap-1.5">
        <label htmlFor="sort-field" className={labelClassName}>Sort by</label>
        <select
          id="sort-field"
          className={controlClassName}
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

      <div className="filter-group flex min-w-0 flex-col gap-1.5">
        <label htmlFor="sort-direction" className={labelClassName}>Order</label>
        <select
          id="sort-direction"
          className={controlClassName}
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
          <option value="desc">Newest first</option>
          <option value="asc">Oldest first</option>
        </select>
      </div>

      <div className="filter-group flex items-end">
        <button
          type="button"
          className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          onClick={onReset}
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Reset
        </button>
      </div>
    </form>
  );
}
