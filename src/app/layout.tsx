import React from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ManagerHeader, ManagerSidebar } from "@/components/layout";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <ManagerSidebar />
      <SidebarInset className="min-h-screen flex flex-col bg-background">
        <ManagerHeader />
        <main className="min-w-0 flex-1 p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
