import { Inbox } from "lucide-react";
import fullLogo from "@/assets/brand/robust-tech-house.png";
import houseMark from "@/assets/brand/robust-tech-house-mark.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

export function ManagerSidebar() {
  const requestsHref = (() => {
    if (typeof window === "undefined") return "/";
    const url = new URL(window.location.href);
    url.searchParams.delete("requestId");
    url.searchParams.delete("request");
    return `${url.pathname}${url.search}`;
  })();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <div className="flex min-h-8 items-center justify-center">
          <img
            src={fullLogo}
            alt="Robust Tech House"
            className="h-auto w-36 group-data-[collapsible=icon]:hidden"
          />
          <img
            src={houseMark}
            alt="Robust Tech House"
            className="hidden size-8 object-contain group-data-[collapsible=icon]:block"
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive tooltip="Requests Board" asChild>
                  <a href={requestsHref} aria-current="page">
                    <Inbox className="size-4" />
                    <span>Requests</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
