import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronRight } from "lucide-react";

interface RequestsPaginationProps {
  startRow: number;
  endRow: number;
  totalRows: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newPageSize: number) => void;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const MAX_VISIBLE_PAGES = 5;

export function RequestsPagination({
  startRow,
  endRow,
  totalRows,
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: RequestsPaginationProps) {
  const visiblePageCount = Math.min(MAX_VISIBLE_PAGES, totalPages);
  const firstVisiblePage = Math.max(
    1,
    Math.min(currentPage - Math.floor(MAX_VISIBLE_PAGES / 2), totalPages - visiblePageCount + 1),
  );
  const visiblePages = Array.from(
    { length: visiblePageCount },
    (_, index) => firstVisiblePage + index,
  );
  const visibleRowCount = Math.max(0, endRow - startRow + 1);

  return (
    <nav
      className="pagination mt-3 flex flex-wrap items-center justify-between gap-4 border-t border-border py-3"
      aria-label="Requests pagination"
    >
      <div className="pagination-info text-sm text-muted-foreground" role="status" aria-live="polite">
        Showing {visibleRowCount} of {totalRows} requests
      </div>

      <div className="pagination-controls flex flex-wrap items-center justify-end gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="btn-pagination px-2 text-muted-foreground"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          aria-label="Previous page"
        >
          Previous
        </Button>

        {visiblePages.map((page) => (
          <Button
            key={page}
            type="button"
            variant={page === currentPage ? "default" : "outline"}
            size="icon-sm"
            className={`btn-pagination ${page === currentPage ? "" : "bg-card text-muted-foreground"}`}
            onClick={() => onPageChange(page)}
            aria-label={`Page ${page}`}
            aria-current={page === currentPage ? "page" : undefined}
          >
            {page}
          </Button>
        ))}

        {currentPage < totalPages && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="btn-pagination text-muted-foreground"
            onClick={() => onPageChange(currentPage + 1)}
            aria-label="Next page"
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        )}

        {totalPages > firstVisiblePage + visiblePageCount - 1 && (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="btn-pagination bg-card text-muted-foreground"
            onClick={() => onPageChange(totalPages)}
            aria-label={`Last page, page ${totalPages}`}
          >
            {totalPages}
          </Button>
        )}

        <label className="sr-only" id="requests-page-size-label">Rows per page</label>
        <Select
          value={String(pageSize)}
          onValueChange={(value) => onPageSizeChange(Number(value))}
        >
          <SelectTrigger
            aria-labelledby="requests-page-size-label"
            aria-label="Rows per page"
            className="ml-1 h-10 w-[100px] cursor-pointer border-input bg-card px-2 text-xs text-muted-foreground"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" align="end">
            {PAGE_SIZE_OPTIONS.map((size) => (
              <SelectItem key={size} value={String(size)}>{size} / page</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </nav>
  );
}
