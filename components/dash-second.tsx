"use client"

import {
  Table,
  TableBody,
  TableCell,
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
import { RefreshCw, Download } from "lucide-react"
import { Pagination } from "@/components/ui/pagination"

import { useState, useEffect, useMemo } from "react"
import { getUsers } from "@/app/api/dashboardAPICalls/actions"
import { getFiscal } from "@/app/api/fiscalAPI/actions"
import { getMetricDataTradingFiscal, getMetricDataPromoterFiscal } from "@/app/api/secondDashboardFiscalAPI/actions"
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
}

export default function DashboardTwo() {
  const [initialUser, setInitialUser] = useState<string>("")
  const [getFiscals, setFiscals] = useState<fiscals[]>()
  const [givenUsers, setUsers] = useState<cbMAP[]>([])
  const [fiscalID, setFiscalID] = useState<string>('')
  const [currentFund, setcurrentFund] = useState<string>('')
  const [tradingData, setTradingData] = useState<MetricData[]>([])
  const [promoterData, setPromoterData] = useState<MetricData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isLoadingMain, setisLoadingMain] = useState(true)
  
  // Pagination states for trading table
  const [tradingCurrentPage, setTradingCurrentPage] = useState(1)
  const tradingItemsPerPage = 10
  
  // Pagination states for promoter table
  const [promoterCurrentPage, setPromoterCurrentPage] = useState(1)
  const promoterItemsPerPage = 10

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

  const paginatedTradingData = useMemo(() => {
    const startIndex = (tradingCurrentPage - 1) * tradingItemsPerPage
    const endIndex = startIndex + tradingItemsPerPage
    return consolidatedTradingData.slice(startIndex, endIndex)
  }, [consolidatedTradingData, tradingCurrentPage, tradingItemsPerPage])

  const paginatedPromoterData = useMemo(() => {
    const startIndex = (promoterCurrentPage - 1) * promoterItemsPerPage
    const endIndex = startIndex + promoterItemsPerPage
    return promoterData.slice(startIndex, endIndex)
  }, [promoterData, promoterCurrentPage, promoterItemsPerPage])

  // Calculate total pages
  const tradingTotalPages = Math.ceil(consolidatedTradingData.length / tradingItemsPerPage)
  const promoterTotalPages = Math.ceil(promoterData.length / promoterItemsPerPage)

  const userFetch = async () => {
      const userss: cbMAP[] = await getUsers();
      setUsers(userss);
      const firstUser = userss[0].client_name
      setInitialUser(firstUser)
      setcurrentFund(firstUser)
      const fiscal_years = await getFiscal();
      setFiscals(fiscal_years)
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
      const [tradingResponse, promoterResponse] = await Promise.all([
        getMetricDataTradingFiscal(currentFund, fiscalID),
        getMetricDataPromoterFiscal(currentFund, fiscalID)
      ])
      
      setTradingData(tradingResponse)
      setPromoterData(promoterResponse)
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

  async function handleExport() {
    try {
      setIsExporting(true)
      
      if (tradingData.length === 0 && promoterData.length === 0) {
        alert('No data to export. Please apply filters first.')
        return
      }
      
      const fileName = `Metric_Dashboard_${currentFund}_${fiscalID}_${new Date().toISOString().split('T')[0]}`
      
      // Combine both trading and promoter data
      const combinedData = [
        ...tradingData.map(item => ({ ...item, dataType: 'trading' })),
        ...promoterData.map(item => ({ ...item, dataType: 'promoter' }))
      ]
      
      const result = await universalExport({
        fileName,
        data: combinedData,
        pageType: 'metric-dashboard',
        filters: {
          clientName: currentFund,
          fiscalYear: fiscalID
        }
      })
      
      if (!result.success) {
        alert(`Export failed: ${result.message}`)
        return
      }
      
      // Trigger the download on client side
      if (result.downloadData && result.fileName) {
        triggerFileDownload(result.downloadData, result.fileName)
        console.log('Download triggered successfully')
      } else {
        alert('Export completed but download data is missing')
      }

      toast.success('Export Successfull')
      
    } catch (error) {
      console.error('Export error:', error)
      alert('Export failed. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }
  return (
    isLoadingMain ? (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="animate-spin size-6 mx-auto mb-2" />
      </div>
    ) : (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
      {/* Fiscal Year Display Section */}
      {fiscalID && currentFund && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <span className="text-blue-600 font-bold text-lg">
                  FY {getFiscals?.find(f => f.fiscal_year_id.toString() === fiscalID)?.year_label}
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  Metrics for Fiscal Year: {getFiscals?.find(f => f.fiscal_year_id.toString() === fiscalID)?.year_label}
                </h3>
                <p className="text-sm text-gray-600">
                  Fund: {currentFund} | Data: {consolidatedTradingData.length} Trading + {promoterData.length} Promoter Securities
                </p>
              </div>
            </div>
            <Button onClick={handleExport} disabled={isExporting || (tradingData.length === 0 && promoterData.length === 0)} className="bg-blue-600 hover:bg-blue-700">
              <Download className="w-4 h-4 mr-2" />
              {isExporting ? 'Exporting...' : 'Export Data'}
            </Button>
          </div>
        </div>
      )}
      
      <Card className="bg-white shadow-sm border border-gray-200 mb-6">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-gray-900">Metric Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
    
                <Select defaultValue={initialUser} onValueChange={handleFundChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Fund" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Fund Category</SelectLabel>
                    {givenUsers.map((details) => (
                      <SelectItem key={details.client_id} value={details.client_name}>
                        {details.client_name}
                      </SelectItem>
                    ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
    
                  <Select onValueChange={handleFiscalChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Fiscal Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {getFiscals?.map((details) => (
    
                    <SelectGroup key={details.fiscal_year_id}>
                      <SelectItem value={String(details.fiscal_year_id)}>{details.year_label}</SelectItem>
                    </SelectGroup>
                    ))
    }
                  </SelectContent>
                </Select>
    
                <Button className="w-full" onClick={handleFilters} disabled={isLoading}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  {isLoading ? 'Loading...' : 'Apply'}
                </Button>
              </div>
            </CardContent>
    
    
          </Card>
    {/* Held for Trading Table */}
    <Card className="bg-white shadow-sm border border-gray-200 mb-6">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-gray-900">Held for Trading Securities</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
      
      <div className="overflow-x-auto">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow>
              <TableHead rowSpan={2} className="text-center border-r">Company</TableHead>
              <TableHead rowSpan={2} className="text-center border-r">Code</TableHead>
              <TableHead rowSpan={2} className="text-center border-r">Category</TableHead>
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
            ) : consolidatedTradingData.length > 0 ? (
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
        </Table>
      </div>
      
      {/* Trading Table Pagination */}
      {consolidatedTradingData.length > tradingItemsPerPage && (
        <Pagination
          currentPage={tradingCurrentPage}
          totalPages={tradingTotalPages}
          onPageChange={handleTradingPageChange}
          itemsPerPage={tradingItemsPerPage}
          totalItems={consolidatedTradingData.length}
        />
      )}
      </CardContent>
    </Card>
    
    {/* Promoter Shares Table */}
    <Card className="bg-white shadow-sm border border-gray-200 mb-6">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-gray-900">Promoter Shares (Held for Maturity)</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
      
      <div className="overflow-x-auto">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow>
              <TableHead rowSpan={2} className="text-center border-r">Company</TableHead>
              <TableHead rowSpan={2} className="text-center border-r">Code</TableHead>
              <TableHead rowSpan={2} className="text-center border-r">Category</TableHead>
              <TableHead colSpan={3} className="text-center border-r">Opening</TableHead>
              <TableHead colSpan={3} className="text-center border-r">Closing</TableHead>
              <TableHead rowSpan={2} className="text-center border-r">Market Price</TableHead>
              <TableHead rowSpan={2} className="text-center border-r">Unrealised Amount</TableHead>
              <TableHead rowSpan={2} className="text-center border-r">Today %</TableHead>
              <TableHead rowSpan={2} className="text-center">Remarks</TableHead>
            </TableRow>
            
            <TableRow>
              <TableHead className="text-center">Quantity</TableHead>
              <TableHead className="text-center">Rate</TableHead>
              <TableHead className="text-center border-r">Amount</TableHead>
              <TableHead className="text-center">Quantity</TableHead>
              <TableHead className="text-center">Rate</TableHead>
              <TableHead className="text-center border-r">Amount</TableHead>
            </TableRow>
          </TableHeader>
          
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8">
                  Loading promoter data...
                </TableCell>
              </TableRow>
            ) : promoterData.length > 0 ? (
              paginatedPromoterData.map((data, index) => (
                <TableRow key={`promoter-${data.code}-${index}`}>
                  <TableCell className="font-medium border-r"><Link href={`/dashboard/stock/${data.code}`} target="_blank">{data.company}</Link></TableCell>
                  <TableCell className="text-center border-r"><Link href={`/dashboard/stock/${data.code}`} target="_blank">{data.code}</Link></TableCell>
                  <TableCell className="text-center border-r">{data.category}</TableCell>
                  <TableCell className="text-center">{data.opening_quantity.toLocaleString()}</TableCell>
                  <TableCell className="text-center">Rs. {data.opening_rate.toFixed(2)}</TableCell>
                  <TableCell className="text-center border-r">Rs. {data.opening_amount.toLocaleString()}</TableCell>
                  <TableCell className="text-center">{data.closing_quantity.toLocaleString()}</TableCell>
                  <TableCell className="text-center">Rs. {data.closing_rate.toFixed(2)}</TableCell>
                  <TableCell className="text-center border-r">Rs. {data.closing_amount.toLocaleString()}</TableCell>
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
                        await savePromoterRemarks({ clientName: currentFund, fiscalYearId: Number(fiscalID), symbol: data.code, remarks: value })
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8 text-gray-500">
                  No promoter shares found. Please apply filters to load data.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* Promoter Table Pagination */}
      {promoterData.length > promoterItemsPerPage && (
        <Pagination
          currentPage={promoterCurrentPage}
          totalPages={promoterTotalPages}
          onPageChange={handlePromoterPageChange}
          itemsPerPage={promoterItemsPerPage}
          totalItems={promoterData.length}
        />
      )}
      </CardContent>
    </Card>
    </div>
    )
  )
}
