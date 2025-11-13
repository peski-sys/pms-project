"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import Link from "next/link"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"


import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectLabel,
  SelectValue,
} from "@/components/ui/select"

import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { RefreshCw, Download, Search, X, Settings } from "lucide-react"
import { Pagination } from "@/components/ui/pagination"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { useState, useEffect, useMemo } from "react"
import { getUsers } from "@/app/api/dashboardAPICalls/actions"
import { getFiscal } from "@/app/api/fiscalAPI/actions"
import { getMetricDataTradingFiscal, getMetricDataPromoterFiscal, getSubClassesForFund, getMetricDataSubClassFiscal } from "@/app/api/secondDashboardFiscalAPI/actions"
import { universalExport } from "@/app/api/universalExport/actions"
import { triggerFileDownload } from "@/lib/downloadUtils"
import { toast } from "sonner"
import InlineRemarks from "@/components/ui/inline-remarks"
import { saveFYBRemarks, savePromoterRemarks, saveSymbolHoldingsRemarks } from "@/app/api/remarks/actions"

type cbMAP = {
  client_id: string,
  client_name: string,
  client_broker: number,
  recorded_at: Date | null,
} 
type fiscals = {
  fiscal_year_id: number,
  year_label: string,
  start_date: Date,
  end_date: Date
}

type MetricData = {
    // Company Info
    company: string
    code: string
    category: string
    
    // Opening
    opening_quantity: number
    opening_rate: number
    opening_amount: number
    
    // Purchase
    purchase_quantity: number
    purchase_rate: number
    purchase_amount: number
    
    // Right Share
    right_quantity: number
    right_total: number
    
    // Bonus
    bonus_quantity: number
    bonus_book_close_date: string
    
    // Sales
    sales_quantity: number
    sales_cost: number
    sales_amount: number
    sales_profit: number
    
    // Closing
    closing_quantity: number
    closing_rate: number
    closing_amount: number
    
    // DEMAT/NON_DEMAT
    demat: number
    non_demat: number
    
    // Market Price
    market_price: number
    
    // Capital Gain/Loss
    unrealised_amount: number
    
    // Return
    today_return_percent: number

    // Remarks (optional)
    remarks?: string
    
    // IPO Staging indicator (optional)
    isIPOStaging?: boolean
}

