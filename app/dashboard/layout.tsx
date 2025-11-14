import type { Metadata } from "next";
import "../globals.css";


export const metadata: Metadata = {
  title: "PMS Portal",
  description: "Portfolio Management System",
};

import { AppSidebar } from "@/components/app-sidebar"

import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { DashboardHeader } from "@/components/dashboard-header"
import { GlobalDragDrop } from "@/components/global-drag-drop"
import { DragDropHint } from "@/components/drag-drop-hint"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (  
    <GlobalDragDrop>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50/80 to-purple-50/60 dark:from-slate-900 dark:via-blue-950/50 dark:to-indigo-950/30">
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <DashboardHeader />
            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
              {children}
            </div>
            <DragDropHint />
          </SidebarInset>
        </SidebarProvider>
      </div>
    </GlobalDragDrop>
  );
}
