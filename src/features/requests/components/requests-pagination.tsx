import { Button } from "@/components/ui/button";

interface RequestsPaginationProps {
  startRow: number;
  endRow: number;
  totalRows: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
}

export function RequestsPagination({
  startRow,
  endRow,
  totalRows,
  currentPage,
  totalPages,
  onPageChange,
}: RequestsPaginationProps) {
  return (
    <nav
      className="pagination flex flex-wrap items-center justify-between gap-4 mt-4 py-2"
      aria-label="Requests pagination"
    >
      <div className="pagination-info text-sm text-muted-foreground" role="status" aria-live="polite">
        Showing {startRow}–{endRow} of {totalRows} requests
      </div>
      <div className="pagination-controls flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="btn-pagination"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          aria-label="Previous page"
        >
          Previous
        </Button>
        <span className="pagination-current-page text-sm font-medium" aria-current="page">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="btn-pagination"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
