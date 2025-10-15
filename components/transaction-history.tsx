"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { RefreshCw, Download, TrendingUp, TrendingDown, Coins, ShoppingCart, Receipt, CreditCard, Banknote, Wallet } from "lucide-react"
import * as React from "react"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ChevronDownIcon } from "lucide-react"

import { getHeroDetails, getUsersFor, passFilters } from "@/app/api/transactionHistoryCalls/actions"
import { getUsers } from "@/app/api/dashboardAPICalls/actions"
import { universalExport } from "@/app/api/universalExport/actions"
import { triggerFileDownload } from "@/lib/downloadUtils"
import { Pagination } from "./ui/pagination"
import { toast } from "sonner"

type cbMAP = {
  client_id: string,
  client_name: string,
  client_broker: number,
  recorded_at: Date | null,
}

type transactionData = {
    upload_id: number | null,
    client_id: string,
    symbol: string,
    transaction_type: string,
    quantity: number,
    price: number,
    txn_value: number,
    transaction_date: Date | undefined,
    recorded_at: Date | null,
    client_broker_mapping: cbMAP,
}

type heroContents = {
  fromBuy: {
    txn_value: number,
    expected_commission: number,
  },
  fromSell: {
      txn_value: number,
      profit_loss: number,
  },
  dpAmount: number

}

