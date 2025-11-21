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
  Users,
  AppWindow,
} from "lucide-react"
import { useRouter } from "next/navigation"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import { KeyboardShortcutsHelp } from "@/components/keyboard-shortcuts-help"
import { GlobalSearch } from "@/components/global-search"
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
      shortcut: "Alt+1",
    },
    {
      title: "Technical Summary",
      url: "/dashboard/dashboard-second",
      icon: FileDigit,
      shortcut: "Alt+2",
    },
    {
      title: "Graphs + Market Data",
      url: "/dashboard/graphs",
      icon: Rows4,
      shortcut: "Alt+3",
    },
    {
      title: "DEMAT Holdings",
      url: "/dashboard/demat-holdings",
      icon: Layers,
      shortcut: "Alt+4",
    },
    {
      title: "Order Books",
      url: "/dashboard/order-books",
      icon: Upload,
      shortcut: "Alt+5",
    },
    {
      title: "View Ledger",
      url: "/dashboard/view-ledger",
      icon: LibraryBig,
      shortcut: "Alt+6",
    },
    {
      title: "Transaction History",
      url: "/dashboard/transaction-history",
      icon: History,
      shortcut: "Alt+7",
    },
    {
      title: "Manual Stock History",
      url: "/dashboard/manual-stock-history",
      icon: BookText,
      shortcut: "Alt+8",
    },
    {
      title: "Tax Base Calculation",
      url: "/dashboard/tax-base-calculation",
      icon: AppWindow,
      shortcut: "Alt+9",
    },
    {
      title: "Audit Log",
      url: "/dashboard/audit-log",
      icon: ClipboardClock,
      shortcut: "Alt+0",
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
  const router = useRouter();

  // Keyboard shortcut handler
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && !event.ctrlKey && !event.shiftKey && !event.metaKey) {
        const key = event.key;
        let targetUrl: string | null = null;

        switch (key) {
          case '1':
            targetUrl = '/dashboard';
            break;
          case '2':
            targetUrl = '/dashboard/dashboard-second';
            break;
          case '3':
            targetUrl = '/dashboard/graphs';
            break;
          case '4':
            targetUrl = '/dashboard/demat-holdings';
            break;
          case '5':
            targetUrl = '/dashboard/order-books';
            break;
          case '6':
            targetUrl = '/dashboard/view-ledger';
            break;
          case '7':
            targetUrl = '/dashboard/transaction-history';
            break;
          case '8':
            targetUrl = '/dashboard/manual-stock-history';
            break;
          case '9':
            targetUrl = '/dashboard/tax-base-calculation';
            break;
          case '0':
            targetUrl = '/dashboard/audit-log';
            break;
          case 'p':
          case 'P':
            // Trigger promoter dialog
            event.preventDefault();
            const promoterButton = document.querySelector('[data-promoter-dialog-trigger]') as HTMLButtonElement;
            if (promoterButton) {
              promoterButton.click();
            }
            return;
          case 'b':
          case 'B':
            // Trigger bonus dialog
            event.preventDefault();
            const bonusButton = document.querySelector('[data-bonus-dialog-trigger]') as HTMLButtonElement;
            if (bonusButton) {
              bonusButton.click();
            }
            return;
          case 'r':
          case 'R':
            // Trigger rights dialog
            event.preventDefault();
            const rightsButton = document.querySelector('[data-rights-dialog-trigger]') as HTMLButtonElement;
            if (rightsButton) {
              rightsButton.click();
            }
            return;
          case 'c':
          case 'C':
            // Trigger cash dialog
            event.preventDefault();
            const cashButton = document.querySelector('[data-cash-dialog-trigger]') as HTMLButtonElement;
            if (cashButton) {
              cashButton.click();
            }
            return;
          case 'i':
          case 'I':
            // Trigger IPO allotment dialog
            event.preventDefault();
            const ipoButton = document.querySelector('[data-ipo-dialog-trigger]') as HTMLButtonElement;
            if (ipoButton) {
              ipoButton.click();
            }
            return;
          case 'x':
          case 'X':
            // Trigger stock splitter dialog
            event.preventDefault();
            const stockSplitterButton = document.querySelector('[data-stock-splitter-trigger]') as HTMLButtonElement;
            if (stockSplitterButton) {
              stockSplitterButton.click();
            }
            return;
          case '?':
          case '/':
            // Trigger help dialog (handled by the KeyboardShortcutsHelp component)
            event.preventDefault();
            const helpButton = document.querySelector('[title="Keyboard Shortcuts (Alt + ?)"]') as HTMLButtonElement;
            if (helpButton) {
              helpButton.click();
            }
            return;
        }

        if (targetUrl) {
          event.preventDefault();
          router.push(targetUrl);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [router]);

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center justify-between w-full">
              <SidebarMenuButton size="default" asChild className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 h-12 flex-1">
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
              <div className="flex items-center gap-1 ml-2">
                <GlobalSearch />
                <KeyboardShortcutsHelp />
              </div>
            </div>
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
