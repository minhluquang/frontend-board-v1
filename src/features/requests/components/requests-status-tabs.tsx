import type { Status } from "@/features/requests/types";

export type StatusFilter = Exclude<Status, "canceled"> | "all";

export interface StatusCounts {
  all: number;
  pending: number;
  processing: number;
  complete: number;
}

interface RequestsStatusTabsProps {
  value: StatusFilter;
  counts: StatusCounts;
  loading: boolean;
  onChange: (status: StatusFilter) => void;
}

const statuses: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "complete", label: "Complete" },
];

export function RequestsStatusTabs({
  value,
  counts,
  loading,
  onChange,
}: RequestsStatusTabsProps) {
  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-x-6 border-b border-border"
      role="group"
      aria-label="Filter requests by status"
    >
      {statuses.map((status) => {
        const selected = value === status.value;
        return (
          <button
            key={status.value}
            type="button"
            aria-pressed={selected}
            className={`relative -mb-px inline-flex min-h-10 cursor-pointer items-center gap-2 border-b-2 px-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
              selected
                ? "border-primary font-semibold text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            }`}
            onClick={() => onChange(status.value)}
          >
            <span>{status.label}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
                selected
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
              aria-label={loading ? "Count loading" : `${counts[status.value]} requests`}
            >
              {loading ? "—" : counts[status.value]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
