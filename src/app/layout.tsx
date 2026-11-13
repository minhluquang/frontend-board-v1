import React from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ManagerHeader, ManagerSidebar } from "@/components/layout";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      <ManagerSidebar />
      <SidebarInset className="min-h-screen flex flex-col bg-background">
        <ManagerHeader />
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