export default function TransactionHistoryComponent() {

  const [openFromDate, setOpenFromDate] = React.useState(false)
  const [fromDate, setFromDate] = React.useState<Date | undefined>(undefined)
  const [openToDate, setOpenToDate] = React.useState(false)
  const [toDate, setToDate] = React.useState<Date | undefined>(undefined)
  
  // Date preset states
  const [datePreset, setDatePreset] = React.useState<string>('')
  const [showCustomDates, setShowCustomDates] = React.useState(false)

  const [clientName, setclientName] = React.useState<string>('')
  const [clientID, setclientID] = React.useState<string>('')
  const [transactionType, settransactionType] = React.useState<string>('')
  const [clientDetails, setclientDetails] = React.useState<cbMAP[]>([])
  const [selectedclientDetails, setselectedclientDetails] = React.useState<cbMAP[]>([])
  const [symbol, setSymbol] = React.useState<string>('')

  type forExport = {
      name: string,
      t_type: string,
      s_symbol: string,
      start_date: Date | null,
      end_date: Date | null,
}


  const forUsers = async () => {
  const clientNameID: cbMAP[] = await getUsers()
  setclientDetails(clientNameID)
  }

  React.useEffect(() => {
    forUsers();
  }, []);


  const forSelectedUsers= async () => {
  const clientNameID: cbMAP[] = await getUsersFor(clientName)
  setselectedclientDetails(clientNameID)
  }

  React.useEffect(() => {
    forSelectedUsers();
  }, [clientName]);


  function handleNameChange(value: string) {
    setclientName(value)
  }

    function handleIDChange(value: string) {
    setclientID(value)
  }

  function handleTypeChange(value: string) {
    settransactionType(value)
  }

  // Date preset handler
  function handleDatePreset(preset: string) {
    setDatePreset(preset)
    
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)
    
    switch (preset) {
      case 'today':
        setFromDate(startOfDay)
        setToDate(endOfDay)
        setShowCustomDates(false)
        break
      case '3days':
        const threeDaysAgo = new Date(startOfDay)
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 2)
        setFromDate(threeDaysAgo)
        setToDate(endOfDay)
        setShowCustomDates(false)
        break
      case '1month':
        const oneMonthAgo = new Date(startOfDay)
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
        setFromDate(oneMonthAgo)
        setToDate(endOfDay)
        setShowCustomDates(false)
        break
      case '3months':
        const threeMonthsAgo = new Date(startOfDay)
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
        setFromDate(threeMonthsAgo)
        setToDate(endOfDay)
        setShowCustomDates(false)
        break
      case 'custom':
        setShowCustomDates(true)
        break
      default:
        setFromDate(undefined)
        setToDate(undefined)
        setShowCustomDates(false)
    }
  }



  const [transactions, setTransactions] = React.useState<transactionData[]>([])
  const [heroTransactions, setheroTransactions] = React.useState<heroContents>()
  const [isExporting, setIsExporting] = React.useState(false)
  
  // Pagination state
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 10

  async function handleFilters(formData: FormData) {
    const stock_symbol = formData.get('stock') as string
    setSymbol(stock_symbol)

    const sendData = {
      name: clientName,
      c_id: clientID,
      t_type: transactionType,
      s_symbol: stock_symbol, // Using the form value directly instead of the state
      start_date: fromDate,
      end_date: toDate,
    }


    const received: transactionData[] = await passFilters(sendData)
    setTransactions(received)

    const heroContents: heroContents = await getHeroDetails(sendData)
    setheroTransactions(heroContents)
  }

  async function handleExport() {
    try {
      setIsExporting(true)
      
      if (transactions.length === 0) {
        alert('No data to export. Please apply filters first.')
        return
      }
      
      const fileName = `Transaction_History_${new Date().toISOString().split('T')[0]}`
      
      const result = await universalExport({
        fileName,
        data: transactions,
        pageType: 'transaction-history',
        filters: {
          clientName,
          clientId: clientID,
          transactionType,
          symbol,
          startDate: fromDate,
          endDate: toDate,
          datePreset
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

      toast.success('Successfully Exported Transaction History')
      
    } catch (error) {
      console.error('Export error:', error)
      alert('Export failed. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }



  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
      {/* Export Button Section */}
      <div className="flex justify-end items-center mb-6">
        <Button onClick={handleExport} disabled={isExporting} className="bg-blue-600 hover:bg-blue-700">
          <Download className="w-4 h-4 mr-2" />
          {isExporting ? 'Exporting...' : 'Export Data'}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <Card className="bg-white shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-gray-900">Total Buy Amount</CardTitle>
              <div className="p-2 bg-green-100 rounded-lg">
                <ShoppingCart className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-bold text-gray-900 mb-2">
              Rs. {(heroTransactions?.fromBuy.txn_value || 0).toLocaleString()}
            </p>
            <div className="flex items-center text-sm text-green-600">
              <TrendingUp className="w-4 h-4 mr-1" />
              <span>Buy Transactions</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-gray-900">Total Sell Amount</CardTitle>
              <div className="p-2 bg-red-100 rounded-lg">
                <Receipt className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-bold text-gray-900 mb-2">
              Rs. {(heroTransactions?.fromSell.txn_value || 0).toLocaleString()}
            </p>
            <div className="flex items-center text-sm text-red-600">
              <TrendingDown className="w-4 h-4 mr-1" />
              <span>Sell Transactions</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-gray-900">Total Charges</CardTitle>
              <div className="p-2 bg-orange-100 rounded-lg">
                <CreditCard className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-bold text-gray-900 mb-2">
              Rs. {(heroTransactions?.fromBuy.expected_commission || 0).toLocaleString()}
            </p>
            <div className="flex items-center text-sm text-orange-600">
              <span>Brokerage + Fees</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-gray-900">Realised P&L</CardTitle>
              <div className="p-2 bg-purple-100 rounded-lg">
                <Banknote className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className={`text-2xl font-bold mb-2 ${
              (heroTransactions?.fromSell.profit_loss || 0) >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {(heroTransactions?.fromSell.profit_loss || 0) >= 0 ? '+' : ''}Rs. {(heroTransactions?.fromSell.profit_loss || 0).toLocaleString()}
            </p>
            <div className="flex items-center text-sm text-gray-600">
              <Coins className="w-4 h-4 mr-1" />
              <span>Total Profit/Loss</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-gray-900">DP Amount</CardTitle>
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Wallet className="h-5 w-5 text-indigo-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-bold text-gray-900 mb-2">
              Rs. {(heroTransactions?.dpAmount || 0).toLocaleString()}
            </p>
            <div className="flex items-center text-sm text-indigo-600">
              <span>Depository Charges</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Section */}
      <form action={handleFilters} id="applyFilters">
      <Card className="bg-white shadow-sm border border-gray-200 mb-6">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-gray-900">Transaction Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* First Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Select defaultValue="" name="client-name" onValueChange={handleNameChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Client Name" />
                </SelectTrigger>
                <SelectContent>
                    {clientDetails.map((details) => (
                      <SelectGroup key={details.client_id}>
                    <SelectItem value={details.client_name}>{details.client_name}</SelectItem>
                    </SelectGroup>
))
}
                </SelectContent>
              </Select>

              <Select defaultValue="" name="client-id" onValueChange={handleIDChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Client ID" />
                </SelectTrigger>
                <SelectContent>
                    {
                      clientName && (
                        selectedclientDetails.map((details) => (
                          <SelectGroup key={details.client_id}>
                        <SelectItem value={details.client_id}>{details.client_id}</SelectItem>
                        </SelectGroup>
                        ))
                    )
                    }
                </SelectContent>
              </Select>

              <Select defaultValue="" name="transaction-type" onValueChange={handleTypeChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Transaction Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="Buy">Buy</SelectItem>
                    <SelectItem value="Sell">Sell</SelectItem>
                    <SelectItem value="Right">Bonus Shares</SelectItem>
                    <SelectItem value="Bonus">Right Shares</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Input 
                type="text" 
                placeholder="Stock Symbol"
                className="w-full"
                name="stock"
              />
            </div>

            {/* Second Row - Date Presets */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Date Range</Label>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="today" 
                    checked={datePreset === 'today'}
                    onCheckedChange={() => handleDatePreset(datePreset === 'today' ? '' : 'today')}
                  />
                  <Label htmlFor="today" className="cursor-pointer">Today</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="3days" 
                    checked={datePreset === '3days'}
                    onCheckedChange={() => handleDatePreset(datePreset === '3days' ? '' : '3days')}
                  />
                  <Label htmlFor="3days" className="cursor-pointer">Last 3 Days</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="1month" 
                    checked={datePreset === '1month'}
                    onCheckedChange={() => handleDatePreset(datePreset === '1month' ? '' : '1month')}
                  />
                  <Label htmlFor="1month" className="cursor-pointer">Last Month</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="3months" 
                    checked={datePreset === '3months'}
                    onCheckedChange={() => handleDatePreset(datePreset === '3months' ? '' : '3months')}
                  />
                  <Label htmlFor="3months" className="cursor-pointer">Last 3 Months</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="custom" 
                    checked={datePreset === 'custom'}
                    onCheckedChange={() => handleDatePreset(datePreset === 'custom' ? '' : 'custom')}
                  />
                  <Label htmlFor="custom" className="cursor-pointer">Custom Range</Label>
                </div>
              </div>
            </div>

            {/* Third Row - Custom Date Pickers (shown only when Custom is selected) */}
            {showCustomDates && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex flex-col gap-3">
                  <Popover open={openFromDate} onOpenChange={setOpenFromDate}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between font-normal"
                      >
                        {fromDate ? fromDate.toLocaleDateString() : "From Date"}
                        <ChevronDownIcon />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={fromDate}
                        captionLayout="dropdown"
                        onSelect={(date) => {
                          setFromDate(date)
                          setOpenFromDate(false)
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex flex-col gap-3">
                  <Popover open={openToDate} onOpenChange={setOpenToDate}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between font-normal"
                      >
                        {toDate ? toDate.toLocaleDateString() : "To Date"}
                        <ChevronDownIcon />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={toDate}
                        captionLayout="dropdown"
                        onSelect={(date) => {
                          setToDate(date)
                          setOpenToDate(false)
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            {/* Fourth Row - Apply Filters */}
            <div className="flex justify-start">
              <Button type="submit" form="applyFilters">
                <RefreshCw className="w-4 h-4 mr-2" />
                Apply Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      </form>
      {/* Transaction History Table */}
      <Card className="bg-white shadow-sm border border-gray-200 h-fit">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-gray-900">Transaction Details</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold text-gray-900 py-3 px-4">Client & Stock</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3 px-4">Type</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3 px-4 text-right">Total Qty</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3 px-4 text-right">Avg Price</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3 px-4 text-right">Total Value</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3 px-4 text-right">Trades</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3 px-4 text-right">Date Range</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  // First group by date, then by client+stock+type
                  const groupedByDate = transactions.reduce((acc, transaction) => {
                    const dateKey = transaction.transaction_date?.toLocaleDateString() || 'Unknown Date';
                    if (!acc[dateKey]) {
                      acc[dateKey] = {
                        date: transaction.transaction_date,
                        transactions: []
                      };
                    }
                    acc[dateKey].transactions.push(transaction);
                    return acc;
                  }, {} as Record<string, {
                    date: Date | undefined,
                    transactions: typeof transactions
                  }>);

                  // Sort dates in descending order
                  const sortedDates = Object.keys(groupedByDate).sort((a, b) => {
                    const dateA = groupedByDate[a].date;
                    const dateB = groupedByDate[b].date;
                    if (!dateA || !dateB) return 0;
                    return dateB.getTime() - dateA.getTime();
                  });
                  
                  // Apply pagination to sortedDates
                  const totalPages = Math.ceil(sortedDates.length / itemsPerPage)
                  const startIndex = (currentPage - 1) * itemsPerPage
                  const paginatedDates = sortedDates.slice(startIndex, startIndex + itemsPerPage)

                  return paginatedDates.map((dateKey) => {
                    const dateGroup = groupedByDate[dateKey];
                    
                    // Group transactions by client_id + symbol + transaction_type
                    const tradeGroups = dateGroup.transactions.reduce((acc, transaction) => {
                      const groupKey = `${transaction.client_id}_${transaction.symbol}_${transaction.transaction_type}`;
                      
                      if (!acc[groupKey]) {
                        acc[groupKey] = {
                          client_id: transaction.client_id,
                          client_name: transaction.client_broker_mapping.client_name,
                          symbol: transaction.symbol,
                          transaction_type: transaction.transaction_type,
                          transactions: [],
                          totalQuantity: 0,
                          totalValue: 0,
                          weightedPriceSum: 0,
                          earliestDate: transaction.transaction_date,
                          latestDate: transaction.transaction_date
                        };
                      }
                      
                      acc[groupKey].transactions.push(transaction);
                      acc[groupKey].totalQuantity += transaction.quantity;
                      acc[groupKey].totalValue += Number(transaction.txn_value);
                      acc[groupKey].weightedPriceSum += (transaction.price * transaction.quantity);
                      
                      // Update date range
                      if (transaction.transaction_date) {
                        if (!acc[groupKey].earliestDate || transaction.transaction_date < acc[groupKey].earliestDate!) {
                          acc[groupKey].earliestDate = transaction.transaction_date;
                        }
                        if (!acc[groupKey].latestDate || transaction.transaction_date > acc[groupKey].latestDate!) {
                          acc[groupKey].latestDate = transaction.transaction_date;
                        }
                      }
                      
                      return acc;
                    }, {} as Record<string, {
                      client_id: string,
                      client_name: string,
                      symbol: string,
                      transaction_type: string,
                      transactions: typeof transactions,
                      totalQuantity: number,
                      totalValue: number,
                      weightedPriceSum: number,
                      earliestDate: Date | undefined,
                      latestDate: Date | undefined
                    }>);

                    // Calculate totals for date header
                    const dateTotalValue = Object.values(tradeGroups).reduce((sum, group) => sum + group.totalValue, 0);
                    const totalBuyGroups = Object.values(tradeGroups).filter(group => 
                      group.transaction_type === 'BUY' || group.transaction_type === 'Buy'
                    ).length;
                    const totalSellGroups = Object.values(tradeGroups).filter(group => 
                      group.transaction_type === 'SELL' || group.transaction_type === 'Sell'
                    ).length;

                    return (
                      <React.Fragment key={dateKey}>
                        {/* Date Header Row */}
                        <TableRow className="bg-gray-100 border-b-2">
                          <TableCell colSpan={7} className="py-4 px-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="font-semibold text-gray-900">
                                  {dateGroup.date?.toLocaleDateString('en-US', { 
                                    weekday: 'long', 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric' 
                                  })}
                                </div>
                                <div className="flex gap-3 text-sm">
                                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
                                    {totalBuyGroups} Buy Group{totalBuyGroups !== 1 ? 's' : ''}
                                  </span>
                                  <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full font-medium">
                                    {totalSellGroups} Sell Group{totalSellGroups !== 1 ? 's' : ''}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-gray-900">
                                  Total: Rs. {dateTotalValue.toLocaleString()}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {Object.keys(tradeGroups).length} trade group{Object.keys(tradeGroups).length !== 1 ? 's' : ''}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                        
                        {/* Trade Group Rows */}
                        {Object.values(tradeGroups)
                          .sort((a, b) => {
                            // Sort by client name, then symbol, then transaction type
                            const clientCompare = a.client_name.localeCompare(b.client_name);
                            if (clientCompare !== 0) return clientCompare;
                            
                            const symbolCompare = a.symbol.localeCompare(b.symbol);
                            if (symbolCompare !== 0) return symbolCompare;
                            
                            return a.transaction_type.localeCompare(b.transaction_type);
                          })
                          .map((group, index) => {
                            const avgPrice = group.totalQuantity > 0 ? group.weightedPriceSum / group.totalQuantity : 0;
                            const dateRange = group.earliestDate?.toLocaleDateString() === group.latestDate?.toLocaleDateString() 
                              ? group.earliestDate?.toLocaleDateString() 
                              : `${group.earliestDate?.toLocaleDateString()} - ${group.latestDate?.toLocaleDateString()}`;
                            
                            return (
                              <TableRow key={`${dateKey}-${index}`} className="hover:bg-gray-50">
                                <TableCell className="py-3 px-4">
                                  <div>
                                    <div className="font-medium text-gray-900">{group.client_name}</div>
                                    <div className="text-sm text-gray-500">{group.client_id}</div>
                                    <div className="font-mono font-semibold text-blue-600 mt-1">{group.symbol}</div>
                                  </div>
                                </TableCell>
                                <TableCell className="py-3 px-4">
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    (group.transaction_type === 'BUY' || group.transaction_type === 'Buy') 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {group.transaction_type.toUpperCase()}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right font-semibold py-3 px-4">
                                  {group.totalQuantity.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right py-3 px-4">
                                  Rs. {avgPrice.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right font-semibold py-3 px-4">
                                  Rs. {group.totalValue.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right py-3 px-4">
                                  <div className="text-sm">
                                    <div className="font-medium">{group.transactions.length}</div>
                                    <div className="text-xs text-gray-500">trade{group.transactions.length !== 1 ? 's' : ''}</div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right text-xs text-gray-600 py-3 px-4">
                                  {dateRange}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        }
                      </React.Fragment>
                    );
                  });
                })()}
              </TableBody>
            </Table>
          </div>
          {transactions.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(Object.keys(transactions.reduce((acc, transaction) => {
                const dateKey = transaction.transaction_date?.toLocaleDateString() || 'Unknown Date';
                acc[dateKey] = true;
                return acc;
              }, {} as Record<string, boolean>)).length / itemsPerPage)}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              totalItems={Object.keys(transactions.reduce((acc, transaction) => {
                const dateKey = transaction.transaction_date?.toLocaleDateString() || 'Unknown Date';
                acc[dateKey] = true;
                return acc;
              }, {} as Record<string, boolean>)).length}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
