"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ModeToggle } from "./toggle-button";

export function DashboardHeader() {

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 mb-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <ModeToggle />
      </div>
    </header>
  );
}
