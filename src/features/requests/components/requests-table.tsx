import type { HelpdeskRequest, Site, Staff } from "@/features/requests/types";
import { formatSiteDateTime } from "../dates";
import {
  isRequestOverdue,
  resolveAssigneeName,
  type SortDirection,
  type SortField,
} from "../rules";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface RequestsTableProps {
  requests: HelpdeskRequest[];
  sitesMap: Map<number, Site>;
  staffMap: Map<number, Staff>;
  sitesLoading: boolean;
  sortField: SortField;
  sortDirection: SortDirection;
  onToggleSort: (field: SortField) => void;
  onSelectRequest?: (id: number) => void;
}

export function RequestsTable({
  requests,
  sitesMap,
  staffMap,
  sitesLoading,
  sortField,
  sortDirection,
  onToggleSort,
  onSelectRequest,
}: RequestsTableProps) {
  return (
    <div
      className="table-container rounded-lg border border-border bg-card overflow-x-auto shadow-xs"
      tabIndex={0}
      role="region"
      aria-label="Requests table"
    >
      <Table className="w-full text-sm">
        <caption className="sr-only">Helpdesk Requests</caption>
        <TableHeader className="bg-muted/40">
          <TableRow className="hover:bg-transparent">
            <TableHead scope="col" className="font-semibold text-foreground">
              Site
            </TableHead>
            <TableHead scope="col" className="font-semibold text-foreground">
              Ref
            </TableHead>
            <TableHead scope="col" className="font-semibold text-foreground min-w-[200px]">
              Title
            </TableHead>
            <TableHead scope="col" className="font-semibold text-foreground">
              Priority
            </TableHead>
            <TableHead scope="col" className="font-semibold text-foreground">
              Status
            </TableHead>
            <TableHead scope="col" className="font-semibold text-foreground">
              Assignee
            </TableHead>
            <TableHead
              scope="col"
              className="font-semibold text-foreground"
              aria-sort={
                sortField === "due"
                  ? sortDirection === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
            >
              <button
                type="button"
                className="th-button inline-flex items-center gap-1 font-semibold text-foreground hover:text-primary transition-colors cursor-pointer"
                aria-label={`Sort by due date, currently ${
                  sortField === "due" ? sortDirection : "unsorted"
                }`}
                onClick={() => onToggleSort("due")}
              >
                Due {sortField === "due" ? (sortDirection === "asc" ? "▲" : "▼") : ""}
              </button>
            </TableHead>
            <TableHead scope="col" className="font-semibold text-foreground">
              Overdue
            </TableHead>
            <TableHead
              scope="col"
              className="font-semibold text-foreground"
              aria-sort={
                sortField === "created"
                  ? sortDirection === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
            >
              <button
                type="button"
                className="th-button inline-flex items-center gap-1 font-semibold text-foreground hover:text-primary transition-colors cursor-pointer"
                aria-label={`Sort by created date, currently ${
                  sortField === "created" ? sortDirection : "unsorted"
                }`}
                onClick={() => onToggleSort("created")}
              >
                Created {sortField === "created" ? (sortDirection === "asc" ? "▲" : "▼") : ""}
              </button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((r) => {
            const site = sitesMap.get(r.site_id);
            const siteName =
              site?.name ?? (sitesLoading ? "Loading…" : `Site ${r.site_id}`);
            const siteTimezone = site?.timezone;
            const overdue = isRequestOverdue(r, siteTimezone);
            // Rule 3: Resolve assignee name strictly by id from staff endpoint
            const assigneeName = resolveAssigneeName(r.assignee, staffMap);

            return (
              <TableRow
                key={r.id}
                className={
                  overdue === true
                    ? "row-overdue bg-destructive/5 hover:bg-destructive/10"
                    : undefined
                }
              >
                <TableCell className="font-medium">{siteName}</TableCell>
                <TableCell className="font-mono text-xs">
                  {onSelectRequest ? (
                    <button
                      type="button"
                      onClick={() => onSelectRequest(r.id)}
                      className="font-mono text-primary underline-offset-4 hover:underline cursor-pointer text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-xs"
                      aria-label={`View details for ${r.ref}`}
                    >
                      {r.ref}
                    </button>
                  ) : (
                    r.ref
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  {onSelectRequest ? (
                    <button
                      type="button"
                      onClick={() => onSelectRequest(r.id)}
                      className="text-foreground hover:text-primary underline-offset-4 hover:underline cursor-pointer text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-xs font-medium"
                      aria-label={`View details for ${r.title}`}
                    >
                      {r.title}
                    </button>
                  ) : (
                    r.title
                  )}
                </TableCell>
                <TableCell>
                  {r.priority === "High" ? (
                    <Badge variant="destructive" className="badge badge-priority-high">
                      High
                    </Badge>
                  ) : r.priority === "Medium" ? (
                    <Badge
                      variant="outline"
                      className="badge badge-priority-medium border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                    >
                      Medium
                    </Badge>
                  ) : r.priority === "Low" ? (
                    <Badge variant="outline" className="badge badge-priority-low text-muted-foreground">
                      Low
                    </Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  {r.status === "pending" ? (
                    <Badge
                      variant="outline"
                      className="badge badge-status-pending border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                    >
                      pending
                    </Badge>
                  ) : r.status === "processing" ? (
                    <Badge
                      variant="outline"
                      className="badge badge-status-processing border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                    >
                      processing
                    </Badge>
                  ) : r.status === "complete" ? (
                    <Badge
                      variant="outline"
                      className="badge badge-status-complete border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    >
                      complete
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="badge badge-status-canceled">
                      {r.status}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{assigneeName}</TableCell>
                <TableCell>{r.due_on ?? "—"}</TableCell>
                <TableCell>
                  {overdue === true ? (
                    <Badge variant="destructive" className="badge badge-overdue font-semibold" role="status">
                      Overdue
                    </Badge>
                  ) : overdue === null ? (
                    <Badge
                      variant="outline"
                      className="badge badge-warning border-amber-300 bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                      title="Cannot determine overdue status without site timezone"
                    >
                      Missing timezone
                    </Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-xs">
                  {siteTimezone ? (
                    formatSiteDateTime(r.created_at, siteTimezone)
                  ) : (
                    <span className="muted text-muted-foreground">Missing timezone</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
