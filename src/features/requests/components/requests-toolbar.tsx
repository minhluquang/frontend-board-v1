import { RotateCcw } from "lucide-react";
import type { Site } from "@/features/requests/types";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="filter-group flex min-w-0 flex-col gap-1.5">
        <label htmlFor="filter-from" className={labelClassName}>From</label>
        <DatePicker
          id="filter-from"
          ariaLabel="From date"
          value={state.from}
          onChange={(from) => onChange((prev) => ({ ...prev, from, page: 1 }))}
        />
      </div>

      <div className="filter-group flex min-w-0 flex-col gap-1.5">
        <label htmlFor="filter-to" className={labelClassName}>To</label>
        <DatePicker
          id="filter-to"
          ariaLabel="To date"
          value={state.to}
          onChange={(to) => onChange((prev) => ({ ...prev, to, page: 1 }))}
        />
      </div>

      <div className="filter-group flex min-w-0 flex-col gap-1.5">
        <label htmlFor="filter-site" className={labelClassName}>Site</label>
        <Select
          value={state.siteId === null ? "all" : String(state.siteId)}
          onValueChange={(value) =>
            onChange((prev) => ({
              ...prev,
              siteId: value === "all" ? null : Number(value),
              page: 1,
            }))
          }
        >
          <SelectTrigger id="filter-site" aria-label="Filter by site" className={controlClassName}>
            <SelectValue placeholder="All sites" />
          </SelectTrigger>
          <SelectContent position="popper" align="start">
            <SelectItem value="all">All sites</SelectItem>
            {sitesList.map((site) => (
              <SelectItem key={site.id} value={String(site.id)}>{site.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="filter-group flex min-w-0 flex-col gap-1.5">
        <label htmlFor="sort-field" className={labelClassName}>Sort by</label>
        <Select
          value={state.sortField}
          onValueChange={(value) =>
            onChange((prev) => ({
              ...prev,
              sortField: value as SortField,
              page: 1,
            }))
          }
        >
          <SelectTrigger id="sort-field" aria-label="Sort by field" className={controlClassName}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" align="start">
            <SelectItem value="created">Created date</SelectItem>
            <SelectItem value="due">Due date</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="filter-group flex min-w-0 flex-col gap-1.5">
        <label htmlFor="sort-direction" className={labelClassName}>Order</label>
        <Select
          value={state.sortDirection}
          onValueChange={(value) =>
            onChange((prev) => ({
              ...prev,
              sortDirection: value as SortDirection,
              page: 1,
            }))
          }
        >
          <SelectTrigger id="sort-direction" aria-label="Sort direction" className={controlClassName}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" align="start">
            <SelectItem value="desc">Newest first</SelectItem>
            <SelectItem value="asc">Oldest first</SelectItem>
          </SelectContent>
        </Select>
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