export default function DashboardTwo() {
  const [initialUser, setInitialUser] = useState<string>("")
  const [getFiscals, setFiscals] = useState<fiscals[]>()
  const [givenUsers, setUsers] = useState<cbMAP[]>([])
  const [fiscalID, setFiscalID] = useState<string>('')
  const [currentFund, setcurrentFund] = useState<string>('')
  const [tradingData, setTradingData] = useState<MetricData[]>([])
  const [promoterData, setPromoterData] = useState<MetricData[]>([])
  const [subClasses, setSubClasses] = useState<{sub_id: number, sub_name: string}[]>([])
  const [subClassData, setSubClassData] = useState<Map<number, MetricData[]>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isLoadingMain, setisLoadingMain] = useState(true)
  
  // Pagination states for trading table
  const [tradingCurrentPage, setTradingCurrentPage] = useState(1)
  const [tradingItemsPerPage, setTradingItemsPerPage] = useState(10)
  const [tradingSortField, setTradingSortField] = useState<string | null>(null)
  const [tradingSortOrder, setTradingSortOrder] = useState<'asc' | 'desc'>('asc')
  
  // Pagination states for promoter table
  const [promoterCurrentPage, setPromoterCurrentPage] = useState(1)
  const [promoterItemsPerPage, setPromoterItemsPerPage] = useState(10)
  const [promoterSortField, setPromoterSortField] = useState<string | null>(null)
  const [promoterSortOrder, setPromoterSortOrder] = useState<'asc' | 'desc'>('asc')
  
  // Pagination states for sub class tables
  const [subClassCurrentPages, setSubClassCurrentPages] = useState<Map<number, number>>(new Map())
  const [subClassItemsPerPage, setSubClassItemsPerPage] = useState(10)
  const [subClassSortFields, setSubClassSortFields] = useState<Map<number, string>>(new Map())
  const [subClassSortOrders, setSubClassSortOrders] = useState<Map<number, 'asc' | 'desc'>>(new Map())

  // Search and column visibility states for Trading table
  const [tradingSearchTerm, setTradingSearchTerm] = useState<string>("")
  const [tradingColumnVisibility, setTradingColumnVisibility] = useState({
    company: true,
    code: true,
    category: true,
    opening_quantity: true,
    opening_rate: true,
    opening_amount: true,
    purchase_quantity: true,
    purchase_rate: true,
    purchase_amount: true,
    right_quantity: true,
    right_total: true,
    bonus_quantity: true,
    bonus_book_close_date: true,
    sales_quantity: true,
    sales_cost: true,
    sales_amount: true,
    sales_profit: true,
    closing_quantity: true,
    closing_rate: true,
    closing_amount: true,
    demat: true,
    non_demat: true,
    market_price: true,
    unrealised_amount: true,
    today_return_percent: true,
    remarks: true
  })

  // Search and column visibility states for Promoter table
  const [promoterSearchTerm, setPromoterSearchTerm] = useState<string>("")
  const [promoterColumnVisibility, setPromoterColumnVisibility] = useState({
    company: true,
    code: true,
    category: true,
    opening_quantity: true,
    opening_rate: true,
    opening_amount: true,
    purchase_quantity: true,
    purchase_rate: true,
    purchase_amount: true,
    right_quantity: true,
    right_total: true,
    bonus_quantity: true,
    bonus_book_close_date: true,
    sales_quantity: true,
    sales_cost: true,
    sales_amount: true,
    sales_profit: true,
    closing_quantity: true,
    closing_rate: true,
    closing_amount: true,
    demat: true,
    non_demat: true,
    market_price: true,
    revaluation_amount: true,
    remarks: true
  })

  // Search and column visibility states for Sub-class tables
  const [subClassSearchTerms, setSubClassSearchTerms] = useState<Map<number, string>>(new Map())
  const [subClassColumnVisibility, setSubClassColumnVisibility] = useState<Map<number, any>>(new Map())

  // Consolidation function for trading data
  const consolidateTradingData = (data: MetricData[]) => {
    const consolidated = new Map<string, MetricData>()
    
    data.forEach(item => {
      const key = `${item.code}_${fiscalID}_${currentFund}`
      
      if (consolidated.has(key)) {
        const existing = consolidated.get(key)!
        
        // Sum quantities
        const totalOpeningQty = existing.opening_quantity + item.opening_quantity
        const totalPurchaseQty = existing.purchase_quantity + item.purchase_quantity
        const totalRightQty = existing.right_quantity + item.right_quantity
        const totalBonusQty = existing.bonus_quantity + item.bonus_quantity
        const totalSalesQty = existing.sales_quantity + item.sales_quantity
        const totalClosingQty = existing.closing_quantity + item.closing_quantity
        const totalDemat = existing.demat + item.demat
        const totalNonDemat = existing.non_demat + item.non_demat
        
        // Sum amounts
        const totalOpeningAmount = existing.opening_amount + item.opening_amount
        const totalPurchaseAmount = existing.purchase_amount + item.purchase_amount
        const totalRightTotal = existing.right_total + item.right_total
        const totalSalesAmount = existing.sales_amount + item.sales_amount
        const totalSalesProfit = existing.sales_profit + item.sales_profit
        const totalClosingAmount = existing.closing_amount + item.closing_amount
        const totalUnrealisedAmount = existing.unrealised_amount + item.unrealised_amount
        
        // Calculate weighted average rates
        const avgOpeningRate = totalOpeningQty > 0 ? totalOpeningAmount / totalOpeningQty : 0
        const avgPurchaseRate = totalPurchaseQty > 0 ? totalPurchaseAmount / totalPurchaseQty : 0
        const avgClosingRate = totalClosingQty > 0 ? totalClosingAmount / totalClosingQty : 0
        const avgSalesCost = totalSalesQty > 0 ? existing.sales_cost + item.sales_cost : 0
        
        // Calculate average return percentage based on total amounts
        const avgReturnPercent = totalClosingAmount > 0 ? (totalUnrealisedAmount / totalClosingAmount) * 100 : 0
        
        consolidated.set(key, {
          ...existing,
          opening_quantity: totalOpeningQty,
          opening_rate: avgOpeningRate,
          opening_amount: totalOpeningAmount,
          purchase_quantity: totalPurchaseQty,
          purchase_rate: avgPurchaseRate,
          purchase_amount: totalPurchaseAmount,
          right_quantity: totalRightQty,
          right_total: totalRightTotal,
          bonus_quantity: totalBonusQty,
          sales_quantity: totalSalesQty,
          sales_cost: avgSalesCost,
          sales_amount: totalSalesAmount,
          sales_profit: totalSalesProfit,
          closing_quantity: totalClosingQty,
          closing_rate: avgClosingRate,
          closing_amount: totalClosingAmount,
          demat: totalDemat,
          non_demat: totalNonDemat,
          unrealised_amount: totalUnrealisedAmount,
          today_return_percent: avgReturnPercent
        })
      } else {
        consolidated.set(key, { ...item })
      }
    })
    
    return Array.from(consolidated.values())
  }

  // Memoized consolidated and paginated data
  const consolidatedTradingData = useMemo(() => {
    return consolidateTradingData(tradingData)
  }, [tradingData, fiscalID, currentFund])

  // Sort, filter and paginate trading data
  const sortedTradingData = useMemo(() => {
    let filtered = [...consolidatedTradingData]
    
    // Apply search filtering
    if (tradingSearchTerm.trim()) {
      filtered = filtered.filter((item) =>
        item.company.toLowerCase().includes(tradingSearchTerm.toLowerCase()) ||
        item.code.toLowerCase().includes(tradingSearchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(tradingSearchTerm.toLowerCase())
      )
    }
    
    // Apply sorting
    if (tradingSortField) {
      filtered.sort((a, b) => {
        const aValue = a[tradingSortField as keyof typeof a]
        const bValue = b[tradingSortField as keyof typeof b]
        
        if (aValue == null && bValue == null) return 0
        if (aValue == null) return tradingSortOrder === 'asc' ? 1 : -1
        if (bValue == null) return tradingSortOrder === 'asc' ? -1 : 1
        
        if (typeof aValue === 'string') {
          return tradingSortOrder === 'asc' 
            ? aValue.localeCompare(bValue as string)
            : (bValue as string).localeCompare(aValue)
        }
        
        if (typeof aValue === 'number') {
          return tradingSortOrder === 'asc' 
            ? (aValue as number) - (bValue as number)
            : (bValue as number) - (aValue as number)
        }
        return 0
      })
    }
    return filtered
  }, [consolidatedTradingData, tradingSortField, tradingSortOrder, tradingSearchTerm])

  const paginatedTradingData = useMemo(() => {
    const startIndex = (tradingCurrentPage - 1) * tradingItemsPerPage
    const endIndex = startIndex + tradingItemsPerPage
    return sortedTradingData.slice(startIndex, endIndex)
  }, [sortedTradingData, tradingCurrentPage, tradingItemsPerPage])

  // Sort, filter and paginate promoter data
  const sortedPromoterData = useMemo(() => {
    let filtered = [...promoterData]
    
    // Apply search filtering
    if (promoterSearchTerm.trim()) {
      filtered = filtered.filter((item) =>
        item.company.toLowerCase().includes(promoterSearchTerm.toLowerCase()) ||
        item.code.toLowerCase().includes(promoterSearchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(promoterSearchTerm.toLowerCase())
      )
    }
    
    // Apply sorting
    if (promoterSortField) {
      filtered.sort((a, b) => {
        const aValue = a[promoterSortField as keyof typeof a]
        const bValue = b[promoterSortField as keyof typeof b]
        
        if (aValue == null && bValue == null) return 0
        if (aValue == null) return promoterSortOrder === 'asc' ? 1 : -1
        if (bValue == null) return promoterSortOrder === 'asc' ? -1 : 1
        
        if (typeof aValue === 'string') {
          return promoterSortOrder === 'asc' 
            ? aValue.localeCompare(bValue as string)
            : (bValue as string).localeCompare(aValue)
        }
        
        if (typeof aValue === 'number') {
          return promoterSortOrder === 'asc' 
            ? (aValue as number) - (bValue as number)
            : (bValue as number) - (aValue as number)
        }
        return 0
      })
    }
    return filtered
  }, [promoterData, promoterSortField, promoterSortOrder, promoterSearchTerm])

  const paginatedPromoterData = useMemo(() => {
    const startIndex = (promoterCurrentPage - 1) * promoterItemsPerPage
    const endIndex = startIndex + promoterItemsPerPage
    return sortedPromoterData.slice(startIndex, endIndex)
  }, [sortedPromoterData, promoterCurrentPage, promoterItemsPerPage])

  // Calculate total pages
  const tradingTotalPages = Math.ceil(sortedTradingData.length / tradingItemsPerPage)
  const promoterTotalPages = Math.ceil(sortedPromoterData.length / promoterItemsPerPage)
  
  // Calculate totals for trading table
  const tradingTotals = useMemo(() => {
    return consolidatedTradingData.reduce((totals, item) => {
      return {
        opening_quantity: totals.opening_quantity + item.opening_quantity,
        opening_amount: totals.opening_amount + item.opening_amount,
        purchase_quantity: totals.purchase_quantity + item.purchase_quantity,
        purchase_amount: totals.purchase_amount + item.purchase_amount,
        right_quantity: totals.right_quantity + item.right_quantity,
        right_total: totals.right_total + item.right_total,
        bonus_quantity: totals.bonus_quantity + item.bonus_quantity,
        sales_quantity: totals.sales_quantity + item.sales_quantity,
        sales_cost: totals.sales_cost + item.sales_cost,
        sales_amount: totals.sales_amount + item.sales_amount,
        sales_profit: totals.sales_profit + item.sales_profit,
        closing_quantity: totals.closing_quantity + item.closing_quantity,
        closing_amount: totals.closing_amount + item.closing_amount,
        demat: totals.demat + item.demat,
        non_demat: totals.non_demat + item.non_demat,
        unrealised_amount: totals.unrealised_amount + item.unrealised_amount
      }
    }, {
      opening_quantity: 0, opening_amount: 0, purchase_quantity: 0, purchase_amount: 0,
      right_quantity: 0, right_total: 0, bonus_quantity: 0, sales_quantity: 0,
      sales_cost: 0, sales_amount: 0, sales_profit: 0, closing_quantity: 0,
      closing_amount: 0, demat: 0, non_demat: 0, unrealised_amount: 0
    })
  }, [consolidatedTradingData])
  
  // Calculate total return percentage for trading
  const tradingTotalReturnPercent = tradingTotals.closing_amount > 0 
    ? (tradingTotals.unrealised_amount / tradingTotals.closing_amount) * 100 
    : 0
    
  // Calculate totals for promoter table
  const promoterTotals = useMemo(() => {
    return promoterData.reduce((totals, item) => {
      const revaluationAmount = item.closing_quantity * item.market_price
      return {
        opening_quantity: totals.opening_quantity + item.opening_quantity,
        opening_amount: totals.opening_amount + item.opening_amount,
        purchase_quantity: totals.purchase_quantity + item.purchase_quantity,
        purchase_amount: totals.purchase_amount + item.purchase_amount,
        right_quantity: totals.right_quantity + item.right_quantity,
        right_total: totals.right_total + item.right_total,
        bonus_quantity: totals.bonus_quantity + item.bonus_quantity,
        sales_quantity: totals.sales_quantity + item.sales_quantity,
        sales_cost: totals.sales_cost + item.sales_cost,
        sales_amount: totals.sales_amount + item.sales_amount,
        sales_profit: totals.sales_profit + item.sales_profit,
        closing_quantity: totals.closing_quantity + item.closing_quantity,
        closing_amount: totals.closing_amount + item.closing_amount,
        demat: totals.demat + item.demat,
        non_demat: totals.non_demat + item.non_demat,
        revaluation_amount: totals.revaluation_amount + revaluationAmount
      }
    }, {
      opening_quantity: 0, opening_amount: 0, purchase_quantity: 0, purchase_amount: 0,
      right_quantity: 0, right_total: 0, bonus_quantity: 0, sales_quantity: 0,
      sales_cost: 0, sales_amount: 0, sales_profit: 0, closing_quantity: 0,
      closing_amount: 0, demat: 0, non_demat: 0, revaluation_amount: 0
    })
  }, [promoterData])
    
  // Function to calculate totals for sub class data
  const calculateSubClassTotals = (data: MetricData[]) => {
    const totals = data.reduce((totals, item) => {
      const revaluationAmount = item.closing_quantity * item.market_price
      return {
        opening_quantity: totals.opening_quantity + item.opening_quantity,
        opening_amount: totals.opening_amount + item.opening_amount,
        purchase_quantity: totals.purchase_quantity + item.purchase_quantity,
        purchase_amount: totals.purchase_amount + item.purchase_amount,
        right_quantity: totals.right_quantity + item.right_quantity,
        right_total: totals.right_total + item.right_total,
        bonus_quantity: totals.bonus_quantity + item.bonus_quantity,
        sales_quantity: totals.sales_quantity + item.sales_quantity,
        sales_cost: totals.sales_cost + item.sales_cost,
        sales_amount: totals.sales_amount + item.sales_amount,
        sales_profit: totals.sales_profit + item.sales_profit,
        closing_quantity: totals.closing_quantity + item.closing_quantity,
        closing_amount: totals.closing_amount + item.closing_amount,
        demat: totals.demat + item.demat,
        non_demat: totals.non_demat + item.non_demat,
        revaluation_amount: totals.revaluation_amount + revaluationAmount
      }
    }, {
      opening_quantity: 0, opening_amount: 0, purchase_quantity: 0, purchase_amount: 0,
      right_quantity: 0, right_total: 0, bonus_quantity: 0, sales_quantity: 0,
      sales_cost: 0, sales_amount: 0, sales_profit: 0, closing_quantity: 0,
      closing_amount: 0, demat: 0, non_demat: 0, revaluation_amount: 0
    })
      
    return totals
  }

  const userFetch = async () => {
      const userss: cbMAP[] = await getUsers();
      setUsers(userss);
      const firstUser = userss[0].client_name
      setInitialUser(firstUser)
      setcurrentFund(firstUser)
      
      const fiscal_years = await getFiscal();
      setFiscals(fiscal_years)
      
      // Find current fiscal year based on today's date
      const currentDate = new Date()
      const currentFY = fiscal_years.find(fiscalYear => {
        const startDate = new Date(fiscalYear.start_date)
        const endDate = new Date(fiscalYear.end_date)
        return currentDate >= startDate && currentDate <= endDate
      })
      
      // If current fiscal year found, set it and auto-apply filters
      if (currentFY) {
        setFiscalID(currentFY.fiscal_year_id.toString())
        
        // Auto-apply filters with current fiscal year
        if (firstUser) {
          try {
            setIsLoading(true)
            const [tradingResponse, promoterResponse, subClassesResponse] = await Promise.all([
              getMetricDataTradingFiscal(firstUser, currentFY.fiscal_year_id.toString()),
              getMetricDataPromoterFiscal(firstUser, currentFY.fiscal_year_id.toString()),
              getSubClassesForFund(firstUser, currentFY.fiscal_year_id.toString())
            ])
            
            setTradingData(tradingResponse)
            setPromoterData(promoterResponse)
            setSubClasses(subClassesResponse)
            
            // Fetch data for each sub class
            if (subClassesResponse.length > 0) {
              const subClassDataPromises = subClassesResponse.map(async (subClass) => {
                const data = await getMetricDataSubClassFiscal(firstUser, currentFY.fiscal_year_id.toString(), subClass.sub_id)
                return [subClass.sub_id, data] as [number, MetricData[]]
              })
              
              const subClassResults = await Promise.all(subClassDataPromises)
              const newSubClassData = new Map(subClassResults)
              setSubClassData(newSubClassData)
              
              // Initialize pagination for sub classes
              const initialPages = new Map()
              subClassesResponse.forEach(sc => initialPages.set(sc.sub_id, 1))
              setSubClassCurrentPages(initialPages)
            }
          } catch (error) {
            console.error('Error auto-fetching metric data:', error)
          } finally {
            setIsLoading(false)
          }
        }
      }
      
      setisLoadingMain(false)
  
    }
  
    useEffect(() => {
      userFetch();
    }, []);

  function handleFundChange(value: string) {
    setcurrentFund(value)
  }

  function handleFiscalChange(value: string) {
    setFiscalID(value)
  }

  async function handleFilters() {
    if (!currentFund || !fiscalID) {
      alert('Please select both Fund and Fiscal Year')
      return
    }
    
    setIsLoading(true)
    try {
      // Fetch trading, promoter, and sub classes data
      const [tradingResponse, promoterResponse, subClassesResponse] = await Promise.all([
        getMetricDataTradingFiscal(currentFund, fiscalID),
        getMetricDataPromoterFiscal(currentFund, fiscalID),
        getSubClassesForFund(currentFund, fiscalID)
      ])
      
      setTradingData(tradingResponse)
      setPromoterData(promoterResponse)
      setSubClasses(subClassesResponse)
      
      // Fetch data for each sub class
      if (subClassesResponse.length > 0) {
        const subClassDataPromises = subClassesResponse.map(async (subClass) => {
          const data = await getMetricDataSubClassFiscal(currentFund, fiscalID, subClass.sub_id)
          return [subClass.sub_id, data] as [number, MetricData[]]
        })
        
        const subClassResults = await Promise.all(subClassDataPromises)
        const newSubClassData = new Map(subClassResults)
        setSubClassData(newSubClassData)
        
        // Initialize pagination for sub classes
        const initialPages = new Map()
        subClassesResponse.forEach(sc => initialPages.set(sc.sub_id, 1))
        setSubClassCurrentPages(initialPages)
      } else {
        setSubClassData(new Map())
        setSubClassCurrentPages(new Map())
      }
    } catch (error) {
      console.error('Error fetching metric data:', error)
    } finally {
      setIsLoading(false)
      // Reset pagination when new data is loaded
      setTradingCurrentPage(1)
      setPromoterCurrentPage(1)
    }
  }

  // Pagination handlers
  const handleTradingPageChange = (page: number) => {
    setTradingCurrentPage(page)
  }

  const handlePromoterPageChange = (page: number) => {
    setPromoterCurrentPage(page)
  }

  const handleSubClassPageChange = (subClassId: number, page: number) => {
    const newPages = new Map(subClassCurrentPages)
    newPages.set(subClassId, page)
    setSubClassCurrentPages(newPages)
  }

  // Sort handlers
  const handleTradingSort = (field: string) => {
    if (tradingSortField === field) {
      setTradingSortOrder(tradingSortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setTradingSortField(field)
      setTradingSortOrder('asc')
    }
    setTradingCurrentPage(1)
  }

  const handlePromoterSort = (field: string) => {
    if (promoterSortField === field) {
      setPromoterSortOrder(promoterSortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setPromoterSortField(field)
      setPromoterSortOrder('asc')
    }
    setPromoterCurrentPage(1)
  }

  const handleSubClassSort = (subClassId: number, field: string) => {
    const currentField = subClassSortFields.get(subClassId)
    if (currentField === field) {
      const currentOrder = subClassSortOrders.get(subClassId) || 'asc'
      setSubClassSortOrders(new Map(subClassSortOrders).set(subClassId, currentOrder === 'asc' ? 'desc' : 'asc'))
    } else {
      setSubClassSortFields(new Map(subClassSortFields).set(subClassId, field))
      setSubClassSortOrders(new Map(subClassSortOrders).set(subClassId, 'asc'))
    }
    const pages = new Map(subClassCurrentPages)
    pages.set(subClassId, 1)
    setSubClassCurrentPages(pages)
  }

  // Sort indicator component
  const SortIndicator = ({ field, sortField, sortOrder }: { field: string; sortField: string | null; sortOrder: 'asc' | 'desc' }) => {
    if (sortField !== field) return <span className="text-gray-400 text-xs">⇅</span>
    return sortOrder === 'asc' ? <span className="text-blue-600">↑</span> : <span className="text-blue-600">↓</span>
  }

  async function handleExport() {
    try {
      setIsExporting(true)
      
      if (!currentFund || !fiscalID) {
        toast.error('Please select fund and fiscal year before exporting.')
        return
      }
      
      const fileName = `Metric_Dashboard_${currentFund}_${fiscalID}_${new Date().toISOString().split('T')[0]}`
      
      // Combine all data exactly as shown on page (all records, no pagination)
      const combinedData = []
      
      // 1. Trading Securities - all consolidated records
      const tradingExportData = consolidatedTradingData.map(item => ({ 
        ...item, 
        dataType: 'trading',  // Match microservice expectation
        tableType: 'Held for Trading Securities'
      }))
      combinedData.push(...tradingExportData)
      
      // 2. Promoter Shares - all records
      const promoterExportData = promoterData.map(item => ({ 
        ...item, 
        dataType: 'promoter',  // Match microservice expectation
        tableType: 'Promoter Shares (Held for Maturity)'
      }))
      combinedData.push(...promoterExportData)
      
      // 3. Sub-Class tables - treat as promoter data since they're held for maturity
      subClasses.forEach(subClass => {
        const subClassItems = subClassData.get(subClass.sub_id) || []
        const subClassExportData = subClassItems.map(item => ({
          ...item,
          dataType: 'promoter',  // Sub-classes are promoter/maturity securities
          tableType: `Sub-Class: ${subClass.sub_name}`,
          subClassId: subClass.sub_id,
          subClassName: subClass.sub_name
        }))
        combinedData.push(...subClassExportData)
      })
      
      if (combinedData.length === 0) {
        toast.error('No data to export. Please apply filters first.')
        return
      }
      
      // Detailed logging
      console.log('=== EXPORT DEBUG INFO ===')
      console.log('Export Summary:', {
        totalRecords: combinedData.length,
        tradingRecords: consolidatedTradingData.length,
        promoterRecords: promoterData.length,
        subClassCount: subClasses.length,
        subClassRecords: combinedData.length - consolidatedTradingData.length - promoterData.length
      })
      console.log('First Trading Record:', consolidatedTradingData[0])
      console.log('First Promoter Record:', promoterData[0])
      console.log('Sub Classes:', subClasses)
      console.log('Combined Data Sample (first 3):', combinedData.slice(0, 3))
      
      // Send to export API
      console.log('Sending to universalExport API...')
      const result = await universalExport({
        fileName,
        data: combinedData,
        pageType: 'metric-dashboard',
        filters: {
          clientName: currentFund,
          fiscalYear: getFiscals?.find(f => f.fiscal_year_id.toString() === fiscalID)?.year_label || fiscalID,
          fiscalYearId: fiscalID,
          exportDate: new Date().toISOString(),
          totalRecords: combinedData.length,
          breakdown: {
            trading: consolidatedTradingData.length,
            promoter: promoterData.length,
            subClasses: subClasses.length,
            subClassRecords: combinedData.length - consolidatedTradingData.length - promoterData.length
          }
        }
      })
      
      console.log('Export API Response:', result)
      
      if (!result.success) {
        toast.error(`Export failed: ${result.message || 'Unknown error'}`)
        console.error('Export failed:', result)
        return
      }
      
      if (result.downloadData && result.fileName) {
        triggerFileDownload(result.downloadData, result.fileName)
        toast.success(`Export Successful! Exported ${combinedData.length} records.`)
      } else {
        toast.error('Export completed but download data is missing')
        console.error('Missing download data')
      }
      
    } catch (error) {
      console.error('Export error:', error)
      alert('Export failed. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  // Component to render sub class tables
  const renderSubClassTable = (subClass: {sub_id: number, sub_name: string}) => {
    const data = subClassData.get(subClass.sub_id) || []
    const currentPage = subClassCurrentPages.get(subClass.sub_id) || 1
    const itemsPerPage = subClassItemsPerPage
    const sortField = subClassSortFields.get(subClass.sub_id)
    const sortOrder = subClassSortOrders.get(subClass.sub_id) || 'asc'
    const searchTerm = subClassSearchTerms.get(subClass.sub_id) || ''
    const columnVisibility = subClassColumnVisibility.get(subClass.sub_id) || {
      company: true, code: true, category: true, opening_quantity: true, opening_rate: true,
      opening_amount: true, purchase_quantity: true, purchase_rate: true, purchase_amount: true,
      right_quantity: true, right_total: true, bonus_quantity: true, bonus_book_close_date: true,
      sales_quantity: true, sales_cost: true, sales_amount: true, sales_profit: true,
      closing_quantity: true, closing_rate: true, closing_amount: true, demat: true,
      non_demat: true, market_price: true, revaluation_amount: true, remarks: true
    }
    
    // Filter and sort data
    let filteredData = [...data]
    
    // Apply search filtering
    if (searchTerm.trim()) {
      filteredData = filteredData.filter((item) =>
        item.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    
    // Apply sorting
    if (sortField) {
      filteredData.sort((a, b) => {
        const aValue = a[sortField as keyof typeof a]
        const bValue = b[sortField as keyof typeof b]
        
        if (aValue == null && bValue == null) return 0
        if (aValue == null) return sortOrder === 'asc' ? 1 : -1
        if (bValue == null) return sortOrder === 'asc' ? -1 : 1
        
        if (typeof aValue === 'string') {
          return sortOrder === 'asc' 
            ? aValue.localeCompare(bValue as string)
            : (bValue as string).localeCompare(aValue)
        }
        
        if (typeof aValue === 'number') {
          return sortOrder === 'asc' 
            ? (aValue as number) - (bValue as number)
            : (bValue as number) - (aValue as number)
        }
        return 0
      })
    }
    
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const paginatedData = filteredData.slice(startIndex, endIndex)
    const totalPages = Math.ceil(filteredData.length / itemsPerPage)
    const subClassTotals = calculateSubClassTotals(filteredData)

    return (
      <Card key={subClass.sub_id} className="bg-white shadow-lg border border-gray-100 mb-6">
        <CardHeader className="pb-4">
          <div className="flex justify-between items-center mb-4">
            <CardTitle className="text-xl font-bold text-gray-900 flex items-center">
              <div className="w-3 h-3 bg-purple-500 rounded-full mr-2"></div>
              {subClass.sub_name}
              {filteredData.length > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({filteredData.length} securities)
                </span>
              )}
            </CardTitle>
          </div>
          
          {/* Search and Column Controls for Sub-class */}
          <div className="flex items-center gap-3 mb-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by company, code, or category..."
                value={searchTerm}
                onChange={(e) => {
                  const newTerms = new Map(subClassSearchTerms)
                  newTerms.set(subClass.sub_id, e.target.value)
                  setSubClassSearchTerms(newTerms)
                }}
                className="pl-10 pr-10 border-gray-200 focus:border-purple-300"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const newTerms = new Map(subClassSearchTerms)
                    newTerms.set(subClass.sub_id, "")
                    setSubClassSearchTerms(newTerms)
                  }}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-100"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            
            {/* Column Visibility Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-2 border-gray-200 hover:border-purple-300">
                  <Settings className="h-4 w-4" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 max-h-96 overflow-y-auto">
                <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={columnVisibility.company}
                  onCheckedChange={(checked) => {
                    const newVisibility = new Map(subClassColumnVisibility)
                    newVisibility.set(subClass.sub_id, { ...columnVisibility, company: checked })
                    setSubClassColumnVisibility(newVisibility)
                  }}
                >
                  Company
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={columnVisibility.code}
                  onCheckedChange={(checked) => {
                    const newVisibility = new Map(subClassColumnVisibility)
                    newVisibility.set(subClass.sub_id, { ...columnVisibility, code: checked })
                    setSubClassColumnVisibility(newVisibility)
                  }}
                >
                  Code
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={columnVisibility.category}
                  onCheckedChange={(checked) => {
                    const newVisibility = new Map(subClassColumnVisibility)
                    newVisibility.set(subClass.sub_id, { ...columnVisibility, category: checked })
                    setSubClassColumnVisibility(newVisibility)
                  }}
                >
                  Category
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={columnVisibility.opening_quantity}
                  onCheckedChange={(checked) => {
                    const newVisibility = new Map(subClassColumnVisibility)
                    newVisibility.set(subClass.sub_id, { ...columnVisibility, opening_quantity: checked })
                    setSubClassColumnVisibility(newVisibility)
                  }}
                >
                  Opening Quantity
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={columnVisibility.closing_quantity}
                  onCheckedChange={(checked) => {
                    const newVisibility = new Map(subClassColumnVisibility)
                    newVisibility.set(subClass.sub_id, { ...columnVisibility, closing_quantity: checked })
                    setSubClassColumnVisibility(newVisibility)
                  }}
                >
                  Closing Quantity
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={columnVisibility.market_price}
                  onCheckedChange={(checked) => {
                    const newVisibility = new Map(subClassColumnVisibility)
                    newVisibility.set(subClass.sub_id, { ...columnVisibility, market_price: checked })
                    setSubClassColumnVisibility(newVisibility)
                  }}
                >
                  Market Price
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={columnVisibility.revaluation_amount}
                  onCheckedChange={(checked) => {
                    const newVisibility = new Map(subClassColumnVisibility)
                    newVisibility.set(subClass.sub_id, { ...columnVisibility, revaluation_amount: checked })
                    setSubClassColumnVisibility(newVisibility)
                  }}
                >
                  Revaluation Amount
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead rowSpan={2} className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handleSubClassSort(subClass.sub_id, 'company')}>
                    Company <SortIndicator field="company" sortField={subClassSortFields.get(subClass.sub_id) || null} sortOrder={subClassSortOrders.get(subClass.sub_id) || 'asc'} />
                  </TableHead>
                  <TableHead rowSpan={2} className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handleSubClassSort(subClass.sub_id, 'code')}>
                    Code <SortIndicator field="code" sortField={subClassSortFields.get(subClass.sub_id) || null} sortOrder={subClassSortOrders.get(subClass.sub_id) || 'asc'} />
                  </TableHead>
                  <TableHead rowSpan={2} className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handleSubClassSort(subClass.sub_id, 'category')}>
                    Category <SortIndicator field="category" sortField={subClassSortFields.get(subClass.sub_id) || null} sortOrder={subClassSortOrders.get(subClass.sub_id) || 'asc'} />
                  </TableHead>
                  <TableHead colSpan={3} className="text-center border-r">Opening</TableHead>
                  <TableHead colSpan={3} className="text-center border-r">Purchase</TableHead>
                  <TableHead colSpan={2} className="text-center border-r">Right Share</TableHead>
                  <TableHead colSpan={2} className="text-center border-r">Bonus</TableHead>
                  <TableHead colSpan={4} className="text-center border-r">Sales</TableHead>
                  <TableHead colSpan={3} className="text-center border-r">Closing</TableHead>
                  <TableHead colSpan={2} className="text-center border-r">Holdings Type</TableHead>
                  <TableHead rowSpan={2} className="text-center border-r">Market Price</TableHead>
                  <TableHead rowSpan={2} className="text-center border-r">Revaluation Amount</TableHead>
                  <TableHead rowSpan={2} className="text-center">Remarks</TableHead>
                </TableRow>
                
                <TableRow>
                  <TableHead className="text-center">Quantity</TableHead>
                  <TableHead className="text-center">Rate</TableHead>
                  <TableHead className="text-center border-r">Amount</TableHead>
                  <TableHead className="text-center">Quantity</TableHead>
                  <TableHead className="text-center">Rate</TableHead>
                  <TableHead className="text-center border-r">Amount</TableHead>
                  <TableHead className="text-center">Quantity</TableHead>
                  <TableHead className="text-center border-r">Total</TableHead>
                  <TableHead className="text-center">Quantity</TableHead>
                  <TableHead className="text-center border-r">Book Close Date</TableHead>
                  <TableHead className="text-center">Quantity</TableHead>
                  <TableHead className="text-center">Cost</TableHead>
                  <TableHead className="text-center">Amount</TableHead>
                  <TableHead className="text-center border-r">Profit</TableHead>
                  <TableHead className="text-center">Quantity</TableHead>
                  <TableHead className="text-center">Rate</TableHead>
                  <TableHead className="text-center border-r">Amount</TableHead>
                  <TableHead className="text-center">DEMAT</TableHead>
                  <TableHead className="text-center border-r">NON-DEMAT</TableHead>
                </TableRow>
              </TableHeader>
              
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={21} className="text-center py-8">
                      Loading {subClass.sub_name} data...
                    </TableCell>
                  </TableRow>
                ) : filteredData.length > 0 ? (
                  paginatedData.map((data, index) => (
                    <TableRow 
                      key={`subclass-${subClass.sub_id}-${data.code}-${index}`}
                      className={data.isIPOStaging ? "bg-yellow-100 hover:bg-yellow-200" : ""}
                      title={data.isIPOStaging ? "IPO Staging (Not Dematerialized)" : undefined}
                    >
                      <TableCell className="font-medium border-r"><Link href={`/dashboard/stock/${data.code}`} target="_blank">{data.company}</Link></TableCell>
                      <TableCell className="text-center border-r"><Link href={`/dashboard/stock/${data.code}`} target="_blank">{data.code}</Link></TableCell>
                      <TableCell className="text-center border-r">{data.category}</TableCell>
                      <TableCell className="text-center">{data.opening_quantity.toLocaleString()}</TableCell>
                      <TableCell className="text-center">Rs. {data.opening_rate.toFixed(2)}</TableCell>
                      <TableCell className="text-center border-r">Rs. {data.opening_amount.toLocaleString()}</TableCell>
                      <TableCell className="text-center">{data.purchase_quantity.toLocaleString()}</TableCell>
                      <TableCell className="text-center">Rs. {data.purchase_rate.toFixed(2)}</TableCell>
                      <TableCell className="text-center border-r">Rs. {data.purchase_amount.toLocaleString()}</TableCell>
                      <TableCell className="text-center">{data.right_quantity.toLocaleString()}</TableCell>
                      <TableCell className="text-center border-r">Rs. {data.right_total.toLocaleString()}</TableCell>
                      <TableCell className="text-center">{data.bonus_quantity.toLocaleString()}</TableCell>
                      <TableCell className="text-center border-r">{data.bonus_book_close_date || '-'}</TableCell>
                      <TableCell className="text-center">{data.sales_quantity.toLocaleString()}</TableCell>
                      <TableCell className="text-center">Rs. {data.sales_cost.toLocaleString()}</TableCell>
                      <TableCell className="text-center">Rs. {data.sales_amount.toLocaleString()}</TableCell>
                      <TableCell className={`text-center border-r ${
                        data.sales_profit >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        Rs. {data.sales_profit.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">{data.closing_quantity.toLocaleString()}</TableCell>
                      <TableCell className="text-center">Rs. {data.closing_rate.toFixed(2)}</TableCell>
                      <TableCell className="text-center border-r">Rs. {data.closing_amount.toLocaleString()}</TableCell>
                      <TableCell className="text-center">{data.demat.toLocaleString()}</TableCell>
                      <TableCell className="text-center border-r">{data.non_demat.toLocaleString()}</TableCell>
                      <TableCell className="text-center border-r font-semibold">Rs. {data.market_price.toFixed(2)}</TableCell>
                      <TableCell className="text-center border-r font-semibold">Rs. {(data.closing_quantity * data.market_price).toLocaleString()}</TableCell>
                      <TableCell className="text-center">
                        <InlineRemarks
                          initial={data.remarks || ''}
                          onSave={async (value) => {
                            if (!fiscalID) return;
                            await saveFYBRemarks({ clientName: currentFund, fiscalYearId: Number(fiscalID), symbol: data.code, remarks: value })
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={21} className="text-center py-8 text-gray-500">
                      No {subClass.sub_name} securities found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              
              {/* Sub Class Table Footer with Totals */}
              {filteredData.length > 0 && (
                <TableFooter>
                  <TableRow className="bg-gray-100 font-semibold">
                    <TableCell className="font-bold border-r">TOTAL</TableCell>
                    <TableCell className="border-r">-</TableCell>
                    <TableCell className="border-r">-</TableCell>
                    <TableCell className="text-center">{subClassTotals.opening_quantity.toLocaleString()}</TableCell>
                    <TableCell className="text-center">-</TableCell>
                    <TableCell className="text-center border-r">Rs. {subClassTotals.opening_amount.toLocaleString()}</TableCell>
                    <TableCell className="text-center">{subClassTotals.purchase_quantity.toLocaleString()}</TableCell>
                    <TableCell className="text-center">-</TableCell>
                    <TableCell className="text-center border-r">Rs. {subClassTotals.purchase_amount.toLocaleString()}</TableCell>
                    <TableCell className="text-center">{subClassTotals.right_quantity.toLocaleString()}</TableCell>
                    <TableCell className="text-center border-r">Rs. {subClassTotals.right_total.toLocaleString()}</TableCell>
                    <TableCell className="text-center">{subClassTotals.bonus_quantity.toLocaleString()}</TableCell>
                    <TableCell className="text-center border-r">-</TableCell>
                    <TableCell className="text-center">{subClassTotals.sales_quantity.toLocaleString()}</TableCell>
                    <TableCell className="text-center">Rs. {subClassTotals.sales_cost.toLocaleString()}</TableCell>
                    <TableCell className="text-center">Rs. {subClassTotals.sales_amount.toLocaleString()}</TableCell>
                    <TableCell className={`text-center border-r ${
                      subClassTotals.sales_profit >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      Rs. {subClassTotals.sales_profit.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">{subClassTotals.closing_quantity.toLocaleString()}</TableCell>
                    <TableCell className="text-center">-</TableCell>
                    <TableCell className="text-center border-r">Rs. {subClassTotals.closing_amount.toLocaleString()}</TableCell>
                    <TableCell className="text-center">{subClassTotals.demat.toLocaleString()}</TableCell>
                    <TableCell className="text-center border-r">{subClassTotals.non_demat.toLocaleString()}</TableCell>
                    <TableCell className="text-center border-r">-</TableCell>
                    <TableCell className="text-center border-r font-bold">Rs. {subClassTotals.revaluation_amount.toLocaleString()}</TableCell>
                    <TableCell className="text-center">-</TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
            </div>
          </CardContent>
          
          {/* Sub Class Table Pagination */}
          {filteredData.length > itemsPerPage && (
            <div className="px-6 py-4 bg-white border-t border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-700">Items per page:</span>
                <Select value={itemsPerPage.toString()} onValueChange={(value) => {
                  setSubClassItemsPerPage(parseInt(value))
                  const pages = new Map(subClassCurrentPages)
                  pages.set(subClass.sub_id, 1)
                  setSubClassCurrentPages(pages)
                }}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="15">15</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={(page) => handleSubClassPageChange(subClass.sub_id, page)}
                itemsPerPage={itemsPerPage}
                totalItems={filteredData.length}
              />
            </div>
          )}

      </Card>
    )
  }

  return (
    isLoadingMain ? (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="animate-spin size-6 mx-auto mb-2" />
      </div>
    ) : (
      <div className="space-y-6">
        {/* Enhanced Filters Card */}
        <Card className="bg-white shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-100">
            <CardTitle className="text-xl font-bold text-gray-900 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z" />
              </svg>
              Data Filters & Controls
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">Configure your data view and export settings</p>
          </div>
          <CardContent className="p-6">
            <div className="grid gap-6 lg:grid-cols-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <p className="text-sm font-semibold text-gray-700">Fund Selection</p>
                </div>
                <Select defaultValue={initialUser} onValueChange={handleFundChange}>
                  <SelectTrigger className="bg-white border-gray-200 hover:border-blue-300 transition-colors">
                    <SelectValue placeholder="Choose Fund" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Available Funds</SelectLabel>
                      {givenUsers.map((details) => (
                        <SelectItem key={details.client_id} value={details.client_name}>
                          {details.client_name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <p className="text-sm font-semibold text-gray-700">Fiscal Year</p>
                </div>
                <Select value={fiscalID} onValueChange={handleFiscalChange}>
                  <SelectTrigger className="bg-white border-gray-200 hover:border-green-300 transition-colors">
                    <SelectValue placeholder="Select Fiscal Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {getFiscals?.map((fiscal) => (
                      <SelectGroup key={fiscal.fiscal_year_id}>
                        <SelectItem value={String(fiscal.fiscal_year_id)}>{fiscal.year_label}</SelectItem>
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <p className="text-sm font-semibold text-gray-700">Actions</p>
                </div>
                <Button 
                  onClick={handleFilters} 
                  disabled={isLoading} 
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 transition-all duration-200"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                  {isLoading ? "Loading..." : "Apply Filters"}
                </Button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <p className="text-sm font-semibold text-gray-700">Export</p>
                </div>
                <Button
                  onClick={handleExport}
                  disabled={isExporting || (tradingData.length === 0 && promoterData.length === 0)}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 transition-all duration-200"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {isExporting ? "Exporting..." : "Export Data"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Info */}
        {fiscalID && currentFund && (
          <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
            <div className="text-sm text-gray-600">
              <span className="font-medium text-gray-900">Viewing:</span> FY {getFiscals?.find((f) => f.fiscal_year_id.toString() === fiscalID)?.year_label} · Fund {currentFund} · {consolidatedTradingData.length} Trading · {promoterData.length} Promoter{subClasses.length > 0 ? ` · ${subClasses.length} Subclass tables` : ""}
            </div>
          </div>
        )}

    {/* Held for Trading Table */}
    <Card className="bg-white shadow-lg border border-gray-100 mb-6">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-center mb-4">
          <CardTitle className="text-xl font-bold text-gray-900 flex items-center">
            <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
            Held for Trading Securities
            {sortedTradingData.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({sortedTradingData.length} securities)
              </span>
            )}
          </CardTitle>
        </div>
        
        {/* Search and Column Controls for Trading */}
        <div className="flex items-center gap-3 mb-4">
          {/* Search Input */}
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search by company, code, or category..."
              value={tradingSearchTerm}
              onChange={(e) => setTradingSearchTerm(e.target.value)}
              className="pl-10 pr-10 border-gray-200 focus:border-blue-300"
            />
            {tradingSearchTerm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTradingSearchTerm("")}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-100"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          
          {/* Column Visibility Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2 border-gray-200 hover:border-blue-300">
                <Settings className="h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 max-h-96 overflow-y-auto">
              <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={tradingColumnVisibility.company}
                onCheckedChange={(checked) => 
                  setTradingColumnVisibility(prev => ({ ...prev, company: checked }))
                }
              >
                Company
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={tradingColumnVisibility.code}
                onCheckedChange={(checked) => 
                  setTradingColumnVisibility(prev => ({ ...prev, code: checked }))
                }
              >
                Code
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={tradingColumnVisibility.category}
                onCheckedChange={(checked) => 
                  setTradingColumnVisibility(prev => ({ ...prev, category: checked }))
                }
              >
                Category
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={tradingColumnVisibility.opening_quantity}
                onCheckedChange={(checked) => 
                  setTradingColumnVisibility(prev => ({ ...prev, opening_quantity: checked }))
                }
              >
                Opening Quantity
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={tradingColumnVisibility.opening_rate}
                onCheckedChange={(checked) => 
                  setTradingColumnVisibility(prev => ({ ...prev, opening_rate: checked }))
                }
              >
                Opening Rate
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={tradingColumnVisibility.opening_amount}
                onCheckedChange={(checked) => 
                  setTradingColumnVisibility(prev => ({ ...prev, opening_amount: checked }))
                }
              >
                Opening Amount
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={tradingColumnVisibility.purchase_quantity}
                onCheckedChange={(checked) => 
                  setTradingColumnVisibility(prev => ({ ...prev, purchase_quantity: checked }))
                }
              >
                Purchase Quantity
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={tradingColumnVisibility.purchase_rate}
                onCheckedChange={(checked) => 
                  setTradingColumnVisibility(prev => ({ ...prev, purchase_rate: checked }))
                }
              >
                Purchase Rate
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={tradingColumnVisibility.purchase_amount}
                onCheckedChange={(checked) => 
                  setTradingColumnVisibility(prev => ({ ...prev, purchase_amount: checked }))
                }
              >
                Purchase Amount
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={tradingColumnVisibility.closing_quantity}
                onCheckedChange={(checked) => 
                  setTradingColumnVisibility(prev => ({ ...prev, closing_quantity: checked }))
                }
              >
                Closing Quantity
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={tradingColumnVisibility.closing_rate}
                onCheckedChange={(checked) => 
                  setTradingColumnVisibility(prev => ({ ...prev, closing_rate: checked }))
                }
              >
                Closing Rate
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={tradingColumnVisibility.closing_amount}
                onCheckedChange={(checked) => 
                  setTradingColumnVisibility(prev => ({ ...prev, closing_amount: checked }))
                }
              >
                Closing Amount
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={tradingColumnVisibility.market_price}
                onCheckedChange={(checked) => 
                  setTradingColumnVisibility(prev => ({ ...prev, market_price: checked }))
                }
              >
                Market Price
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={tradingColumnVisibility.unrealised_amount}
                onCheckedChange={(checked) => 
                  setTradingColumnVisibility(prev => ({ ...prev, unrealised_amount: checked }))
                }
              >
                Unrealised P&L
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={tradingColumnVisibility.today_return_percent}
                onCheckedChange={(checked) => 
                  setTradingColumnVisibility(prev => ({ ...prev, today_return_percent: checked }))
                }
              >
                Return %
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="p-0">
      
      <div className="overflow-x-auto">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow>
              <TableHead rowSpan={2} className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handleTradingSort('company')}>
                Company <SortIndicator field="company" sortField={tradingSortField} sortOrder={tradingSortOrder} />
              </TableHead>
              <TableHead rowSpan={2} className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handleTradingSort('code')}>
                Code <SortIndicator field="code" sortField={tradingSortField} sortOrder={tradingSortOrder} />
              </TableHead>
              <TableHead rowSpan={2} className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handleTradingSort('category')}>
                Category <SortIndicator field="category" sortField={tradingSortField} sortOrder={tradingSortOrder} />
              </TableHead>
              <TableHead colSpan={3} className="text-center border-r">Opening</TableHead>
              <TableHead colSpan={3} className="text-center border-r">Purchase</TableHead>
              <TableHead colSpan={2} className="text-center border-r">Right Share</TableHead>
              <TableHead colSpan={2} className="text-center border-r">Bonus</TableHead>
              <TableHead colSpan={4} className="text-center border-r">Sales</TableHead>
              <TableHead colSpan={3} className="text-center border-r">Closing</TableHead>
              <TableHead colSpan={2} className="text-center border-r">Holdings Type</TableHead>
              <TableHead rowSpan={2} className="text-center border-r">Market Price</TableHead>
              <TableHead rowSpan={2} className="text-center border-r">Unrealised Amount</TableHead>
              <TableHead rowSpan={2} className="text-center border-r">Until <br /> Today %</TableHead>
              <TableHead rowSpan={2} className="text-center">Remarks</TableHead>
            </TableRow>

            <TableRow>
              <TableHead className="text-center">Quantity</TableHead>
              <TableHead className="text-center">Rate</TableHead>
              <TableHead className="text-center border-r">Amount</TableHead>
              <TableHead className="text-center">Quantity</TableHead>
              <TableHead className="text-center">Rate</TableHead>
              <TableHead className="text-center border-r">Amount</TableHead>
              <TableHead className="text-center">Quantity</TableHead>
              <TableHead className="text-center border-r">Total</TableHead>
              <TableHead className="text-center">Quantity</TableHead>
              <TableHead className="text-center border-r">Book Close Date</TableHead>
              <TableHead className="text-center">Quantity</TableHead>
              <TableHead className="text-center">Cost</TableHead>
              <TableHead className="text-center">Amount</TableHead>
              <TableHead className="text-center border-r">Profit</TableHead>
              <TableHead className="text-center">Quantity</TableHead>
              <TableHead className="text-center">Rate</TableHead>
              <TableHead className="text-center border-r">Amount</TableHead>
              <TableHead className="text-center">DEMAT</TableHead>
              <TableHead className="text-center border-r">NON-DEMAT</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={22} className="text-center py-8">
                  Loading metric data...
                </TableCell>
              </TableRow>
            ) : sortedTradingData.length > 0 ? (
              paginatedTradingData.map((data, index) => (
                <TableRow key={`trading-${data.code}-${index}`}>
                  <TableCell className="font-medium border-r"><Link href={`/dashboard/stock/${data.code}`} target="_blank">{data.company}</Link></TableCell>
                  <TableCell className="text-center border-r"><Link href={`/dashboard/stock/${data.code}`} target="_blank">{data.code}</Link></TableCell>
                  <TableCell className="text-center border-r">{data.category}</TableCell>
                  <TableCell className="text-center">{data.opening_quantity.toLocaleString()}</TableCell>
                  <TableCell className="text-center">Rs. {data.opening_rate.toFixed(2)}</TableCell>
                  <TableCell className="text-center border-r">Rs. {data.opening_amount.toLocaleString()}</TableCell>
                  <TableCell className="text-center">{data.purchase_quantity.toLocaleString()}</TableCell>
                  <TableCell className="text-center">Rs. {data.purchase_rate.toFixed(2)}</TableCell>
                  <TableCell className="text-center border-r">Rs. {data.purchase_amount.toLocaleString()}</TableCell>
                  <TableCell className="text-center">{data.right_quantity.toLocaleString()}</TableCell>
                  <TableCell className="text-center border-r">Rs. {data.right_total.toLocaleString()}</TableCell>
                  <TableCell className="text-center">{data.bonus_quantity.toLocaleString()}</TableCell>
                  <TableCell className="text-center border-r">{data.bonus_book_close_date || '-'}</TableCell>
                  <TableCell className="text-center">{data.sales_quantity.toLocaleString()}</TableCell>
                  <TableCell className="text-center">Rs. {data.sales_cost.toLocaleString()}</TableCell>
                  <TableCell className="text-center">Rs. {data.sales_amount.toLocaleString()}</TableCell>
                  <TableCell className={`text-center border-r ${
                    data.sales_profit >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    Rs. {data.sales_profit.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center">{data.closing_quantity.toLocaleString()}</TableCell>
                  <TableCell className="text-center">Rs. {data.closing_rate.toFixed(2)}</TableCell>
                  <TableCell className="text-center border-r">Rs. {data.closing_amount.toLocaleString()}</TableCell>
                  <TableCell className="text-center">{data.demat.toLocaleString()}</TableCell>
                  <TableCell className="text-center border-r">{data.non_demat.toLocaleString()}</TableCell>
                  <TableCell className="text-center border-r font-semibold">Rs. {data.market_price.toFixed(2)}</TableCell>
                  <TableCell className={`text-center border-r font-semibold ${
                    data.unrealised_amount >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    Rs. {data.unrealised_amount.toLocaleString()}
                  </TableCell>
                  
                  <TableCell className={`text-center font-semibold ${
                    data.today_return_percent >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {data.today_return_percent.toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-center">
                    <InlineRemarks
                      initial={data.remarks || ''}
                      onSave={async (value) => {
                        if (!fiscalID) return;
                        await saveSymbolHoldingsRemarks({ clientName: currentFund, fiscalYearId: Number(fiscalID), symbol: data.code, remarks: value })
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={22} className="text-center py-8 text-gray-500">
                  No trading securities found. Please apply filters to load data.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {sortedTradingData.length > 0 && (
            <TableFooter>
              <TableRow className="bg-gray-100 font-semibold">
                <TableCell className="font-bold border-r">TOTAL</TableCell>
                <TableCell className="border-r">-</TableCell>
                <TableCell className="border-r">-</TableCell>
                <TableCell className="text-center">{tradingTotals.opening_quantity.toLocaleString()}</TableCell>
                <TableCell className="text-center">-</TableCell>
                <TableCell className="text-center border-r">Rs. {tradingTotals.opening_amount.toLocaleString()}</TableCell>
                <TableCell className="text-center">{tradingTotals.purchase_quantity.toLocaleString()}</TableCell>
                <TableCell className="text-center">-</TableCell>
                <TableCell className="text-center border-r">Rs. {tradingTotals.purchase_amount.toLocaleString()}</TableCell>
                <TableCell className="text-center">{tradingTotals.right_quantity.toLocaleString()}</TableCell>
                <TableCell className="text-center border-r">Rs. {tradingTotals.right_total.toLocaleString()}</TableCell>
                <TableCell className="text-center">{tradingTotals.bonus_quantity.toLocaleString()}</TableCell>
                <TableCell className="text-center border-r">-</TableCell>
                <TableCell className="text-center">{tradingTotals.sales_quantity.toLocaleString()}</TableCell>
                <TableCell className="text-center">Rs. {tradingTotals.sales_cost.toLocaleString()}</TableCell>
                <TableCell className="text-center">Rs. {tradingTotals.sales_amount.toLocaleString()}</TableCell>
                <TableCell className={`text-center border-r ${
                  tradingTotals.sales_profit >= 0 ? "text-green-600" : "text-red-600"
                }`}>
                  Rs. {tradingTotals.sales_profit.toLocaleString()}
                </TableCell>
                <TableCell className="text-center">{tradingTotals.closing_quantity.toLocaleString()}</TableCell>
                <TableCell className="text-center">-</TableCell>
                <TableCell className="text-center border-r">Rs. {tradingTotals.closing_amount.toLocaleString()}</TableCell>
                <TableCell className="text-center">{tradingTotals.demat.toLocaleString()}</TableCell>
                <TableCell className="text-center border-r">{tradingTotals.non_demat.toLocaleString()}</TableCell>
                <TableCell className="text-center border-r">-</TableCell>
                <TableCell className={`text-center border-r ${
                  tradingTotals.unrealised_amount >= 0 ? "text-green-600" : "text-red-600"
                }`}>
                  Rs. {tradingTotals.unrealised_amount.toLocaleString()}
                </TableCell>
                <TableCell className={`text-center font-semibold ${
                  tradingTotalReturnPercent >= 0 ? "text-green-600" : "text-red-600"
                }`}>
                  {tradingTotalReturnPercent.toFixed(2)}%
                </TableCell>
                <TableCell className="text-center">-</TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
        </div>
      </CardContent>
      
      {/* Trading Table Pagination - Show both conditions */}
      {sortedTradingData.length > 0 && (
        <div className="px-6 py-4 bg-white border-t border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-700">Items per page:</span>
            <Select value={tradingItemsPerPage.toString()} onValueChange={(value) => {
              setTradingItemsPerPage(parseInt(value))
              setTradingCurrentPage(1)
            }}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <Pagination
            currentPage={tradingCurrentPage}
            totalPages={tradingTotalPages}
            onPageChange={handleTradingPageChange}
            itemsPerPage={tradingItemsPerPage}
            totalItems={sortedTradingData.length}
          />
        </div>
      )}
    </Card>
    
    {/* Promoter Shares Table */}
    <Card className="bg-white shadow-lg border border-gray-100 mb-6">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-center mb-4">
          <CardTitle className="text-xl font-bold text-gray-900 flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
            Promoter Shares (Held for Maturity)
            {sortedPromoterData.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({sortedPromoterData.length} securities)
              </span>
            )}
          </CardTitle>
        </div>
        
        {/* Search and Column Controls for Promoter */}
        <div className="flex items-center gap-3 mb-4">
          {/* Search Input */}
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search by company, code, or category..."
              value={promoterSearchTerm}
              onChange={(e) => setPromoterSearchTerm(e.target.value)}
              className="pl-10 pr-10 border-gray-200 focus:border-green-300"
            />
            {promoterSearchTerm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPromoterSearchTerm("")}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-100"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          
          {/* Column Visibility Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2 border-gray-200 hover:border-green-300">
                <Settings className="h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 max-h-96 overflow-y-auto">
              <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={promoterColumnVisibility.company}
                onCheckedChange={(checked) => 
                  setPromoterColumnVisibility(prev => ({ ...prev, company: checked }))
                }
              >
                Company
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={promoterColumnVisibility.code}
                onCheckedChange={(checked) => 
                  setPromoterColumnVisibility(prev => ({ ...prev, code: checked }))
                }
              >
                Code
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={promoterColumnVisibility.category}
                onCheckedChange={(checked) => 
                  setPromoterColumnVisibility(prev => ({ ...prev, category: checked }))
                }
              >
                Category
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={promoterColumnVisibility.opening_quantity}
                onCheckedChange={(checked) => 
                  setPromoterColumnVisibility(prev => ({ ...prev, opening_quantity: checked }))
                }
              >
                Opening Quantity
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={promoterColumnVisibility.opening_rate}
                onCheckedChange={(checked) => 
                  setPromoterColumnVisibility(prev => ({ ...prev, opening_rate: checked }))
                }
              >
                Opening Rate
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={promoterColumnVisibility.opening_amount}
                onCheckedChange={(checked) => 
                  setPromoterColumnVisibility(prev => ({ ...prev, opening_amount: checked }))
                }
              >
                Opening Amount
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={promoterColumnVisibility.purchase_quantity}
                onCheckedChange={(checked) => 
                  setPromoterColumnVisibility(prev => ({ ...prev, purchase_quantity: checked }))
                }
              >
                Purchase Quantity
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={promoterColumnVisibility.purchase_rate}
                onCheckedChange={(checked) => 
                  setPromoterColumnVisibility(prev => ({ ...prev, purchase_rate: checked }))
                }
              >
                Purchase Rate
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={promoterColumnVisibility.purchase_amount}
                onCheckedChange={(checked) => 
                  setPromoterColumnVisibility(prev => ({ ...prev, purchase_amount: checked }))
                }
              >
                Purchase Amount
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={promoterColumnVisibility.closing_quantity}
                onCheckedChange={(checked) => 
                  setPromoterColumnVisibility(prev => ({ ...prev, closing_quantity: checked }))
                }
              >
                Closing Quantity
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={promoterColumnVisibility.closing_rate}
                onCheckedChange={(checked) => 
                  setPromoterColumnVisibility(prev => ({ ...prev, closing_rate: checked }))
                }
              >
                Closing Rate
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={promoterColumnVisibility.closing_amount}
                onCheckedChange={(checked) => 
                  setPromoterColumnVisibility(prev => ({ ...prev, closing_amount: checked }))
                }
              >
                Closing Amount
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={promoterColumnVisibility.market_price}
                onCheckedChange={(checked) => 
                  setPromoterColumnVisibility(prev => ({ ...prev, market_price: checked }))
                }
              >
                Market Price
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={promoterColumnVisibility.revaluation_amount}
                onCheckedChange={(checked) => 
                  setPromoterColumnVisibility(prev => ({ ...prev, revaluation_amount: checked }))
                }
              >
                Revaluation Amount
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="p-0">
      
      <div className="overflow-x-auto">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow>
              <TableHead rowSpan={2} className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handlePromoterSort('company')}>
                Company <SortIndicator field="company" sortField={promoterSortField} sortOrder={promoterSortOrder} />
              </TableHead>
              <TableHead rowSpan={2} className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handlePromoterSort('code')}>
                Code <SortIndicator field="code" sortField={promoterSortField} sortOrder={promoterSortOrder} />
              </TableHead>
              <TableHead rowSpan={2} className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handlePromoterSort('category')}>
                Category <SortIndicator field="category" sortField={promoterSortField} sortOrder={promoterSortOrder} />
              </TableHead>
              <TableHead colSpan={3} className="text-center border-r">Opening</TableHead>
              <TableHead colSpan={3} className="text-center border-r">Purchase</TableHead>
              <TableHead colSpan={2} className="text-center border-r">Right Share</TableHead>
              <TableHead colSpan={2} className="text-center border-r">Bonus</TableHead>
              <TableHead colSpan={4} className="text-center border-r">Sales</TableHead>
              <TableHead colSpan={3} className="text-center border-r">Closing</TableHead>
              <TableHead colSpan={2} className="text-center border-r">Holdings Type</TableHead>
              <TableHead rowSpan={2} className="text-center border-r">Market Price</TableHead>
              <TableHead rowSpan={2} className="text-center border-r">Revaluation Amount</TableHead>
              <TableHead rowSpan={2} className="text-center">Remarks</TableHead>
            </TableRow>
            
            <TableRow>
              <TableHead className="text-center">Quantity</TableHead>
              <TableHead className="text-center">Rate</TableHead>
              <TableHead className="text-center border-r">Amount</TableHead>
              <TableHead className="text-center">Quantity</TableHead>
              <TableHead className="text-center">Rate</TableHead>
              <TableHead className="text-center border-r">Amount</TableHead>
              <TableHead className="text-center">Quantity</TableHead>
              <TableHead className="text-center border-r">Total</TableHead>
              <TableHead className="text-center">Quantity</TableHead>
              <TableHead className="text-center border-r">Book Close Date</TableHead>
              <TableHead className="text-center">Quantity</TableHead>
              <TableHead className="text-center">Cost</TableHead>
              <TableHead className="text-center">Amount</TableHead>
              <TableHead className="text-center border-r">Profit</TableHead>
              <TableHead className="text-center">Quantity</TableHead>
              <TableHead className="text-center">Rate</TableHead>
              <TableHead className="text-center border-r">Amount</TableHead>
              <TableHead className="text-center">DEMAT</TableHead>
              <TableHead className="text-center border-r">NON-DEMAT</TableHead>
            </TableRow>
          </TableHeader>
          
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={21} className="text-center py-8">
                  Loading promoter data...
                </TableCell>
              </TableRow>
            ) : sortedPromoterData.length > 0 ? (
              paginatedPromoterData.map((data, index) => (
                <TableRow 
                  key={`promoter-${data.code}-${index}`}
                  className={data.isIPOStaging ? "bg-yellow-100 hover:bg-yellow-200" : ""}
                  title={data.isIPOStaging ? "IPO Staging (Not Dematerialized)" : undefined}
                >
                  <TableCell className="font-medium border-r"><Link href={`/dashboard/stock/${data.code}`} target="_blank">{data.company}</Link></TableCell>
                  <TableCell className="text-center border-r"><Link href={`/dashboard/stock/${data.code}`} target="_blank">{data.code}</Link></TableCell>
                  <TableCell className="text-center border-r">{data.category}</TableCell>
                  <TableCell className="text-center">{data.opening_quantity.toLocaleString()}</TableCell>
                  <TableCell className="text-center">Rs. {data.opening_rate.toFixed(2)}</TableCell>
                  <TableCell className="text-center border-r">Rs. {data.opening_amount.toLocaleString()}</TableCell>
                  <TableCell className="text-center">{data.purchase_quantity.toLocaleString()}</TableCell>
                  <TableCell className="text-center">Rs. {data.purchase_rate.toFixed(2)}</TableCell>
                  <TableCell className="text-center border-r">Rs. {data.purchase_amount.toLocaleString()}</TableCell>
                  <TableCell className="text-center">{data.right_quantity.toLocaleString()}</TableCell>
                  <TableCell className="text-center border-r">Rs. {data.right_total.toLocaleString()}</TableCell>
                  <TableCell className="text-center">{data.bonus_quantity.toLocaleString()}</TableCell>
                  <TableCell className="text-center border-r">{data.bonus_book_close_date || '-'}</TableCell>
                  <TableCell className="text-center">{data.sales_quantity.toLocaleString()}</TableCell>
                  <TableCell className="text-center">Rs. {data.sales_cost.toLocaleString()}</TableCell>
                  <TableCell className="text-center">Rs. {data.sales_amount.toLocaleString()}</TableCell>
                  <TableCell className={`text-center border-r ${
                    data.sales_profit >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    Rs. {data.sales_profit.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center">{data.closing_quantity.toLocaleString()}</TableCell>
                  <TableCell className="text-center">Rs. {data.closing_rate.toFixed(2)}</TableCell>
                  <TableCell className="text-center border-r">Rs. {data.closing_amount.toLocaleString()}</TableCell>
                  <TableCell className="text-center">{data.demat.toLocaleString()}</TableCell>
                  <TableCell className="text-center border-r">{data.non_demat.toLocaleString()}</TableCell>
                  <TableCell className="text-center border-r font-semibold">Rs. {data.market_price.toFixed(2)}</TableCell>
                  <TableCell className="text-center border-r font-semibold">Rs. {(data.closing_quantity * data.market_price).toLocaleString()}</TableCell>
                  <TableCell className="text-center">
                    <InlineRemarks
                      initial={data.remarks || ''}
                      onSave={async (value) => {
                        if (!fiscalID) return;
                        await saveFYBRemarks({ clientName: currentFund, fiscalYearId: Number(fiscalID), symbol: data.code, remarks: value })
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={21} className="text-center py-8 text-gray-500">
                  No promoter shares found. Please apply filters to load data.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          </Table>
        </div>
      </CardContent>
      
      {/* Promoter Table Pagination - Show both conditions */}
      {sortedPromoterData.length > 0 && (
        <div className="px-6 py-4 bg-white border-t border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-700">Items per page:</span>
            <Select value={promoterItemsPerPage.toString()} onValueChange={(value) => {
              setPromoterItemsPerPage(parseInt(value))
              setPromoterCurrentPage(1)
            }}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <Pagination
            currentPage={promoterCurrentPage}
            totalPages={promoterTotalPages}
            onPageChange={handlePromoterPageChange}
            itemsPerPage={promoterItemsPerPage}
            totalItems={sortedPromoterData.length}
          />
        </div>
      )}
    </Card>

    {/* Sub-Class Tables */}
    {subClasses.length > 0 ? (
      <div className="space-y-6">
        {subClasses.map((subClass) => renderSubClassTable(subClass))}
      </div>
    ) : (
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardContent className="py-8 text-center text-gray-500">
          No additional sub-class holdings available for the selected filters.
        </CardContent>
      </Card>
    )}

    </div>
    )
  )
}
