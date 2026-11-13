import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { LiveSyncStatus } from "@/features/requests";

export function ManagerHeader() {
  return (
    <header className="sticky top-0 z-10 flex min-h-14 h-auto shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border bg-background/95 px-3 py-2 backdrop-blur-xs supports-backdrop-filter:bg-background/60 sm:h-14 sm:flex-nowrap sm:px-4 sm:py-0">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <div className="flex min-w-0 items-center gap-2">
          <span className="hidden text-sm font-semibold tracking-tight text-foreground md:inline">
            Helpdesk Operations
          </span>
          <span className="hidden text-sm text-muted-foreground md:inline">/</span>
          <span className="truncate text-sm text-muted-foreground font-normal">
            Requests Board
          </span>
        </div>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <LiveSyncStatus />
      </div>
    </header>
  );
}
