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
                  {columnVisibility.company && (
                    <TableHead rowSpan={2} className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handleSubClassSort(subClass.sub_id, 'company')}>
                      Company <SortIndicator field="company" sortField={subClassSortFields.get(subClass.sub_id) || null} sortOrder={subClassSortOrders.get(subClass.sub_id) || 'asc'} />
                    </TableHead>
                  )}
                  {columnVisibility.code && (
                    <TableHead rowSpan={2} className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handleSubClassSort(subClass.sub_id, 'code')}>
                      Code <SortIndicator field="code" sortField={subClassSortFields.get(subClass.sub_id) || null} sortOrder={subClassSortOrders.get(subClass.sub_id) || 'asc'} />
                    </TableHead>
                  )}
                  {columnVisibility.category && (
                    <TableHead rowSpan={2} className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handleSubClassSort(subClass.sub_id, 'category')}>
                      Category <SortIndicator field="category" sortField={subClassSortFields.get(subClass.sub_id) || null} sortOrder={subClassSortOrders.get(subClass.sub_id) || 'asc'} />
                    </TableHead>
                  )}
                  {(columnVisibility.opening_quantity || columnVisibility.opening_rate || columnVisibility.opening_amount) && (
                    <TableHead colSpan={
                      (columnVisibility.opening_quantity ? 1 : 0) + 
                      (columnVisibility.opening_rate ? 1 : 0) + 
                      (columnVisibility.opening_amount ? 1 : 0)
                    } className="text-center border-r">Opening</TableHead>
                  )}
                  {(columnVisibility.purchase_quantity || columnVisibility.purchase_rate || columnVisibility.purchase_amount) && (
                    <TableHead colSpan={
                      (columnVisibility.purchase_quantity ? 1 : 0) + 
                      (columnVisibility.purchase_rate ? 1 : 0) + 
                      (columnVisibility.purchase_amount ? 1 : 0)
                    } className="text-center border-r">Purchase</TableHead>
                  )}
                  {(columnVisibility.right_quantity || columnVisibility.right_total) && (
                    <TableHead colSpan={
                      (columnVisibility.right_quantity ? 1 : 0) + 
                      (columnVisibility.right_total ? 1 : 0)
                    } className="text-center border-r">Right Share</TableHead>
                  )}
                  {(columnVisibility.bonus_quantity || columnVisibility.bonus_book_close_date) && (
                    <TableHead colSpan={
                      (columnVisibility.bonus_quantity ? 1 : 0) + 
                      (columnVisibility.bonus_book_close_date ? 1 : 0)
                    } className="text-center border-r">Bonus</TableHead>
                  )}
                  {(columnVisibility.sales_quantity || columnVisibility.sales_cost || columnVisibility.sales_amount || columnVisibility.sales_profit) && (
                    <TableHead colSpan={
                      (columnVisibility.sales_quantity ? 1 : 0) + 
                      (columnVisibility.sales_cost ? 1 : 0) + 
                      (columnVisibility.sales_amount ? 1 : 0) + 
                      (columnVisibility.sales_profit ? 1 : 0)
                    } className="text-center border-r">Sales</TableHead>
                  )}
                  {(columnVisibility.closing_quantity || columnVisibility.closing_rate || columnVisibility.closing_amount) && (
                    <TableHead colSpan={
                      (columnVisibility.closing_quantity ? 1 : 0) + 
                      (columnVisibility.closing_rate ? 1 : 0) + 
                      (columnVisibility.closing_amount ? 1 : 0)
                    } className="text-center border-r">Closing</TableHead>
                  )}
                  {(columnVisibility.demat || columnVisibility.non_demat) && (
                    <TableHead colSpan={
                      (columnVisibility.demat ? 1 : 0) + 
                      (columnVisibility.non_demat ? 1 : 0)
                    } className="text-center border-r">Holdings Type</TableHead>
                  )}
                  {columnVisibility.market_price && (
                    <TableHead rowSpan={2} className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handleSubClassSort(subClass.sub_id, 'market_price')}>
                      Market Price <SortIndicator field="market_price" sortField={subClassSortFields.get(subClass.sub_id) || null} sortOrder={subClassSortOrders.get(subClass.sub_id) || 'asc'} />
                    </TableHead>
                  )}
                  {columnVisibility.revaluation_amount && (
                    <TableHead rowSpan={2} className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handleSubClassSort(subClass.sub_id, 'revaluation_amount')}>
                      Revaluation Amount <SortIndicator field="revaluation_amount" sortField={subClassSortFields.get(subClass.sub_id) || null} sortOrder={subClassSortOrders.get(subClass.sub_id) || 'asc'} />
                    </TableHead>
                  )}
                  {columnVisibility.remarks && (
                    <TableHead rowSpan={2} className="text-center">Remarks</TableHead>
                  )}
                </TableRow>
                
                <TableRow>
                  {columnVisibility.opening_quantity && (
                    <TableHead className="text-center cursor-pointer hover:bg-gray-100" onClick={() => handleSubClassSort(subClass.sub_id, 'opening_quantity')}>
                      Quantity <SortIndicator field="opening_quantity" sortField={subClassSortFields.get(subClass.sub_id) || null} sortOrder={subClassSortOrders.get(subClass.sub_id) || 'asc'} />
                    </TableHead>
                  )}
                  {columnVisibility.opening_rate && (
                    <TableHead className="text-center cursor-pointer hover:bg-gray-100" onClick={() => handleSubClassSort(subClass.sub_id, 'opening_rate')}>
                      Rate <SortIndicator field="opening_rate" sortField={subClassSortFields.get(subClass.sub_id) || null} sortOrder={subClassSortOrders.get(subClass.sub_id) || 'asc'} />
                    </TableHead>
                  )}
                  {columnVisibility.opening_amount && (
                    <TableHead className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handleSubClassSort(subClass.sub_id, 'opening_amount')}>
                      Amount <SortIndicator field="opening_amount" sortField={subClassSortFields.get(subClass.sub_id) || null} sortOrder={subClassSortOrders.get(subClass.sub_id) || 'asc'} />
                    </TableHead>
                  )}
                  {columnVisibility.purchase_quantity && (
                    <TableHead className="text-center cursor-pointer hover:bg-gray-100" onClick={() => handleSubClassSort(subClass.sub_id, 'purchase_quantity')}>
                      Quantity <SortIndicator field="purchase_quantity" sortField={subClassSortFields.get(subClass.sub_id) || null} sortOrder={subClassSortOrders.get(subClass.sub_id) || 'asc'} />
                    </TableHead>
                  )}
                  {columnVisibility.purchase_rate && (
                    <TableHead className="text-center cursor-pointer hover:bg-gray-100" onClick={() => handleSubClassSort(subClass.sub_id, 'purchase_rate')}>
                      Rate <SortIndicator field="purchase_rate" sortField={subClassSortFields.get(subClass.sub_id) || null} sortOrder={subClassSortOrders.get(subClass.sub_id) || 'asc'} />
                    </TableHead>
                  )}
                  {columnVisibility.purchase_amount && (
                    <TableHead className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handleSubClassSort(subClass.sub_id, 'purchase_amount')}>
                      Amount <SortIndicator field="purchase_amount" sortField={subClassSortFields.get(subClass.sub_id) || null} sortOrder={subClassSortOrders.get(subClass.sub_id) || 'asc'} />
                    </TableHead>
                  )}
                  {columnVisibility.right_quantity && (
                    <TableHead className="text-center cursor-pointer hover:bg-gray-100" onClick={() => handleSubClassSort(subClass.sub_id, 'right_quantity')}>
                      Quantity <SortIndicator field="right_quantity" sortField={subClassSortFields.get(subClass.sub_id) || null} sortOrder={subClassSortOrders.get(subClass.sub_id) || 'asc'} />
                    </TableHead>
                  )}
                  {columnVisibility.right_total && (
                    <TableHead className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handleSubClassSort(subClass.sub_id, 'right_total')}>
                      Total <SortIndicator field="right_total" sortField={subClassSortFields.get(subClass.sub_id) || null} sortOrder={subClassSortOrders.get(subClass.sub_id) || 'asc'} />
                    </TableHead>
                  )}
                  {columnVisibility.bonus_quantity && (
                    <TableHead className="text-center cursor-pointer hover:bg-gray-100" onClick={() => handleSubClassSort(subClass.sub_id, 'bonus_quantity')}>
                      Quantity <SortIndicator field="bonus_quantity" sortField={subClassSortFields.get(subClass.sub_id) || null} sortOrder={subClassSortOrders.get(subClass.sub_id) || 'asc'} />
                    </TableHead>
                  )}
                  {columnVisibility.bonus_book_close_date && (
                    <TableHead className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handleSubClassSort(subClass.sub_id, 'bonus_book_close_date')}>
                      Book Close Date <SortIndicator field="bonus_book_close_date" sortField={subClassSortFields.get(subClass.sub_id) || null} sortOrder={subClassSortOrders.get(subClass.sub_id) || 'asc'} />
                    </TableHead>
                  )}
                  {columnVisibility.sales_quantity && (
                    <TableHead className="text-center cursor-pointer hover:bg-gray-100" onClick={() => handleSubClassSort(subClass.sub_id, 'sales_quantity')}>
                      Quantity <SortIndicator field="sales_quantity" sortField={subClassSortFields.get(subClass.sub_id) || null} sortOrder={subClassSortOrders.get(subClass.sub_id) || 'asc'} />
                    </TableHead>
                  )}
                  {columnVisibility.sales_cost && (
                    <TableHead className="text-center cursor-pointer hover:bg-gray-100" onClick={() => handleSubClassSort(subClass.sub_id, 'sales_cost')}>
                      Cost <SortIndicator field="sales_cost" sortField={subClassSortFields.get(subClass.sub_id) || null} sortOrder={subClassSortOrders.get(subClass.sub_id) || 'asc'} />
                    </TableHead>
                  )}
                  {columnVisibility.sales_amount && (
                    <TableHead className="text-center cursor-pointer hover:bg-gray-100" onClick={() => handleSubClassSort(subClass.sub_id, 'sales_amount')}>
                      Amount <SortIndicator field="sales_amount" sortField={subClassSortFields.get(subClass.sub_id) || null} sortOrder={subClassSortOrders.get(subClass.sub_id) || 'asc'} />
                    </TableHead>
                  )}
                  {columnVisibility.sales_profit && (
                    <TableHead className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handleSubClassSort(subClass.sub_id, 'sales_profit')}>
                      Profit <SortIndicator field="sales_profit" sortField={subClassSortFields.get(subClass.sub_id) || null} sortOrder={subClassSortOrders.get(subClass.sub_id) || 'asc'} />
                    </TableHead>
                  )}
                  {columnVisibility.closing_quantity && (
                    <TableHead className="text-center cursor-pointer hover:bg-gray-100" onClick={() => handleSubClassSort(subClass.sub_id, 'closing_quantity')}>
                      Quantity <SortIndicator field="closing_quantity" sortField={subClassSortFields.get(subClass.sub_id) || null} sortOrder={subClassSortOrders.get(subClass.sub_id) || 'asc'} />
                    </TableHead>
                  )}
                  {columnVisibility.closing_rate && (
                    <TableHead className="text-center cursor-pointer hover:bg-gray-100" onClick={() => handleSubClassSort(subClass.sub_id, 'closing_rate')}>
                      Rate <SortIndicator field="closing_rate" sortField={subClassSortFields.get(subClass.sub_id) || null} sortOrder={subClassSortOrders.get(subClass.sub_id) || 'asc'} />
                    </TableHead>
                  )}
                  {columnVisibility.closing_amount && (
                    <TableHead className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handleSubClassSort(subClass.sub_id, 'closing_amount')}>
                      Amount <SortIndicator field="closing_amount" sortField={subClassSortFields.get(subClass.sub_id) || null} sortOrder={subClassSortOrders.get(subClass.sub_id) || 'asc'} />
                    </TableHead>
                  )}
                  {columnVisibility.demat && (
                    <TableHead className="text-center cursor-pointer hover:bg-gray-100" onClick={() => handleSubClassSort(subClass.sub_id, 'demat')}>
                      DEMAT <SortIndicator field="demat" sortField={subClassSortFields.get(subClass.sub_id) || null} sortOrder={subClassSortOrders.get(subClass.sub_id) || 'asc'} />
                    </TableHead>
                  )}
                  {columnVisibility.non_demat && (
                    <TableHead className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handleSubClassSort(subClass.sub_id, 'non_demat')}>
                      NON-DEMAT <SortIndicator field="non_demat" sortField={subClassSortFields.get(subClass.sub_id) || null} sortOrder={subClassSortOrders.get(subClass.sub_id) || 'asc'} />
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={Object.values(columnVisibility).filter(Boolean).length} className="text-center py-8">
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
                      {columnVisibility.company && (
                        <TableCell className="font-medium border-r"><Link href={`/dashboard/stock/${data.code}`} target="_blank">{data.company}</Link></TableCell>
                      )}
                      {columnVisibility.code && (
                        <TableCell className="text-center border-r"><Link href={`/dashboard/stock/${data.code}`} target="_blank">{data.code}</Link></TableCell>
                      )}
                      {columnVisibility.category && (
                        <TableCell className="text-center border-r">{data.category}</TableCell>
                      )}
                      {columnVisibility.opening_quantity && (
                        <TableCell className="text-center">{data.opening_quantity.toLocaleString()}</TableCell>
                      )}
                      {columnVisibility.opening_rate && (
                        <TableCell className="text-center">Rs. {data.opening_rate.toFixed(2)}</TableCell>
                      )}
                      {columnVisibility.opening_amount && (
                        <TableCell className="text-center border-r">Rs. {data.opening_amount.toLocaleString()}</TableCell>
                      )}
                      {columnVisibility.purchase_quantity && (
                        <TableCell className="text-center">{data.purchase_quantity.toLocaleString()}</TableCell>
                      )}
                      {columnVisibility.purchase_rate && (
                        <TableCell className="text-center">Rs. {data.purchase_rate.toFixed(2)}</TableCell>
                      )}
                      {columnVisibility.purchase_amount && (
                        <TableCell className="text-center border-r">Rs. {data.purchase_amount.toLocaleString()}</TableCell>
                      )}
                      {columnVisibility.right_quantity && (
                        <TableCell className="text-center">{data.right_quantity.toLocaleString()}</TableCell>
                      )}
                      {columnVisibility.right_total && (
                        <TableCell className="text-center border-r">Rs. {data.right_total.toLocaleString()}</TableCell>
                      )}
                      {columnVisibility.bonus_quantity && (
                        <TableCell className="text-center">{data.bonus_quantity.toLocaleString()}</TableCell>
                      )}
                      {columnVisibility.bonus_book_close_date && (
                        <TableCell className="text-center border-r">{data.bonus_book_close_date || '-'}</TableCell>
                      )}
                      {columnVisibility.sales_quantity && (
                        <TableCell className="text-center">{data.sales_quantity.toLocaleString()}</TableCell>
                      )}
                      {columnVisibility.sales_cost && (
                        <TableCell className="text-center">Rs. {data.sales_cost.toLocaleString()}</TableCell>
                      )}
                      {columnVisibility.sales_amount && (
                        <TableCell className="text-center">Rs. {data.sales_amount.toLocaleString()}</TableCell>
                      )}
                      {columnVisibility.sales_profit && (
                        <TableCell className={`text-center border-r ${
                          data.sales_profit >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          Rs. {data.sales_profit.toLocaleString()}
                        </TableCell>
                      )}
                      {columnVisibility.closing_quantity && (
                        <TableCell className="text-center">{data.closing_quantity.toLocaleString()}</TableCell>
                      )}
                      {columnVisibility.closing_rate && (
                        <TableCell className="text-center">Rs. {data.closing_rate.toFixed(2)}</TableCell>
                      )}
                      {columnVisibility.closing_amount && (
                        <TableCell className="text-center border-r">Rs. {data.closing_amount.toLocaleString()}</TableCell>
                      )}
                      {columnVisibility.demat && (
                        <TableCell className="text-center">{data.demat.toLocaleString()}</TableCell>
                      )}
                      {columnVisibility.non_demat && (
                        <TableCell className="text-center border-r">{data.non_demat.toLocaleString()}</TableCell>
                      )}
                      {columnVisibility.market_price && (
                        <TableCell className="text-center border-r font-semibold">Rs. {data.market_price.toFixed(2)}</TableCell>
                      )}
                      {columnVisibility.revaluation_amount && (
                        <TableCell className="text-center border-r font-semibold">Rs. {(data.closing_quantity * data.market_price).toLocaleString()}</TableCell>
                      )}
                      {columnVisibility.remarks && (
                        <TableCell className="text-center">
                          <InlineRemarks
                            initial={data.remarks || ''}
                            onSave={async (value) => {
                              if (!fiscalID) return;
                              await saveFYBRemarks({ clientName: currentFund, fiscalYearId: Number(fiscalID), symbol: data.code, remarks: value })
                            }}
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={Object.values(columnVisibility).filter(Boolean).length} className="text-center py-8 text-gray-500">
                      No {subClass.sub_name} securities found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              
              {/* Sub Class Table Footer with Totals */}
              {filteredData.length > 0 && (
                <TableFooter>
                  <TableRow className="bg-gray-100 font-semibold">
                    {columnVisibility.company && (
                      <TableCell className="font-bold border-r">TOTAL</TableCell>
                    )}
                    {columnVisibility.code && (
                      <TableCell className="border-r">-</TableCell>
                    )}
                    {columnVisibility.category && (
                      <TableCell className="border-r">-</TableCell>
                    )}
                    {columnVisibility.opening_quantity && (
                      <TableCell className="text-center">{subClassTotals.opening_quantity.toLocaleString()}</TableCell>
                    )}
                    {columnVisibility.opening_rate && (
                      <TableCell className="text-center">-</TableCell>
                    )}
                    {columnVisibility.opening_amount && (
                      <TableCell className="text-center border-r">Rs. {subClassTotals.opening_amount.toLocaleString()}</TableCell>
                    )}
                    {columnVisibility.purchase_quantity && (
                      <TableCell className="text-center">{subClassTotals.purchase_quantity.toLocaleString()}</TableCell>
                    )}
                    {columnVisibility.purchase_rate && (
                      <TableCell className="text-center">-</TableCell>
                    )}
                    {columnVisibility.purchase_amount && (
                      <TableCell className="text-center border-r">Rs. {subClassTotals.purchase_amount.toLocaleString()}</TableCell>
                    )}
                    {columnVisibility.right_quantity && (
                      <TableCell className="text-center">{subClassTotals.right_quantity.toLocaleString()}</TableCell>
                    )}
                    {columnVisibility.right_total && (
                      <TableCell className="text-center border-r">Rs. {subClassTotals.right_total.toLocaleString()}</TableCell>
                    )}
                    {columnVisibility.bonus_quantity && (
                      <TableCell className="text-center">{subClassTotals.bonus_quantity.toLocaleString()}</TableCell>
                    )}
                    {columnVisibility.bonus_book_close_date && (
                      <TableCell className="text-center border-r">-</TableCell>
                    )}
                    {columnVisibility.sales_quantity && (
                      <TableCell className="text-center">{subClassTotals.sales_quantity.toLocaleString()}</TableCell>
                    )}
                    {columnVisibility.sales_cost && (
                      <TableCell className="text-center">Rs. {subClassTotals.sales_cost.toLocaleString()}</TableCell>
                    )}
                    {columnVisibility.sales_amount && (
                      <TableCell className="text-center">Rs. {subClassTotals.sales_amount.toLocaleString()}</TableCell>
                    )}
                    {columnVisibility.sales_profit && (
                      <TableCell className={`text-center border-r ${
                        subClassTotals.sales_profit >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        Rs. {subClassTotals.sales_profit.toLocaleString()}
                      </TableCell>
                    )}
                    {columnVisibility.closing_quantity && (
                      <TableCell className="text-center">{subClassTotals.closing_quantity.toLocaleString()}</TableCell>
                    )}
                    {columnVisibility.closing_rate && (
                      <TableCell className="text-center">-</TableCell>
                    )}
                    {columnVisibility.closing_amount && (
                      <TableCell className="text-center border-r">Rs. {subClassTotals.closing_amount.toLocaleString()}</TableCell>
                    )}
                    {columnVisibility.demat && (
                      <TableCell className="text-center">{subClassTotals.demat.toLocaleString()}</TableCell>
                    )}
                    {columnVisibility.non_demat && (
                      <TableCell className="text-center border-r">{subClassTotals.non_demat.toLocaleString()}</TableCell>
                    )}
                    {columnVisibility.market_price && (
                      <TableCell className="text-center border-r">-</TableCell>
                    )}
                    {columnVisibility.revaluation_amount && (
                      <TableCell className="text-center border-r font-bold">Rs. {subClassTotals.revaluation_amount.toLocaleString()}</TableCell>
                    )}
                    {columnVisibility.remarks && (
                      <TableCell className="text-center">-</TableCell>
                    )}
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
              {tradingColumnVisibility.company && (
                <TableHead rowSpan={2} className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handleTradingSort('company')}>
                  Company <SortIndicator field="company" sortField={tradingSortField} sortOrder={tradingSortOrder} />
                </TableHead>
              )}
              {tradingColumnVisibility.code && (
                <TableHead rowSpan={2} className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handleTradingSort('code')}>
                  Code <SortIndicator field="code" sortField={tradingSortField} sortOrder={tradingSortOrder} />
                </TableHead>
              )}
              {tradingColumnVisibility.category && (
                <TableHead rowSpan={2} className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handleTradingSort('category')}>
                  Category <SortIndicator field="category" sortField={tradingSortField} sortOrder={tradingSortOrder} />
                </TableHead>
              )}
              {(tradingColumnVisibility.opening_quantity || tradingColumnVisibility.opening_rate || tradingColumnVisibility.opening_amount) && (
                <TableHead colSpan={
                  (tradingColumnVisibility.opening_quantity ? 1 : 0) + 
                  (tradingColumnVisibility.opening_rate ? 1 : 0) + 
                  (tradingColumnVisibility.opening_amount ? 1 : 0)
                } className="text-center border-r">Opening</TableHead>
              )}
              {(tradingColumnVisibility.purchase_quantity || tradingColumnVisibility.purchase_rate || tradingColumnVisibility.purchase_amount) && (
                <TableHead colSpan={
                  (tradingColumnVisibility.purchase_quantity ? 1 : 0) + 
                  (tradingColumnVisibility.purchase_rate ? 1 : 0) + 
                  (tradingColumnVisibility.purchase_amount ? 1 : 0)
                } className="text-center border-r">Purchase</TableHead>
              )}
              {(tradingColumnVisibility.right_quantity || tradingColumnVisibility.right_total) && (
                <TableHead colSpan={
                  (tradingColumnVisibility.right_quantity ? 1 : 0) + 
                  (tradingColumnVisibility.right_total ? 1 : 0)
                } className="text-center border-r">Right Share</TableHead>
              )}
              {(tradingColumnVisibility.bonus_quantity || tradingColumnVisibility.bonus_book_close_date) && (
                <TableHead colSpan={
                  (tradingColumnVisibility.bonus_quantity ? 1 : 0) + 
                  (tradingColumnVisibility.bonus_book_close_date ? 1 : 0)
                } className="text-center border-r">Bonus</TableHead>
              )}
              {(tradingColumnVisibility.sales_quantity || tradingColumnVisibility.sales_cost || tradingColumnVisibility.sales_amount || tradingColumnVisibility.sales_profit) && (
                <TableHead colSpan={
                  (tradingColumnVisibility.sales_quantity ? 1 : 0) + 
                  (tradingColumnVisibility.sales_cost ? 1 : 0) + 
                  (tradingColumnVisibility.sales_amount ? 1 : 0) + 
                  (tradingColumnVisibility.sales_profit ? 1 : 0)
                } className="text-center border-r">Sales</TableHead>
              )}
              {(tradingColumnVisibility.closing_quantity || tradingColumnVisibility.closing_rate || tradingColumnVisibility.closing_amount) && (
                <TableHead colSpan={
                  (tradingColumnVisibility.closing_quantity ? 1 : 0) + 
                  (tradingColumnVisibility.closing_rate ? 1 : 0) + 
                  (tradingColumnVisibility.closing_amount ? 1 : 0)
                } className="text-center border-r">Closing</TableHead>
              )}
              {(tradingColumnVisibility.demat || tradingColumnVisibility.non_demat) && (
                <TableHead colSpan={
                  (tradingColumnVisibility.demat ? 1 : 0) + 
                  (tradingColumnVisibility.non_demat ? 1 : 0)
                } className="text-center border-r">Holdings Type</TableHead>
              )}
              {tradingColumnVisibility.market_price && (
                <TableHead rowSpan={2} className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handleTradingSort('market_price')}>
                  Market Price <SortIndicator field="market_price" sortField={tradingSortField} sortOrder={tradingSortOrder} />
                </TableHead>
              )}
              {tradingColumnVisibility.unrealised_amount && (
                <TableHead rowSpan={2} className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handleTradingSort('unrealised_amount')}>
                  Unrealised Amount <SortIndicator field="unrealised_amount" sortField={tradingSortField} sortOrder={tradingSortOrder} />
                </TableHead>
              )}
              {tradingColumnVisibility.today_return_percent && (
                <TableHead rowSpan={2} className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handleTradingSort('today_return_percent')}>
                  Until <br /> Today % <SortIndicator field="today_return_percent" sortField={tradingSortField} sortOrder={tradingSortOrder} />
                </TableHead>
              )}
              {tradingColumnVisibility.remarks && (
                <TableHead rowSpan={2} className="text-center">Remarks</TableHead>
              )}
            </TableRow>

            <TableRow>
              {tradingColumnVisibility.opening_quantity && (
                <TableHead className="text-center cursor-pointer hover:bg-gray-100" onClick={() => handleTradingSort('opening_quantity')}>
                  Quantity <SortIndicator field="opening_quantity" sortField={tradingSortField} sortOrder={tradingSortOrder} />
                </TableHead>
              )}
              {tradingColumnVisibility.opening_rate && (
                <TableHead className="text-center cursor-pointer hover:bg-gray-100" onClick={() => handleTradingSort('opening_rate')}>
                  Rate <SortIndicator field="opening_rate" sortField={tradingSortField} sortOrder={tradingSortOrder} />
                </TableHead>
              )}
              {tradingColumnVisibility.opening_amount && (
                <TableHead className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handleTradingSort('opening_amount')}>
                  Amount <SortIndicator field="opening_amount" sortField={tradingSortField} sortOrder={tradingSortOrder} />
                </TableHead>
              )}
              {tradingColumnVisibility.purchase_quantity && (
                <TableHead className="text-center cursor-pointer hover:bg-gray-100" onClick={() => handleTradingSort('purchase_quantity')}>
                  Quantity <SortIndicator field="purchase_quantity" sortField={tradingSortField} sortOrder={tradingSortOrder} />
                </TableHead>
              )}
              {tradingColumnVisibility.purchase_rate && (
                <TableHead className="text-center cursor-pointer hover:bg-gray-100" onClick={() => handleTradingSort('purchase_rate')}>
                  Rate <SortIndicator field="purchase_rate" sortField={tradingSortField} sortOrder={tradingSortOrder} />
                </TableHead>
              )}
              {tradingColumnVisibility.purchase_amount && (
                <TableHead className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handleTradingSort('purchase_amount')}>
                  Amount <SortIndicator field="purchase_amount" sortField={tradingSortField} sortOrder={tradingSortOrder} />
                </TableHead>
              )}
              {tradingColumnVisibility.right_quantity && (
                <TableHead className="text-center cursor-pointer hover:bg-gray-100" onClick={() => handleTradingSort('right_quantity')}>
                  Quantity <SortIndicator field="right_quantity" sortField={tradingSortField} sortOrder={tradingSortOrder} />
                </TableHead>
              )}
              {tradingColumnVisibility.right_total && (
                <TableHead className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handleTradingSort('right_total')}>
                  Total <SortIndicator field="right_total" sortField={tradingSortField} sortOrder={tradingSortOrder} />
                </TableHead>
              )}
              {tradingColumnVisibility.bonus_quantity && (
                <TableHead className="text-center cursor-pointer hover:bg-gray-100" onClick={() => handleTradingSort('bonus_quantity')}>
                  Quantity <SortIndicator field="bonus_quantity" sortField={tradingSortField} sortOrder={tradingSortOrder} />
                </TableHead>
              )}
              {tradingColumnVisibility.bonus_book_close_date && (
                <TableHead className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handleTradingSort('bonus_book_close_date')}>
                  Book Close Date <SortIndicator field="bonus_book_close_date" sortField={tradingSortField} sortOrder={tradingSortOrder} />
                </TableHead>
              )}
              {tradingColumnVisibility.sales_quantity && (
                <TableHead className="text-center cursor-pointer hover:bg-gray-100" onClick={() => handleTradingSort('sales_quantity')}>
                  Quantity <SortIndicator field="sales_quantity" sortField={tradingSortField} sortOrder={tradingSortOrder} />
                </TableHead>
              )}
              {tradingColumnVisibility.sales_cost && (
                <TableHead className="text-center cursor-pointer hover:bg-gray-100" onClick={() => handleTradingSort('sales_cost')}>
                  Cost <SortIndicator field="sales_cost" sortField={tradingSortField} sortOrder={tradingSortOrder} />
                </TableHead>
              )}
              {tradingColumnVisibility.sales_amount && (
                <TableHead className="text-center cursor-pointer hover:bg-gray-100" onClick={() => handleTradingSort('sales_amount')}>
                  Amount <SortIndicator field="sales_amount" sortField={tradingSortField} sortOrder={tradingSortOrder} />
                </TableHead>
              )}
              {tradingColumnVisibility.sales_profit && (
                <TableHead className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handleTradingSort('sales_profit')}>
                  Profit <SortIndicator field="sales_profit" sortField={tradingSortField} sortOrder={tradingSortOrder} />
                </TableHead>
              )}
              {tradingColumnVisibility.closing_quantity && (
                <TableHead className="text-center cursor-pointer hover:bg-gray-100" onClick={() => handleTradingSort('closing_quantity')}>
                  Quantity <SortIndicator field="closing_quantity" sortField={tradingSortField} sortOrder={tradingSortOrder} />
                </TableHead>
              )}
              {tradingColumnVisibility.closing_rate && (
                <TableHead className="text-center cursor-pointer hover:bg-gray-100" onClick={() => handleTradingSort('closing_rate')}>
                  Rate <SortIndicator field="closing_rate" sortField={tradingSortField} sortOrder={tradingSortOrder} />
                </TableHead>
              )}
              {tradingColumnVisibility.closing_amount && (
                <TableHead className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handleTradingSort('closing_amount')}>
                  Amount <SortIndicator field="closing_amount" sortField={tradingSortField} sortOrder={tradingSortOrder} />
                </TableHead>
              )}
              {tradingColumnVisibility.demat && (
                <TableHead className="text-center cursor-pointer hover:bg-gray-100" onClick={() => handleTradingSort('demat')}>
                  DEMAT <SortIndicator field="demat" sortField={tradingSortField} sortOrder={tradingSortOrder} />
                </TableHead>
              )}
              {tradingColumnVisibility.non_demat && (
                <TableHead className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handleTradingSort('non_demat')}>
                  NON-DEMAT <SortIndicator field="non_demat" sortField={tradingSortField} sortOrder={tradingSortOrder} />
                </TableHead>
              )}
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={Object.values(tradingColumnVisibility).filter(Boolean).length} className="text-center py-8">
                  Loading metric data...
                </TableCell>
              </TableRow>
            ) : sortedTradingData.length > 0 ? (
              paginatedTradingData.map((data, index) => (
                <TableRow key={`trading-${data.code}-${index}`}>
                  {tradingColumnVisibility.company && (
                    <TableCell className="font-medium border-r"><Link href={`/dashboard/stock/${data.code}`} target="_blank">{data.company}</Link></TableCell>
                  )}
                  {tradingColumnVisibility.code && (
                    <TableCell className="text-center border-r"><Link href={`/dashboard/stock/${data.code}`} target="_blank">{data.code}</Link></TableCell>
                  )}
                  {tradingColumnVisibility.category && (
                    <TableCell className="text-center border-r">{data.category}</TableCell>
                  )}
                  {tradingColumnVisibility.opening_quantity && (
                    <TableCell className="text-center">{data.opening_quantity.toLocaleString()}</TableCell>
                  )}
                  {tradingColumnVisibility.opening_rate && (
                    <TableCell className="text-center">Rs. {data.opening_rate.toFixed(2)}</TableCell>
                  )}
                  {tradingColumnVisibility.opening_amount && (
                    <TableCell className="text-center border-r">Rs. {data.opening_amount.toLocaleString()}</TableCell>
                  )}
                  {tradingColumnVisibility.purchase_quantity && (
                    <TableCell className="text-center">{data.purchase_quantity.toLocaleString()}</TableCell>
                  )}
                  {tradingColumnVisibility.purchase_rate && (
                    <TableCell className="text-center">Rs. {data.purchase_rate.toFixed(2)}</TableCell>
                  )}
                  {tradingColumnVisibility.purchase_amount && (
                    <TableCell className="text-center border-r">Rs. {data.purchase_amount.toLocaleString()}</TableCell>
                  )}
                  {tradingColumnVisibility.right_quantity && (
                    <TableCell className="text-center">{data.right_quantity.toLocaleString()}</TableCell>
                  )}
                  {tradingColumnVisibility.right_total && (
                    <TableCell className="text-center border-r">Rs. {data.right_total.toLocaleString()}</TableCell>
                  )}
                  {tradingColumnVisibility.bonus_quantity && (
                    <TableCell className="text-center">{data.bonus_quantity.toLocaleString()}</TableCell>
                  )}
                  {tradingColumnVisibility.bonus_book_close_date && (
                    <TableCell className="text-center border-r">{data.bonus_book_close_date || '-'}</TableCell>
                  )}
                  {tradingColumnVisibility.sales_quantity && (
                    <TableCell className="text-center">{data.sales_quantity.toLocaleString()}</TableCell>
                  )}
                  {tradingColumnVisibility.sales_cost && (
                    <TableCell className="text-center">Rs. {data.sales_cost.toLocaleString()}</TableCell>
                  )}
                  {tradingColumnVisibility.sales_amount && (
                    <TableCell className="text-center">Rs. {data.sales_amount.toLocaleString()}</TableCell>
                  )}
                  {tradingColumnVisibility.sales_profit && (
                    <TableCell className={`text-center border-r ${
                      data.sales_profit >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      Rs. {data.sales_profit.toLocaleString()}
                    </TableCell>
                  )}
                  {tradingColumnVisibility.closing_quantity && (
                    <TableCell className="text-center">{data.closing_quantity.toLocaleString()}</TableCell>
                  )}
                  {tradingColumnVisibility.closing_rate && (
                    <TableCell className="text-center">Rs. {data.closing_rate.toFixed(2)}</TableCell>
                  )}
                  {tradingColumnVisibility.closing_amount && (
                    <TableCell className="text-center border-r">Rs. {data.closing_amount.toLocaleString()}</TableCell>
                  )}
                  {tradingColumnVisibility.demat && (
                    <TableCell className="text-center">{data.demat.toLocaleString()}</TableCell>
                  )}
                  {tradingColumnVisibility.non_demat && (
                    <TableCell className="text-center border-r">{data.non_demat.toLocaleString()}</TableCell>
                  )}
                  {tradingColumnVisibility.market_price && (
                    <TableCell className="text-center border-r font-semibold">Rs. {data.market_price.toFixed(2)}</TableCell>
                  )}
                  {tradingColumnVisibility.unrealised_amount && (
                    <TableCell className={`text-center border-r font-semibold ${
                      data.unrealised_amount >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      Rs. {data.unrealised_amount.toLocaleString()}
                    </TableCell>
                  )}
                  {tradingColumnVisibility.today_return_percent && (
                    <TableCell className={`text-center font-semibold ${
                      data.today_return_percent >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {data.today_return_percent.toFixed(2)}%
                    </TableCell>
                  )}
                  {tradingColumnVisibility.remarks && (
                    <TableCell className="text-center">
                      <InlineRemarks
                        initial={data.remarks || ''}
                        onSave={async (value) => {
                          if (!fiscalID) return;
                          await saveSymbolHoldingsRemarks({ clientName: currentFund, fiscalYearId: Number(fiscalID), symbol: data.code, remarks: value })
                        }}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={Object.values(tradingColumnVisibility).filter(Boolean).length} className="text-center py-8 text-gray-500">
                  No trading securities found. Please apply filters to load data.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {sortedTradingData.length > 0 && (
            <TableFooter>
              <TableRow className="bg-gray-100 font-semibold">
                {tradingColumnVisibility.company && (
                  <TableCell className="font-bold border-r">TOTAL</TableCell>
                )}
                {tradingColumnVisibility.code && (
                  <TableCell className="border-r">-</TableCell>
                )}
                {tradingColumnVisibility.category && (
                  <TableCell className="border-r">-</TableCell>
                )}
                {tradingColumnVisibility.opening_quantity && (
                  <TableCell className="text-center">{tradingTotals.opening_quantity.toLocaleString()}</TableCell>
                )}
                {tradingColumnVisibility.opening_rate && (
                  <TableCell className="text-center">-</TableCell>
                )}
                {tradingColumnVisibility.opening_amount && (
                  <TableCell className="text-center border-r">Rs. {tradingTotals.opening_amount.toLocaleString()}</TableCell>
                )}
                {tradingColumnVisibility.purchase_quantity && (
                  <TableCell className="text-center">{tradingTotals.purchase_quantity.toLocaleString()}</TableCell>
                )}
                {tradingColumnVisibility.purchase_rate && (
                  <TableCell className="text-center">-</TableCell>
                )}
                {tradingColumnVisibility.purchase_amount && (
                  <TableCell className="text-center border-r">Rs. {tradingTotals.purchase_amount.toLocaleString()}</TableCell>
                )}
                {tradingColumnVisibility.right_quantity && (
                  <TableCell className="text-center">{tradingTotals.right_quantity.toLocaleString()}</TableCell>
                )}
                {tradingColumnVisibility.right_total && (
                  <TableCell className="text-center border-r">Rs. {tradingTotals.right_total.toLocaleString()}</TableCell>
                )}
                {tradingColumnVisibility.bonus_quantity && (
                  <TableCell className="text-center">{tradingTotals.bonus_quantity.toLocaleString()}</TableCell>
                )}
                {tradingColumnVisibility.bonus_book_close_date && (
                  <TableCell className="text-center border-r">-</TableCell>
                )}
                {tradingColumnVisibility.sales_quantity && (
                  <TableCell className="text-center">{tradingTotals.sales_quantity.toLocaleString()}</TableCell>
                )}
                {tradingColumnVisibility.sales_cost && (
                  <TableCell className="text-center">Rs. {tradingTotals.sales_cost.toLocaleString()}</TableCell>
                )}
                {tradingColumnVisibility.sales_amount && (
                  <TableCell className="text-center">Rs. {tradingTotals.sales_amount.toLocaleString()}</TableCell>
                )}
                {tradingColumnVisibility.sales_profit && (
                  <TableCell className={`text-center border-r ${
                    tradingTotals.sales_profit >= 0 ? "text-green-600" : "text-red-600"
                  }`}>
                    Rs. {tradingTotals.sales_profit.toLocaleString()}
                  </TableCell>
                )}
                {tradingColumnVisibility.closing_quantity && (
                  <TableCell className="text-center">{tradingTotals.closing_quantity.toLocaleString()}</TableCell>
                )}
                {tradingColumnVisibility.closing_rate && (
                  <TableCell className="text-center">-</TableCell>
                )}
                {tradingColumnVisibility.closing_amount && (
                  <TableCell className="text-center border-r">Rs. {tradingTotals.closing_amount.toLocaleString()}</TableCell>
                )}
                {tradingColumnVisibility.demat && (
                  <TableCell className="text-center">{tradingTotals.demat.toLocaleString()}</TableCell>
                )}
                {tradingColumnVisibility.non_demat && (
                  <TableCell className="text-center border-r">{tradingTotals.non_demat.toLocaleString()}</TableCell>
                )}
                {tradingColumnVisibility.market_price && (
                  <TableCell className="text-center border-r">-</TableCell>
                )}
                {tradingColumnVisibility.unrealised_amount && (
                  <TableCell className={`text-center border-r ${
                    tradingTotals.unrealised_amount >= 0 ? "text-green-600" : "text-red-600"
                  }`}>
                    Rs. {tradingTotals.unrealised_amount.toLocaleString()}
                  </TableCell>
                )}
                {tradingColumnVisibility.today_return_percent && (
                  <TableCell className={`text-center font-semibold ${
                    tradingTotalReturnPercent >= 0 ? "text-green-600" : "text-red-600"
                  }`}>
                    {tradingTotalReturnPercent.toFixed(2)}%
                  </TableCell>
                )}
                {tradingColumnVisibility.remarks && (
                  <TableCell className="text-center">-</TableCell>
                )}
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
              {promoterColumnVisibility.company && (
                <TableHead rowSpan={2} className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handlePromoterSort('company')}>
                  Company <SortIndicator field="company" sortField={promoterSortField} sortOrder={promoterSortOrder} />
                </TableHead>
              )}
              {promoterColumnVisibility.code && (
                <TableHead rowSpan={2} className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handlePromoterSort('code')}>
                  Code <SortIndicator field="code" sortField={promoterSortField} sortOrder={promoterSortOrder} />
                </TableHead>
              )}
              {promoterColumnVisibility.category && (
                <TableHead rowSpan={2} className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handlePromoterSort('category')}>
                  Category <SortIndicator field="category" sortField={promoterSortField} sortOrder={promoterSortOrder} />
                </TableHead>
              )}
              {(promoterColumnVisibility.opening_quantity || promoterColumnVisibility.opening_rate || promoterColumnVisibility.opening_amount) && (
                <TableHead colSpan={
                  (promoterColumnVisibility.opening_quantity ? 1 : 0) + 
                  (promoterColumnVisibility.opening_rate ? 1 : 0) + 
                  (promoterColumnVisibility.opening_amount ? 1 : 0)
                } className="text-center border-r">Opening</TableHead>
              )}
              {(promoterColumnVisibility.purchase_quantity || promoterColumnVisibility.purchase_rate || promoterColumnVisibility.purchase_amount) && (
                <TableHead colSpan={
                  (promoterColumnVisibility.purchase_quantity ? 1 : 0) + 
                  (promoterColumnVisibility.purchase_rate ? 1 : 0) + 
                  (promoterColumnVisibility.purchase_amount ? 1 : 0)
                } className="text-center border-r">Purchase</TableHead>
              )}
              {(promoterColumnVisibility.right_quantity || promoterColumnVisibility.right_total) && (
                <TableHead colSpan={
                  (promoterColumnVisibility.right_quantity ? 1 : 0) + 
                  (promoterColumnVisibility.right_total ? 1 : 0)
                } className="text-center border-r">Right Share</TableHead>
              )}
              {(promoterColumnVisibility.bonus_quantity || promoterColumnVisibility.bonus_book_close_date) && (
                <TableHead colSpan={
                  (promoterColumnVisibility.bonus_quantity ? 1 : 0) + 
                  (promoterColumnVisibility.bonus_book_close_date ? 1 : 0)
                } className="text-center border-r">Bonus</TableHead>
              )}
              {(promoterColumnVisibility.sales_quantity || promoterColumnVisibility.sales_cost || promoterColumnVisibility.sales_amount || promoterColumnVisibility.sales_profit) && (
                <TableHead colSpan={
                  (promoterColumnVisibility.sales_quantity ? 1 : 0) + 
                  (promoterColumnVisibility.sales_cost ? 1 : 0) + 
                  (promoterColumnVisibility.sales_amount ? 1 : 0) + 
                  (promoterColumnVisibility.sales_profit ? 1 : 0)
                } className="text-center border-r">Sales</TableHead>
              )}
              {(promoterColumnVisibility.closing_quantity || promoterColumnVisibility.closing_rate || promoterColumnVisibility.closing_amount) && (
                <TableHead colSpan={
                  (promoterColumnVisibility.closing_quantity ? 1 : 0) + 
                  (promoterColumnVisibility.closing_rate ? 1 : 0) + 
                  (promoterColumnVisibility.closing_amount ? 1 : 0)
                } className="text-center border-r">Closing</TableHead>
              )}
              {(promoterColumnVisibility.demat || promoterColumnVisibility.non_demat) && (
                <TableHead colSpan={
                  (promoterColumnVisibility.demat ? 1 : 0) + 
                  (promoterColumnVisibility.non_demat ? 1 : 0)
                } className="text-center border-r">Holdings Type</TableHead>
              )}
              {promoterColumnVisibility.market_price && (
                <TableHead rowSpan={2} className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handlePromoterSort('market_price')}>
                  Market Price <SortIndicator field="market_price" sortField={promoterSortField} sortOrder={promoterSortOrder} />
                </TableHead>
              )}
              {promoterColumnVisibility.revaluation_amount && (
                <TableHead rowSpan={2} className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handlePromoterSort('revaluation_amount')}>
                  Revaluation Amount <SortIndicator field="revaluation_amount" sortField={promoterSortField} sortOrder={promoterSortOrder} />
                </TableHead>
              )}
              {promoterColumnVisibility.remarks && (
                <TableHead rowSpan={2} className="text-center">Remarks</TableHead>
              )}
            </TableRow>
            
            <TableRow>
              {promoterColumnVisibility.opening_quantity && (
                <TableHead className="text-center cursor-pointer hover:bg-gray-100" onClick={() => handlePromoterSort('opening_quantity')}>
                  Quantity <SortIndicator field="opening_quantity" sortField={promoterSortField} sortOrder={promoterSortOrder} />
                </TableHead>
              )}
              {promoterColumnVisibility.opening_rate && (
                <TableHead className="text-center cursor-pointer hover:bg-gray-100" onClick={() => handlePromoterSort('opening_rate')}>
                  Rate <SortIndicator field="opening_rate" sortField={promoterSortField} sortOrder={promoterSortOrder} />
                </TableHead>
              )}
              {promoterColumnVisibility.opening_amount && (
                <TableHead className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handlePromoterSort('opening_amount')}>
                  Amount <SortIndicator field="opening_amount" sortField={promoterSortField} sortOrder={promoterSortOrder} />
                </TableHead>
              )}
              {promoterColumnVisibility.purchase_quantity && (
                <TableHead className="text-center cursor-pointer hover:bg-gray-100" onClick={() => handlePromoterSort('purchase_quantity')}>
                  Quantity <SortIndicator field="purchase_quantity" sortField={promoterSortField} sortOrder={promoterSortOrder} />
                </TableHead>
              )}
              {promoterColumnVisibility.purchase_rate && (
                <TableHead className="text-center cursor-pointer hover:bg-gray-100" onClick={() => handlePromoterSort('purchase_rate')}>
                  Rate <SortIndicator field="purchase_rate" sortField={promoterSortField} sortOrder={promoterSortOrder} />
                </TableHead>
              )}
              {promoterColumnVisibility.purchase_amount && (
                <TableHead className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handlePromoterSort('purchase_amount')}>
                  Amount <SortIndicator field="purchase_amount" sortField={promoterSortField} sortOrder={promoterSortOrder} />
                </TableHead>
              )}
              {promoterColumnVisibility.right_quantity && (
                <TableHead className="text-center cursor-pointer hover:bg-gray-100" onClick={() => handlePromoterSort('right_quantity')}>
                  Quantity <SortIndicator field="right_quantity" sortField={promoterSortField} sortOrder={promoterSortOrder} />
                </TableHead>
              )}
              {promoterColumnVisibility.right_total && (
                <TableHead className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handlePromoterSort('right_total')}>
                  Total <SortIndicator field="right_total" sortField={promoterSortField} sortOrder={promoterSortOrder} />
                </TableHead>
              )}
              {promoterColumnVisibility.bonus_quantity && (
                <TableHead className="text-center cursor-pointer hover:bg-gray-100" onClick={() => handlePromoterSort('bonus_quantity')}>
                  Quantity <SortIndicator field="bonus_quantity" sortField={promoterSortField} sortOrder={promoterSortOrder} />
                </TableHead>
              )}
              {promoterColumnVisibility.bonus_book_close_date && (
                <TableHead className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handlePromoterSort('bonus_book_close_date')}>
                  Book Close Date <SortIndicator field="bonus_book_close_date" sortField={promoterSortField} sortOrder={promoterSortOrder} />
                </TableHead>
              )}
              {promoterColumnVisibility.sales_quantity && (
                <TableHead className="text-center cursor-pointer hover:bg-gray-100" onClick={() => handlePromoterSort('sales_quantity')}>
                  Quantity <SortIndicator field="sales_quantity" sortField={promoterSortField} sortOrder={promoterSortOrder} />
                </TableHead>
              )}
              {promoterColumnVisibility.sales_cost && (
                <TableHead className="text-center cursor-pointer hover:bg-gray-100" onClick={() => handlePromoterSort('sales_cost')}>
                  Cost <SortIndicator field="sales_cost" sortField={promoterSortField} sortOrder={promoterSortOrder} />
                </TableHead>
              )}
              {promoterColumnVisibility.sales_amount && (
                <TableHead className="text-center cursor-pointer hover:bg-gray-100" onClick={() => handlePromoterSort('sales_amount')}>
                  Amount <SortIndicator field="sales_amount" sortField={promoterSortField} sortOrder={promoterSortOrder} />
                </TableHead>
              )}
              {promoterColumnVisibility.sales_profit && (
                <TableHead className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handlePromoterSort('sales_profit')}>
                  Profit <SortIndicator field="sales_profit" sortField={promoterSortField} sortOrder={promoterSortOrder} />
                </TableHead>
              )}
              {promoterColumnVisibility.closing_quantity && (
                <TableHead className="text-center cursor-pointer hover:bg-gray-100" onClick={() => handlePromoterSort('closing_quantity')}>
                  Quantity <SortIndicator field="closing_quantity" sortField={promoterSortField} sortOrder={promoterSortOrder} />
                </TableHead>
              )}
              {promoterColumnVisibility.closing_rate && (
                <TableHead className="text-center cursor-pointer hover:bg-gray-100" onClick={() => handlePromoterSort('closing_rate')}>
                  Rate <SortIndicator field="closing_rate" sortField={promoterSortField} sortOrder={promoterSortOrder} />
                </TableHead>
              )}
              {promoterColumnVisibility.closing_amount && (
                <TableHead className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handlePromoterSort('closing_amount')}>
                  Amount <SortIndicator field="closing_amount" sortField={promoterSortField} sortOrder={promoterSortOrder} />
                </TableHead>
              )}
              {promoterColumnVisibility.demat && (
                <TableHead className="text-center cursor-pointer hover:bg-gray-100" onClick={() => handlePromoterSort('demat')}>
                  DEMAT <SortIndicator field="demat" sortField={promoterSortField} sortOrder={promoterSortOrder} />
                </TableHead>
              )}
              {promoterColumnVisibility.non_demat && (
                <TableHead className="text-center border-r cursor-pointer hover:bg-gray-100" onClick={() => handlePromoterSort('non_demat')}>
                  NON-DEMAT <SortIndicator field="non_demat" sortField={promoterSortField} sortOrder={promoterSortOrder} />
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={Object.values(promoterColumnVisibility).filter(Boolean).length} className="text-center py-8">
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
                  {promoterColumnVisibility.company && (
                    <TableCell className="font-medium border-r"><Link href={`/dashboard/stock/${data.code}`} target="_blank">{data.company}</Link></TableCell>
                  )}
                  {promoterColumnVisibility.code && (
                    <TableCell className="text-center border-r"><Link href={`/dashboard/stock/${data.code}`} target="_blank">{data.code}</Link></TableCell>
                  )}
                  {promoterColumnVisibility.category && (
                    <TableCell className="text-center border-r">{data.category}</TableCell>
                  )}
                  {promoterColumnVisibility.opening_quantity && (
                    <TableCell className="text-center">{data.opening_quantity.toLocaleString()}</TableCell>
                  )}
                  {promoterColumnVisibility.opening_rate && (
                    <TableCell className="text-center">Rs. {data.opening_rate.toFixed(2)}</TableCell>
                  )}
                  {promoterColumnVisibility.opening_amount && (
                    <TableCell className="text-center border-r">Rs. {data.opening_amount.toLocaleString()}</TableCell>
                  )}
                  {promoterColumnVisibility.purchase_quantity && (
                    <TableCell className="text-center">{data.purchase_quantity.toLocaleString()}</TableCell>
                  )}
                  {promoterColumnVisibility.purchase_rate && (
                    <TableCell className="text-center">Rs. {data.purchase_rate.toFixed(2)}</TableCell>
                  )}
                  {promoterColumnVisibility.purchase_amount && (
                    <TableCell className="text-center border-r">Rs. {data.purchase_amount.toLocaleString()}</TableCell>
                  )}
                  {promoterColumnVisibility.right_quantity && (
                    <TableCell className="text-center">{data.right_quantity.toLocaleString()}</TableCell>
                  )}
                  {promoterColumnVisibility.right_total && (
                    <TableCell className="text-center border-r">Rs. {data.right_total.toLocaleString()}</TableCell>
                  )}
                  {promoterColumnVisibility.bonus_quantity && (
                    <TableCell className="text-center">{data.bonus_quantity.toLocaleString()}</TableCell>
                  )}
                  {promoterColumnVisibility.bonus_book_close_date && (
                    <TableCell className="text-center border-r">{data.bonus_book_close_date || '-'}</TableCell>
                  )}
                  {promoterColumnVisibility.sales_quantity && (
                    <TableCell className="text-center">{data.sales_quantity.toLocaleString()}</TableCell>
                  )}
                  {promoterColumnVisibility.sales_cost && (
                    <TableCell className="text-center">Rs. {data.sales_cost.toLocaleString()}</TableCell>
                  )}
                  {promoterColumnVisibility.sales_amount && (
                    <TableCell className="text-center">Rs. {data.sales_amount.toLocaleString()}</TableCell>
                  )}
                  {promoterColumnVisibility.sales_profit && (
                    <TableCell className={`text-center border-r ${
                      data.sales_profit >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      Rs. {data.sales_profit.toLocaleString()}
                    </TableCell>
                  )}
                  {promoterColumnVisibility.closing_quantity && (
                    <TableCell className="text-center">{data.closing_quantity.toLocaleString()}</TableCell>
                  )}
                  {promoterColumnVisibility.closing_rate && (
                    <TableCell className="text-center">Rs. {data.closing_rate.toFixed(2)}</TableCell>
                  )}
                  {promoterColumnVisibility.closing_amount && (
                    <TableCell className="text-center border-r">Rs. {data.closing_amount.toLocaleString()}</TableCell>
                  )}
                  {promoterColumnVisibility.demat && (
                    <TableCell className="text-center">{data.demat.toLocaleString()}</TableCell>
                  )}
                  {promoterColumnVisibility.non_demat && (
                    <TableCell className="text-center border-r">{data.non_demat.toLocaleString()}</TableCell>
                  )}
                  {promoterColumnVisibility.market_price && (
                    <TableCell className="text-center border-r font-semibold">Rs. {data.market_price.toFixed(2)}</TableCell>
                  )}
                  {promoterColumnVisibility.revaluation_amount && (
                    <TableCell className="text-center border-r font-semibold">Rs. {(data.closing_quantity * data.market_price).toLocaleString()}</TableCell>
                  )}
                  {promoterColumnVisibility.remarks && (
                    <TableCell className="text-center">
                      <InlineRemarks
                        initial={data.remarks || ''}
                        onSave={async (value) => {
                          if (!fiscalID) return;
                          await saveFYBRemarks({ clientName: currentFund, fiscalYearId: Number(fiscalID), symbol: data.code, remarks: value })
                        }}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={Object.values(promoterColumnVisibility).filter(Boolean).length} className="text-center py-8 text-gray-500">
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
