"use client"

import * as React from "react"
import {
  ChartCandlestick,
  Cable,
  LibraryBig,
  History,
  Upload,
  ClipboardClock,
  BriefcaseBusiness,
  FileDigit,
  Activity,
  TicketSlash,
  CalendarPlus2,
  Rows4,
  BookText,
  Layers,
  Tag,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import Link from "next/link"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
  navMain: [
    {
      title: "Summary",
      url: "/dashboard",
      icon: ChartCandlestick,
    },
          {
      title: "Metric Dashboard",
      url: "/dashboard/dashboard-second",
      icon: FileDigit,
    },
              {
      title: "Graphs + Market Data",
      url: "/dashboard/graphs",
      icon: Rows4,
    },
    {
      title: "DEMAT Holdings",
      url: "/dashboard/demat-holdings",
      icon: Layers,
    },
      {
      title: "Order Books",
      url: "/dashboard/order-books",
      icon: Upload,
    },
    //     {
    //   title: "Balance Records",
    //   url: "/dashboard/balance-records",
    //   icon: NotebookText,
    // },
    {
      title: "View Ledger",
      url: "/dashboard/view-ledger",
      icon: LibraryBig,
    },
    // {
    //   title: "Filter and Export",
    //   url: "/dashboard/filter-and-export",
    //   icon: Funnel,
    // },
    {
      title: "Transaction History",
      url: "/dashboard/transaction-history",
      icon: History,
    },
    {
      title: "Manual Stock History",
      url: "/dashboard/manual-stock-history",
      icon: BookText,
    },
    {
      title: "Audit Log",
      url: "/dashboard/audit-log",
      icon: ClipboardClock,
    },
  ],
  navSecondary: [
    {
      title: "Listed Stocks",
      url: "/dashboard/listed-stocks",
      icon: Activity,
    },
        {
      title: "Current Funds",
      url: "/dashboard/current-funds",
      icon: TicketSlash,
    },
        {
      title: "Fiscal Year Mapping",
      url: "/dashboard/fiscal-year-mapping",
      icon: CalendarPlus2,
    },
        {
      title: "Client Broker Mapping",
      url: "/dashboard/client-broker-mapping",
      icon: Cable,
    },
        {
      title: "Sub Classes",
      url: "/dashboard/sub-class",
      icon: Tag,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="default" asChild className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 h-12">
              <Link href="/dashboard">
                <div className="bg-indigo-700 text-white flex aspect-square size-8 items-center justify-center rounded-lg">
                  <BriefcaseBusiness className="size-4" />
                </div>
                <div className="grid flex-1 text-left leading-tight ml-2">
                  <span className="truncate font-semibold text-sm text-gray-900">Prabhu Capital</span>
                  <span className="truncate text-[11px] font-medium text-blue-600 tracking-tight leading-3" suppressHydrationWarning>
                    Portfolio Management System
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
