"use client"

import * as React from "react"
import { Keyboard, HelpCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

const shortcuts = [
  { key: "Alt + 1", action: "Summary", url: "/dashboard" },
  { key: "Alt + 2", action: "Technical Summary", url: "/dashboard/dashboard-second" },
  { key: "Alt + 3", action: "Graphs + Market Data", url: "/dashboard/graphs" },
  { key: "Alt + 4", action: "DEMAT Holdings", url: "/dashboard/demat-holdings" },
  { key: "Alt + 5", action: "Order Books", url: "/dashboard/order-books" },
  { key: "Alt + 6", action: "View Ledger", url: "/dashboard/view-ledger" },
  { key: "Alt + 7", action: "Transaction History", url: "/dashboard/transaction-history" },
  { key: "Alt + 8", action: "Manual Stock History", url: "/dashboard/manual-stock-history" },
  { key: "Alt + 9", action: "Tax Base Calculation", url: "/dashboard/tax-base-calculation" },
  { key: "Alt + 0", action: "Audit Log", url: "/dashboard/audit-log" },
]

const dialogShortcuts = [
  { key: "Alt + P", action: "Open Promoter Dialog" },
  { key: "Alt + B", action: "Open Bonus Dialog" },
  { key: "Alt + R", action: "Open Rights Dialog" },
  { key: "Alt + C", action: "Open Cash Dialog" },
  { key: "Alt + I", action: "Open IPO Allotment Dialog" },
  { key: "Alt + X", action: "Open Stock Splitter" },
]

export function KeyboardShortcutsHelp() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          title="Keyboard Shortcuts (Alt + ?)"
        >
          <Keyboard className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts Reference
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Use these keyboard shortcuts to quickly navigate and perform actions throughout the application:
          </p>
          
          {/* Navigation Shortcuts */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              Navigation Shortcuts
            </h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
              {shortcuts.map((shortcut) => (
                <div
                  key={shortcut.key}
                  className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 transition-colors"
                >
                  <span className="text-sm font-medium">{shortcut.action}</span>
                  <kbd className="inline-flex h-6 select-none items-center gap-1 rounded border bg-muted px-2 font-mono text-[11px] font-medium text-muted-foreground shadow-sm">
                    {shortcut.key.replace('Alt', '⌥')}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
          
          {/* Dialog Shortcuts */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Dialog Shortcuts
            </h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
              {dialogShortcuts.map((shortcut) => (
                <div
                  key={shortcut.key}
                  className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 transition-colors"
                >
                  <span className="text-sm font-medium">{shortcut.action}</span>
                  <kbd className="inline-flex h-6 select-none items-center gap-1 rounded border bg-muted px-2 font-mono text-[11px] font-medium text-muted-foreground shadow-sm">
                    {shortcut.key.replace('Alt', '⌥')}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
          
          {/* System Shortcuts */}
          <div className="pt-4 border-t">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
              System & Help
            </h3>
            <div className="grid grid-cols-1 gap-y-2">
              <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 transition-colors">
                <span className="text-sm font-medium">Global Search</span>
                <kbd className="inline-flex h-6 select-none items-center gap-1 rounded border bg-muted px-2 font-mono text-[11px] font-medium text-muted-foreground shadow-sm">
                  Ctrl + K
                </kbd>
              </div>
              <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 transition-colors">
                <span className="text-sm font-medium">Show this help dialog</span>
                <kbd className="inline-flex h-6 select-none items-center gap-1 rounded border bg-muted px-2 font-mono text-[11px] font-medium text-muted-foreground shadow-sm">
                  ⌥ + ?
                </kbd>
              </div>
            </div>
          </div>
          
          {/* Tips */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">💡 Pro Tips</h4>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• All shortcuts work from any page in the application</li>
              <li>• Hold Alt key and press the corresponding key for instant access</li>
              <li>• Use Ctrl+K to quickly search for pages, actions, or features</li>
              <li>• Dialog shortcuts open forms directly without navigation</li>
              <li>• Use Esc key to close any open dialog or search</li>
              <li>• Theme toggle supports light, dark, and system preferences</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
