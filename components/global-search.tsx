"use client"

import * as React from "react"
import { Search, Command, FileText, TrendingUp, Users, DollarSign, ArrowUpRight, Star, Calculator, History } from "lucide-react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

const searchItems = [
  // Navigation Pages
  { 
    type: "page", 
    title: "Summary Dashboard", 
    description: "Overview of portfolio performance", 
    url: "/dashboard", 
    icon: TrendingUp,
    keywords: ["dashboard", "summary", "overview", "portfolio", "performance"]
  },
  { 
    type: "page", 
    title: "Technical Summary", 
    description: "Detailed technical analysis", 
    url: "/dashboard/dashboard-second", 
    icon: Calculator,
    keywords: ["technical", "analysis", "detailed", "metrics"]
  },
  { 
    type: "page", 
    title: "Graphs & Market Data", 
    description: "Visual charts and market information", 
    url: "/dashboard/graphs", 
    icon: TrendingUp,
    keywords: ["graphs", "charts", "market", "data", "visual"]
  },
  { 
    type: "page", 
    title: "DEMAT Holdings", 
    description: "Current stock holdings", 
    url: "/dashboard/demat-holdings", 
    icon: FileText,
    keywords: ["demat", "holdings", "stocks", "shares", "portfolio"]
  },
  { 
    type: "page", 
    title: "Order Books", 
    description: "Transaction order history", 
    url: "/dashboard/order-books", 
    icon: FileText,
    keywords: ["orders", "books", "transactions", "history"]
  },
  { 
    type: "page", 
    title: "View Ledger", 
    description: "Detailed transaction ledger", 
    url: "/dashboard/view-ledger", 
    icon: FileText,
    keywords: ["ledger", "transactions", "detailed", "records"]
  },
  { 
    type: "page", 
    title: "Transaction History", 
    description: "Complete transaction records", 
    url: "/dashboard/transaction-history", 
    icon: History,
    keywords: ["transaction", "history", "records", "complete"]
  },
  { 
    type: "page", 
    title: "Manual Stock History", 
    description: "Manually entered stock records", 
    url: "/dashboard/manual-stock-history", 
    icon: FileText,
    keywords: ["manual", "stock", "history", "records", "entry"]
  },
  { 
    type: "page", 
    title: "Tax Base Calculation", 
    description: "Tax calculation and reports", 
    url: "/dashboard/tax-base-calculation", 
    icon: Calculator,
    keywords: ["tax", "calculation", "reports", "base"]
  },
  { 
    type: "page", 
    title: "Audit Log", 
    description: "System audit and activity logs", 
    url: "/dashboard/audit-log", 
    icon: FileText,
    keywords: ["audit", "log", "activity", "system", "records"]
  }
]

export function GlobalSearch() {
  const [isOpen, setIsOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const router = useRouter()

  // Filter items based on search query
  const filteredItems = React.useMemo(() => {
    if (!searchQuery.trim()) return searchItems

    const query = searchQuery.toLowerCase()
    return searchItems.filter(item => 
      item.title.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      item.keywords.some(keyword => keyword.toLowerCase().includes(query))
    )
  }, [searchQuery])

  // Reset selected index when filtered items change
  React.useEffect(() => {
    setSelectedIndex(0)
  }, [filteredItems])

  // Handle item selection
  const handleItemSelect = (item: typeof searchItems[0]) => {
    if (item.type === "page" && item.url) {
      router.push(item.url)
      setIsOpen(false)
      setSearchQuery("")
      setSelectedIndex(0)
    }
  }

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (filteredItems.length === 0) return

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setSelectedIndex(prev => 
          prev < filteredItems.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        event.preventDefault()
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : filteredItems.length - 1
        )
        break
      case 'Enter':
        event.preventDefault()
        if (filteredItems[selectedIndex]) {
          handleItemSelect(filteredItems[selectedIndex])
        }
        break
    }
  }

  // Keyboard shortcut handler
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault()
        setIsOpen(true)
      }
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false)
        setSearchQuery("")
        setSelectedIndex(0)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          title="Global Search (Ctrl+K)"
        >
          <Search className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Command className="h-5 w-5" />
            Quick Search
          </DialogTitle>
        </DialogHeader>
        
        <div className="px-6 py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search pages and navigate quickly..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-10 pr-4"
              autoFocus
            />
          </div>
        </div>

        <div className="max-h-[400px] overflow-y-auto px-6 pb-6">
          {filteredItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No results found for "{searchQuery}"</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems.map((item, index) => {
                const Icon = item.icon
                return (
                  <div
                    key={index}
                    onClick={() => handleItemSelect(item)}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors group ${
                      index === selectedIndex 
                        ? 'bg-accent text-accent-foreground' 
                        : 'hover:bg-muted'
                    }`}
                  >
                    <div className="p-2 rounded-md bg-blue-100 text-blue-600">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm group-hover:text-foreground">
                          {item.title}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          Page
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {item.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t bg-muted/30">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-background border rounded text-[10px]">↑↓</kbd>
                to navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-background border rounded text-[10px]">Enter</kbd>
                to select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-background border rounded text-[10px]">Esc</kbd>
                to close
              </span>
            </div>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-background border rounded text-[10px]">Ctrl</kbd>
              <kbd className="px-1.5 py-0.5 bg-background border rounded text-[10px]">K</kbd>
              to open
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
