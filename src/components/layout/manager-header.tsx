import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { LiveSyncStatus } from "@/features/requests";

export function ManagerHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-xs supports-backdrop-filter:bg-background/60">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-tight text-foreground">
            Helpdesk Operations
          </span>
          <span className="text-muted-foreground text-sm">/</span>
          <span className="text-sm text-muted-foreground font-normal">
            Requests Board
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <LiveSyncStatus />
      </div>
    </header>
  );
}
