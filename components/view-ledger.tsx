"use client"

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
  SelectValue,
} from "@/components/ui/select"


import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter
} from "@/components/ui/table"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RefreshCw, Download, Search, X, Settings } from "lucide-react"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { useState, useEffect, useMemo } from "react"
import { getCurrentSessionUser, getUsers } from "@/app/api/dashboardAPICalls/actions"
import { getFiscal } from "@/app/api/fiscalAPI/actions"
import { filterDataGrouped, getSymbolHoldingsEffectiveRate } from "@/app/api/ledgerPageCalls/actions"
import { universalExport } from "@/app/api/universalExport/actions"
import { triggerFileDownload } from "@/lib/downloadUtils"
import { toast } from "sonner"
import InlineRemarks from "@/components/ui/inline-remarks"
import { saveEligibleRemarks, saveCloseoutRemarks } from "@/app/api/remarks/actions"
import { PromoterDialog } from "@/components/dialogs/promoter-dialog"
import { BonusDialog } from "@/components/dialogs/bonus-dialog"
import { RightDialog } from "@/components/dialogs/right-dialog"
import { CashDialog } from "@/components/dialogs/cash-dialog"
import { CloseoutDialog } from "@/components/dialogs/closeout-dialog"
import { IPOAllotmentDialog } from "@/components/dialogs/ipo-allotment-dialog"
import { Pagination } from "@/components/ui/pagination"

// Type Definitions
interface PurchaseRecord {
  fund_id: number
  client_id: string
  symbol: string
  quantity: number
  price: number
  txn_value: number
  commission_rate: string | null
  commission_amount: number | null
  sebon_commission: number | null
  effective_rate: number | null
  net_payable: number | null
  transaction_date: Date | null
  contract_number: string
  fiscal_year_id: number | null
  is_closeout?: boolean
}

interface SalesRecord {
  fund_id: number
  client_id: string
  symbol: string
  quantity: number
  price: number
  txn_value: number
  commission_rate: string | null
  commission_amount: number | null
  capital_gain_tax: number | null
  sebon_commission: number | null
  effective_rate: number | null
  net_receivable: number | null
  profit_loss: number | null
  transaction_date: Date | null
  approx_profit_loss: number
  contract_number: string
  fiscal_year_id: number | null
}

interface OpeningRecord {
  opening_quantity: number
  effective_rate: number
  total_value: number
}

type OpeningRecords = OpeningRecord[]

interface EligibleRecord {
  opening_quantity: number
  effective_rate: number
  total_value: number
  record_type: 'opening' | 'bonus' | 'rights' | 'promoter' | 'ipo_allotment' | 'ipo_allotment_staging'
  id: string
  date: Date | null
  client_id: string
  remarks?: string
  symbol?: string
  previous_fiscal_year_id?: number
  bonus_percent?: number
  right_ratio?: string
  bonus_id?: number
  right_id?: number
  promoter_id?: number
  allotment_id?: number
  staging_id?: number
  sub_id?: number
  demat?: number
  non_demat?: number
}

interface LedgerTotals {
  purchase: {
    totalQuantity: number
    totalTxnValue: number
    totalCommissionAmount: number
    totalSebonCommission: number
    totalNetPayable: number
  }
  sales: {
    totalQuantity: number
    totalTxnValue: number
    totalCommissionAmount: number
    totalCapitalGainTax: number
    totalSebonCommission: number
    totalNetReceivable: number
    totalProfitLoss: number
  }
  opening: {
    totalOpeningQuantity?: number
    totalValue?: number
    totalEligibleQuantity?: number
    totalEligibleValue?: number
  }
  eligible?: {
    totalEligibleQuantity: number
    totalEligibleValue: number
  }
}

interface OverallLedgerData {
  purchased_sanitized: PurchaseRecord[]
  sales_sanitized: SalesRecord[]
  opening_sanitized: OpeningRecords
  eligible_sanitized: EligibleRecord[]
  totals: LedgerTotals
}

interface ClientMapping {
  client_id: string
  client_name: string
  client_broker: number
  recorded_at: Date | null
}

interface FiscalYear {
  fiscal_year_id: number
  year_label: string
  start_date: Date
  end_date: Date
}

// Constants
const INITIAL_STATE = {
  SYMBOL: '',
  FISCAL_ID: '',
  FUND: '',
  EFFECTIVE_RATE: 0,
  LOADING: true as boolean,
  EXPORTING: false as boolean,
  RATE_LOADING: false as boolean
}

const MESSAGES = {
  NO_DATA: 'No data to export. Please apply filters first.',
  EXPORT_SUCCESS: 'Successfully Exported Ledger',
  EXPORT_FAILED: 'Export failed. Please try again.',
  DOWNLOAD_MISSING: 'Export completed but download data is missing'
} as const

const TABLE_STYLES = {
  HEADER: 'font-semibold text-gray-900 py-3 px-4',
  CELL: 'py-3 px-4',
  ROW_HOVER: 'hover:bg-gray-50',
  FOOTER: 'bg-gray-100',
  PROFIT: 'text-green-600',
  LOSS: 'text-red-600',
  CLOSEOUT: 'bg-red-50 text-red-700',
  CLOSEOUT_ROW: 'hover:bg-red-100'
} as const

export default function ViewLedger() {
  // State Management
  const [currentUser, setCurrentUser] = useState<string>('')
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([])
  const [users, setUsers] = useState<ClientMapping[]>([])
  const [symbol, setSymbol] = useState<string>(INITIAL_STATE.SYMBOL)
  const [fiscalID, setFiscalID] = useState<string>(INITIAL_STATE.FISCAL_ID)
  const [currentFund, setCurrentFund] = useState<string>(INITIAL_STATE.FUND)
  const [ledgerData, setLedgerData] = useState<OverallLedgerData | undefined>(undefined)
  const [isExporting, setIsExporting] = useState(INITIAL_STATE.EXPORTING)
  const [effectiveRate, setEffectiveRate] = useState<number>(INITIAL_STATE.EFFECTIVE_RATE)
  const [waccTaxBase, setWaccTaxBase] = useState<number>(0)
  const [effectiveRateLoading, setEffectiveRateLoading] = useState(INITIAL_STATE.RATE_LOADING)
  const [isLoadingMain, setIsLoadingMain] = useState(INITIAL_STATE.LOADING)
  const [isAdmin, setIsAdmin] = useState<boolean | null>()

  // Pagination and sorting states for Purchase Records
  const [purchasePage, setPurchasePage] = useState(1)
  const [purchaseItemsPerPage, setPurchaseItemsPerPage] = useState(10)
  const [purchaseSortField, setPurchaseSortField] = useState<string | null>(null)
  const [purchaseSortOrder, setPurchaseSortOrder] = useState<'asc' | 'desc'>('asc')

  // Pagination and sorting states for Eligible Records
  const [eligiblePage, setEligiblePage] = useState(1)
  const [eligibleItemsPerPage, setEligibleItemsPerPage] = useState(10)
  const [eligibleSortField, setEligibleSortField] = useState<string | null>(null)
  const [eligibleSortOrder, setEligibleSortOrder] = useState<'asc' | 'desc'>('asc')

  // Pagination and sorting states for Sales Records
  const [salesPage, setSalesPage] = useState(1)
  const [salesItemsPerPage, setSalesItemsPerPage] = useState(10)
  const [salesSortField, setSalesSortField] = useState<string | null>(null)
  const [salesSortOrder, setSalesSortOrder] = useState<'asc' | 'desc'>('asc')

  // Search and column visibility states for Purchase Records
  const [purchaseSearchTerm, setPurchaseSearchTerm] = useState<string>("")
  const [purchaseColumnVisibility, setPurchaseColumnVisibility] = useState({
    date: true,
    quantity: true,
    rate: true,
    amount: true,
    commission: true,
    netAmount: true,
    remarks: true
  })

  // Search and column visibility states for Eligible Records
  const [eligibleSearchTerm, setEligibleSearchTerm] = useState<string>("")
  const [eligibleColumnVisibility, setEligibleColumnVisibility] = useState({
    date: true,
    quantity: true,
    rate: true,
    amount: true,
    type: true,
    remarks: true
  })

  // Search and column visibility states for Sales Records
  const [salesSearchTerm, setSalesSearchTerm] = useState<string>("")
  const [salesColumnVisibility, setSalesColumnVisibility] = useState({
    date: true,
    quantity: true,
    rate: true,
    amount: true,
    commission: true,
    netAmount: true,
    profitLoss: true,
    remarks: true
  })

  // Derived: Cost Price = (Eligible Amount + Purchase Total Cost) / (Eligible Shares + Purchase Shares)
  const costPrice = useMemo(() => {
    if (!ledgerData || !ledgerData.totals) return 0
    const eligibleQty = (ledgerData.totals.eligible?.totalEligibleQuantity ?? ledgerData.totals.opening?.totalEligibleQuantity ?? 0) || 0
    const eligibleAmount = (ledgerData.totals.eligible?.totalEligibleValue ?? ledgerData.totals.opening?.totalEligibleValue ?? 0) || 0

    const purchaseQty = ledgerData.totals.purchase?.totalQuantity ?? 0
    const purchaseCost = Number(ledgerData.totals.purchase?.totalNetPayable ?? 0)

    const totalQty = (eligibleQty || 0) + (purchaseQty || 0)
    const totalCost = Number(eligibleAmount || 0) + Number(purchaseCost || 0)

    if (totalQty <= 0) return 0
    return totalCost / totalQty
  }, [ledgerData])

  // Total Quantity = Eligible Quantity + Purchase Quantity - Sales Quantity
  const totalQuantity = useMemo(() => {
    if (!ledgerData || !ledgerData.totals) return 0
    const eligibleQty = (ledgerData.totals.eligible?.totalEligibleQuantity ?? ledgerData.totals.opening?.totalEligibleQuantity ?? 0) || 0
    const purchaseQty = ledgerData.totals.purchase?.totalQuantity ?? 0
    const salesQty = ledgerData.totals.sales?.totalQuantity ?? 0
    return (eligibleQty + purchaseQty) - salesQty
  }, [ledgerData])

  // Total Cost = Cost Price × Total Quantity
  const totalCost = useMemo(() => {
    return costPrice * totalQuantity
  }, [costPrice, totalQuantity])

  // Event Handlers
  const handleFundChange = (value: string) => {
    setCurrentFund(value)
  }

  const handleFiscalChange = (value: string) => {
    setFiscalID(value)
  }

  const handleSymbolChange = (value: string) => {
    setSymbol(value.toUpperCase())
  }

  const fetchEffectiveRate = async (symbolValue: string, fundValue: string) => {
    if (!symbolValue || !fundValue) return
    
    setEffectiveRateLoading(true)
    try {
      const rateData = await getSymbolHoldingsEffectiveRate(symbolValue, fundValue)
      setEffectiveRate(rateData.success ? rateData.effective_rate : INITIAL_STATE.EFFECTIVE_RATE)
      setWaccTaxBase(rateData.success ? (rateData.wacc_tax_base || 0) : 0)
    } catch (error) {
      console.error('Error fetching effective rate:', error)
      setEffectiveRate(INITIAL_STATE.EFFECTIVE_RATE)
      setWaccTaxBase(0)
    } finally {
      setEffectiveRateLoading(false)
    }
  }

  const handleFilters = async () => {
    if (!symbol || !fiscalID || !currentFund) {
      toast.error('Please fill in all filter fields')
      return
    }

    try {
      const data = await filterDataGrouped(symbol, fiscalID, currentFund) as OverallLedgerData
      setLedgerData(data)
      await fetchEffectiveRate(symbol, currentFund)
    } catch (error) {
      console.error('Error fetching ledger data:', error)
      toast.error('Failed to fetch ledger data')
    }
  }

  const validateExportData = (data: OverallLedgerData | undefined): boolean => {
    return !(
      !data ||
      (data.purchased_sanitized.length === 0 &&
        data.sales_sanitized.length === 0 &&
        (!data.eligible_sanitized || data.eligible_sanitized.length === 0))
    )
  }

  const handleExport = async () => {
    if (!validateExportData(ledgerData)) {
      toast.error(MESSAGES.NO_DATA)
      return
    }

    setIsExporting(true)
    
    try {
      const fileName = `Ledger_${symbol}_${currentFund}_${fiscalID}_${new Date().toISOString().split('T')[0]}`
      
      const combinedData = [
        ...ledgerData!.purchased_sanitized.map(item => ({ ...item, recordType: 'purchase' })),
        ...ledgerData!.sales_sanitized.map(item => ({ ...item, recordType: 'sales' })),
        ...(ledgerData!.eligible_sanitized || []).map(item => ({ ...item, recordType: 'eligible' }))
      ]
      
      const result = await universalExport({
        fileName,
        data: combinedData,
        pageType: 'view-ledger',
        filters: { symbol, clientName: currentFund, fiscalYear: fiscalID }
      })
      
      if (!result.success) {
        toast.error(`Export failed: ${result.message}`)
        return
      }
      
      if (result.downloadData && result.fileName) {
        triggerFileDownload(result.downloadData, result.fileName)
        toast.success(MESSAGES.EXPORT_SUCCESS)
      } else {
        toast.error(MESSAGES.DOWNLOAD_MISSING)
      }
    } catch (error) {
      console.error('Export error:', error)
      toast.error(MESSAGES.EXPORT_FAILED)
    } finally {
      setIsExporting(false)
    }
  }

  const initializeData = async () => {
    try {
      const [usersData, fiscalData] = await Promise.all([
        getUsers(),
        getFiscal()
      ])
      
      setUsers(usersData)
      setFiscalYears(fiscalData)

      const userPermission = await getCurrentSessionUser()
      setIsAdmin(userPermission)
      
      if (usersData.length > 0) {
        const firstUser = usersData[0].client_name
        setCurrentUser(firstUser)
        setCurrentFund(firstUser)
      }

      // Auto-select current fiscal year
      if (fiscalData.length > 0) {
        const today = new Date()
        const currentFiscalYear = fiscalData.find(fiscal => {
          const startDate = new Date(fiscal.start_date)
          const endDate = new Date(fiscal.end_date)
          return today >= startDate && today <= endDate
        })
        
        if (currentFiscalYear) {
          setFiscalID(currentFiscalYear.fiscal_year_id.toString())
        } else {
          // If no current fiscal year found, select the most recent one
          const sortedFiscal = fiscalData.sort((a, b) => 
            new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
          )
          setFiscalID(sortedFiscal[0].fiscal_year_id.toString())
        }
      }
    } catch (error) {
      console.error('Error initializing data:', error)
      toast.error('Failed to load initial data')
    } finally {
      setIsLoadingMain(false)
    }
  }

  useEffect(() => {
    initializeData()
  }, [])

  // Helper function to render sort indicator
  const SortIndicator = ({ field, tableSortField, tableSortOrder }: { field: string, tableSortField: string | null, tableSortOrder: 'asc' | 'desc' }) => {
    if (tableSortField !== field) return <span className="text-gray-400 text-xs ml-1">⇅</span>;
    return tableSortOrder === 'asc' ? <span className="text-blue-600 ml-1">↑</span> : <span className="text-blue-600 ml-1">↓</span>;
  };

  // Handle column header click for sorting - Purchase
  const handlePurchaseHeaderClick = (field: string) => {
    if (purchaseSortField === field) {
      setPurchaseSortOrder(purchaseSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setPurchaseSortField(field);
      setPurchaseSortOrder('asc');
    }
    setPurchasePage(1);
  };

  // Handle column header click for sorting - Eligible
  const handleEligibleHeaderClick = (field: string) => {
    if (eligibleSortField === field) {
      setEligibleSortOrder(eligibleSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setEligibleSortField(field);
      setEligibleSortOrder('asc');
    }
    setEligiblePage(1);
  };

  // Handle column header click for sorting - Sales
  const handleSalesHeaderClick = (field: string) => {
    if (salesSortField === field) {
      setSalesSortOrder(salesSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSalesSortField(field);
      setSalesSortOrder('asc');
    }
    setSalesPage(1);
  };

  // Process and sort Purchase Records
  const processedPurchaseData = useMemo(() => {
    if (!ledgerData?.purchased_sanitized) return [];
    let data = [...ledgerData.purchased_sanitized];
    
    if (purchaseSortField) {
      data.sort((a, b) => {
        const aValue = a[purchaseSortField as keyof PurchaseRecord];
        const bValue = b[purchaseSortField as keyof PurchaseRecord];
        
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return purchaseSortOrder === 'asc' ? 1 : -1;
        if (bValue == null) return purchaseSortOrder === 'asc' ? -1 : 1;
        
        if (aValue instanceof Date && bValue instanceof Date) {
          return purchaseSortOrder === 'asc' 
            ? aValue.getTime() - bValue.getTime()
            : bValue.getTime() - aValue.getTime();
        }
        
        if (typeof aValue === 'string') {
          return purchaseSortOrder === 'asc' 
            ? aValue.localeCompare(bValue as string)
            : (bValue as string).localeCompare(aValue);
        }
        
        if (typeof aValue === 'number') {
          return purchaseSortOrder === 'asc' 
            ? (aValue as number) - (bValue as number)
            : (bValue as number) - (aValue as number);
        }
        
        return 0;
      });
    }
    
    return data;
  }, [ledgerData?.purchased_sanitized, purchaseSortField, purchaseSortOrder]);

  // Paginated Purchase Records
  const paginatedPurchaseData = useMemo(() => {
    const startIndex = (purchasePage - 1) * purchaseItemsPerPage;
    return processedPurchaseData.slice(startIndex, startIndex + purchaseItemsPerPage);
  }, [processedPurchaseData, purchasePage, purchaseItemsPerPage]);

  const purchaseTotalPages = Math.ceil(processedPurchaseData.length / purchaseItemsPerPage);
  const purchaseTotalItems = processedPurchaseData.length;

  // Process and sort Eligible Records
  const processedEligibleData = useMemo(() => {
    if (!ledgerData?.eligible_sanitized) return [];
    let data = [...ledgerData.eligible_sanitized];
    
    if (eligibleSortField) {
      data.sort((a, b) => {
        const aValue = a[eligibleSortField as keyof EligibleRecord];
        const bValue = b[eligibleSortField as keyof EligibleRecord];
        
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return eligibleSortOrder === 'asc' ? 1 : -1;
        if (bValue == null) return eligibleSortOrder === 'asc' ? -1 : 1;
        
        if (aValue instanceof Date && bValue instanceof Date) {
          return eligibleSortOrder === 'asc' 
            ? aValue.getTime() - bValue.getTime()
            : bValue.getTime() - aValue.getTime();
        }
        
        if (typeof aValue === 'string') {
          return eligibleSortOrder === 'asc' 
            ? aValue.localeCompare(bValue as string)
            : (bValue as string).localeCompare(aValue);
        }
        
        if (typeof aValue === 'number') {
          return eligibleSortOrder === 'asc' 
            ? (aValue as number) - (bValue as number)
            : (bValue as number) - (aValue as number);
        }
        
        return 0;
      });
    }
    
    return data;
  }, [ledgerData?.eligible_sanitized, eligibleSortField, eligibleSortOrder]);

  // Paginated Eligible Records
  const paginatedEligibleData = useMemo(() => {
    const startIndex = (eligiblePage - 1) * eligibleItemsPerPage;
    return processedEligibleData.slice(startIndex, startIndex + eligibleItemsPerPage);
  }, [processedEligibleData, eligiblePage, eligibleItemsPerPage]);

  const eligibleTotalPages = Math.ceil(processedEligibleData.length / eligibleItemsPerPage);
  const eligibleTotalItems = processedEligibleData.length;

  // Process and sort Sales Records
  const processedSalesData = useMemo(() => {
    if (!ledgerData?.sales_sanitized) return [];
    let data = [...ledgerData.sales_sanitized];
    
    if (salesSortField) {
      data.sort((a, b) => {
        const aValue = a[salesSortField as keyof SalesRecord];
        const bValue = b[salesSortField as keyof SalesRecord];
        
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return salesSortOrder === 'asc' ? 1 : -1;
        if (bValue == null) return salesSortOrder === 'asc' ? -1 : 1;
        
        if (aValue instanceof Date && bValue instanceof Date) {
          return salesSortOrder === 'asc' 
            ? aValue.getTime() - bValue.getTime()
            : bValue.getTime() - aValue.getTime();
        }
        
        if (typeof aValue === 'string') {
          return salesSortOrder === 'asc' 
            ? aValue.localeCompare(bValue as string)
            : (bValue as string).localeCompare(aValue);
        }
        
        if (typeof aValue === 'number') {
          return salesSortOrder === 'asc' 
            ? (aValue as number) - (bValue as number)
            : (bValue as number) - (aValue as number);
        }
        
        return 0;
      });
    }
    
    return data;
  }, [ledgerData?.sales_sanitized, salesSortField, salesSortOrder]);

  // Paginated Sales Records
  const paginatedSalesData = useMemo(() => {
    const startIndex = (salesPage - 1) * salesItemsPerPage;
    return processedSalesData.slice(startIndex, startIndex + salesItemsPerPage);
  }, [processedSalesData, salesPage, salesItemsPerPage]);

  const salesTotalPages = Math.ceil(processedSalesData.length / salesItemsPerPage);
  const salesTotalItems = processedSalesData.length;

  // Reset pagination when filters change
  useEffect(() => {
    setPurchasePage(1);
    setEligiblePage(1);
    setSalesPage(1);
  }, [symbol, fiscalID, currentFund]);

  // Process and filter data for each table
  const filteredPurchaseRecords = useMemo(() => {
    if (!ledgerData?.purchased_sanitized) return [];
    let filtered = [...ledgerData.purchased_sanitized];
    
    // Apply search filtering
    if (purchaseSearchTerm.trim()) {
      filtered = filtered.filter((record) =>
        JSON.stringify(record).toLowerCase().includes(purchaseSearchTerm.toLowerCase())
      );
    }
    
    return filtered;
  }, [ledgerData?.purchased_sanitized, purchaseSearchTerm]);

  const filteredEligibleRecords = useMemo(() => {
    if (!ledgerData?.eligible_sanitized) return [];
    let filtered = [...ledgerData.eligible_sanitized];
    
    // Apply search filtering
    if (eligibleSearchTerm.trim()) {
      filtered = filtered.filter((record) =>
        JSON.stringify(record).toLowerCase().includes(eligibleSearchTerm.toLowerCase())
      );
    }
    
    return filtered;
  }, [ledgerData?.eligible_sanitized, eligibleSearchTerm]);

  const filteredSalesRecords = useMemo(() => {
    if (!ledgerData?.sales_sanitized) return [];
    let filtered = [...ledgerData.sales_sanitized];
    
    // Apply search filtering
    if (salesSearchTerm.trim()) {
      filtered = filtered.filter((record) =>
        record.transaction_date?.toString().toLowerCase().includes(salesSearchTerm.toLowerCase()) ||
        JSON.stringify(record).toLowerCase().includes(salesSearchTerm.toLowerCase())
      );
    }
    
    return filtered;
  }, [ledgerData?.sales_sanitized, salesSearchTerm]);

  return (
    isLoadingMain ? (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="animate-spin size-6 mx-auto mb-2" />
      </div>
    ) : (
    <div>
      {/* Filtered Symbol Display Section */}
      {symbol && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <span className="text-blue-600 font-mono font-bold text-lg">{symbol}</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Viewing Ledger for: {symbol}</h3>
                <p className="text-sm text-gray-600">
                  Fund: {currentFund || 'Not selected'} | 
                  Fiscal Year: {fiscalYears.find(f => f.fiscal_year_id.toString() === fiscalID)?.year_label || 'Not selected'}
                </p>
              </div>
              
              {/* Cost Price Display */}
              <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm ml-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Cost Price</div>
                <div className="flex items-center justify-center">
                  <span className="text-lg font-bold text-gray-900">
                    <mark> Rs. {costPrice > 0 ? costPrice.toFixed(2) : 'N/A'} </mark>
                  </span>
                </div>
              </div>

              {/* Quantity Display */}
              <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm ml-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Quantity</div>
                <div className="flex items-center justify-center">
                  <span className="text-lg font-bold text-gray-900">
                    <mark> {totalQuantity > 0 ? totalQuantity.toLocaleString() : 'N/A'} </mark>
                  </span>
                </div>
              </div>

              {/* Total Cost Display */}
              <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm ml-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Total Cost</div>
                <div className="flex items-center justify-center">
                  <span className="text-lg font-bold text-gray-900">
                    <mark> Rs. {totalCost > 0 ? totalCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : 'N/A'} </mark>
                  </span>
                </div>
              </div>
            </div>
            
            <Button onClick={handleExport} disabled={isExporting} className="bg-blue-600 hover:bg-blue-700">
              <Download className="w-4 h-4 mr-2" />
              {isExporting ? 'Exporting...' : 'Export Data'}
            </Button>
          </div>
        </div>
      )}

      {/* Manual Stock Entry Buttons */}
      {isAdmin && 
      <Card className="bg-white shadow-sm border border-gray-200 mb-6">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-gray-900">Manual Stock Entry</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <PromoterDialog onSuccess={() => handleFilters()} />
            <BonusDialog onSuccess={() => handleFilters()} />
            <RightDialog onSuccess={() => handleFilters()} />
            <CashDialog onSuccess={() => handleFilters()} />
            <CloseoutDialog onSuccess={() => handleFilters()} />
            <IPOAllotmentDialog onSuccess={() => handleFilters()} />
          </div>
        </CardContent>
      </Card>
}

      {/* Filters Section */}
      <Card className="bg-white shadow-sm border border-gray-200 mb-6">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-gray-900">Ledger Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">

            <Input 
              type="text" 
              placeholder="Stock Symbol"
              className="w-full"
              value={symbol}
              onChange={(e) => handleSymbolChange(e.target.value)}
            />

            <Select defaultValue={currentUser} onValueChange={handleFundChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Fund" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectGroup key={user.client_id}>
                    <SelectItem value={user.client_name}>{user.client_name}</SelectItem>
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>

              <Select onValueChange={handleFiscalChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Fiscal Year" />
              </SelectTrigger>
              <SelectContent>
                {fiscalYears.map((fiscal) => (
                  <SelectGroup key={fiscal.fiscal_year_id}>
                    <SelectItem value={String(fiscal.fiscal_year_id)}>{fiscal.year_label}</SelectItem>
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>

            <Button className="w-full" onClick={handleFilters}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Apply
            </Button>
          </div>
        </CardContent>


      </Card>
        <Card className="bg-white shadow-lg border border-gray-100 mb-6" style={{boxShadow: 'inset 0 2px 4px -1px rgba(34, 197, 94, 0.1)'}}>
          <CardHeader className="pb-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                <div>
                  <CardTitle className="text-xl font-bold text-gray-900">Purchase Records</CardTitle>
                  <p className="text-sm text-gray-600 mt-1">Purchase transactions and closeout records</p>
                </div>
                {filteredPurchaseRecords.length > 0 && (
                  <span className="ml-4 text-sm text-gray-500">({filteredPurchaseRecords.length} records)</span>
                )}
              </div>
            </div>
            
            {/* Search and Column Controls for Purchase */}
            <div className="flex items-center gap-3 mb-4">
              {/* Search Input */}
              <div className="relative flex-1 max-w-lg">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by date or remarks..."
                  value={purchaseSearchTerm}
                  onChange={(e) => setPurchaseSearchTerm(e.target.value)}
                  className="pl-10 pr-10 border-gray-200 focus:border-green-300"
                />
                {purchaseSearchTerm && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPurchaseSearchTerm("")}
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
                    checked={purchaseColumnVisibility.date}
                    onCheckedChange={(checked) => 
                      setPurchaseColumnVisibility(prev => ({ ...prev, date: checked }))
                    }
                  >
                    Date
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={purchaseColumnVisibility.quantity}
                    onCheckedChange={(checked) => 
                      setPurchaseColumnVisibility(prev => ({ ...prev, quantity: checked }))
                    }
                  >
                    Quantity
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={purchaseColumnVisibility.rate}
                    onCheckedChange={(checked) => 
                      setPurchaseColumnVisibility(prev => ({ ...prev, rate: checked }))
                    }
                  >
                    Rate
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={purchaseColumnVisibility.amount}
                    onCheckedChange={(checked) => 
                      setPurchaseColumnVisibility(prev => ({ ...prev, amount: checked }))
                    }
                  >
                    Amount
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={purchaseColumnVisibility.commission}
                    onCheckedChange={(checked) => 
                      setPurchaseColumnVisibility(prev => ({ ...prev, commission: checked }))
                    }
                  >
                    Commission
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={purchaseColumnVisibility.netAmount}
                    onCheckedChange={(checked) => 
                      setPurchaseColumnVisibility(prev => ({ ...prev, netAmount: checked }))
                    }
                  >
                    Net Amount
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={purchaseColumnVisibility.remarks}
                    onCheckedChange={(checked) => 
                      setPurchaseColumnVisibility(prev => ({ ...prev, remarks: checked }))
                    }
                  >
                    Remarks
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
          <Table className="w-full">
  <TableHeader>
    <TableRow className="bg-gray-50">
      <TableHead className={`${TABLE_STYLES.HEADER} cursor-pointer hover:bg-gray-100`} onClick={() => handlePurchaseHeaderClick('transaction_date')}>
        <div className="flex items-center justify-between">
          Purchased Date
          <SortIndicator field="transaction_date" tableSortField={purchaseSortField} tableSortOrder={purchaseSortOrder} />
        </div>
      </TableHead>
      <TableHead className={`${TABLE_STYLES.HEADER} cursor-pointer hover:bg-gray-100`} onClick={() => handlePurchaseHeaderClick('quantity')}>
        <div className="flex items-center justify-between">
          Total Shares
          <SortIndicator field="quantity" tableSortField={purchaseSortField} tableSortOrder={purchaseSortOrder} />
        </div>
      </TableHead>
      <TableHead className={`${TABLE_STYLES.HEADER} cursor-pointer hover:bg-gray-100`} onClick={() => handlePurchaseHeaderClick('price')}>
        <div className="flex items-center justify-between">
          Average Price Per Share
          <SortIndicator field="price" tableSortField={purchaseSortField} tableSortOrder={purchaseSortOrder} />
        </div>
      </TableHead>
      <TableHead className={`${TABLE_STYLES.HEADER} cursor-pointer hover:bg-gray-100`} onClick={() => handlePurchaseHeaderClick('txn_value')}>
        <div className="flex items-center justify-between">
          Total Amount
          <SortIndicator field="txn_value" tableSortField={purchaseSortField} tableSortOrder={purchaseSortOrder} />
        </div>
      </TableHead>
      <TableHead className={TABLE_STYLES.HEADER}>Commission Rate</TableHead>
      <TableHead className={`${TABLE_STYLES.HEADER} cursor-pointer hover:bg-gray-100`} onClick={() => handlePurchaseHeaderClick('commission_amount')}>
        <div className="flex items-center justify-between">
          Total Broker Commission
          <SortIndicator field="commission_amount" tableSortField={purchaseSortField} tableSortOrder={purchaseSortOrder} />
        </div>
      </TableHead>
      <TableHead className={`${TABLE_STYLES.HEADER} cursor-pointer hover:bg-gray-100`} onClick={() => handlePurchaseHeaderClick('sebon_commission')}>
        <div className="flex items-center justify-between">
          Total Sebon Commission
          <SortIndicator field="sebon_commission" tableSortField={purchaseSortField} tableSortOrder={purchaseSortOrder} />
        </div>
      </TableHead>
      <TableHead className={`${TABLE_STYLES.HEADER} cursor-pointer hover:bg-gray-100`} onClick={() => handlePurchaseHeaderClick('effective_rate')}>
        <div className="flex items-center justify-between">
          Effective Rate
          <SortIndicator field="effective_rate" tableSortField={purchaseSortField} tableSortOrder={purchaseSortOrder} />
        </div>
      </TableHead>
      <TableHead className={`${TABLE_STYLES.HEADER} cursor-pointer hover:bg-gray-100`} onClick={() => handlePurchaseHeaderClick('net_payable')}>
        <div className="flex items-center justify-between">
          Total Cost
          <SortIndicator field="net_payable" tableSortField={purchaseSortField} tableSortOrder={purchaseSortOrder} />
        </div>
      </TableHead>
      <TableHead className={`${TABLE_STYLES.HEADER} text-right cursor-pointer hover:bg-gray-100`} onClick={() => handlePurchaseHeaderClick('client_id')}>
        <div className="flex items-center justify-end">
          Client
          <SortIndicator field="client_id" tableSortField={purchaseSortField} tableSortOrder={purchaseSortOrder} />
        </div>
      </TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {paginatedPurchaseData.map((record) => (
    <TableRow key={record.contract_number} className={record.is_closeout ? `${TABLE_STYLES.CLOSEOUT_ROW} ${TABLE_STYLES.CLOSEOUT}` : TABLE_STYLES.ROW_HOVER}>
      <TableCell className={`font-medium ${TABLE_STYLES.CELL} ${record.is_closeout ? 'text-red-700' : ''}`}>
        <div className="flex items-center gap-2">
          {record.is_closeout ? (
            <span className="text-red-500">📤</span>
          ) : (
            <span className="text-green-500">📥</span>
          )}
          <div>
            <div className="font-medium">{record.transaction_date?.toLocaleDateString()}</div>
            {record.is_closeout && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 mt-1">
                Closeout Transaction
              </span>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className={`${TABLE_STYLES.CELL} ${record.is_closeout ? 'text-red-700 font-semibold' : ''}`}>
        {record.quantity.toLocaleString()}
      </TableCell>
      <TableCell className={`${TABLE_STYLES.CELL} ${record.is_closeout ? 'text-red-700' : ''}`}>Rs. {record.price.toFixed(2)}</TableCell>
      <TableCell className={`${TABLE_STYLES.CELL} ${record.is_closeout ? 'text-red-700' : ''}`}>Rs. {record.txn_value.toLocaleString()}</TableCell>
      <TableCell className={TABLE_STYLES.CELL}>{record.commission_rate || (record.is_closeout ? 'N/A' : '')}</TableCell>
      <TableCell className={TABLE_STYLES.CELL}>Rs. {record.commission_amount?.toLocaleString() || (record.is_closeout ? '0.00' : '')}</TableCell>
      <TableCell className={TABLE_STYLES.CELL}>Rs. {record.sebon_commission?.toLocaleString() || (record.is_closeout ? '0.00' : '')}</TableCell>
      <TableCell className={`${TABLE_STYLES.CELL} ${record.is_closeout ? 'text-red-700' : ''}`}>Rs. {record.effective_rate?.toFixed(2) || '0.00'}</TableCell>
      <TableCell className={`${TABLE_STYLES.CELL} ${record.is_closeout ? 'text-red-700 font-semibold' : ''}`}>Rs. {record.net_payable?.toLocaleString()}</TableCell>
      <TableCell className={`text-right ${TABLE_STYLES.CELL}`}>{record.client_id}</TableCell>
    </TableRow>
    ))
      }
  </TableBody>
  {ledgerData?.totals && (
    <TableFooter>
      <TableRow className={TABLE_STYLES.FOOTER}>
        <TableCell className={`font-semibold ${TABLE_STYLES.CELL}`}>TOTAL</TableCell>
        <TableCell className={`font-semibold ${TABLE_STYLES.CELL}`}>{ledgerData.totals.purchase.totalQuantity.toLocaleString()}</TableCell>
        <TableCell className={`font-semibold ${TABLE_STYLES.CELL}`}>-</TableCell>
        <TableCell className={`font-semibold ${TABLE_STYLES.CELL}`}>Rs. {ledgerData.totals.purchase.totalTxnValue.toLocaleString()}</TableCell>
        <TableCell className={`font-semibold ${TABLE_STYLES.CELL}`}>-</TableCell>
        <TableCell className={`font-semibold ${TABLE_STYLES.CELL}`}>Rs. {ledgerData.totals.purchase.totalCommissionAmount.toLocaleString()}</TableCell>
        <TableCell className={`font-semibold ${TABLE_STYLES.CELL}`}>Rs. {ledgerData.totals.purchase.totalSebonCommission.toLocaleString()}</TableCell>
        <TableCell className={`font-semibold ${TABLE_STYLES.CELL}`}>-</TableCell>
        <TableCell className={`font-semibold ${TABLE_STYLES.CELL}`}>Rs. {ledgerData.totals.purchase.totalNetPayable.toLocaleString()}</TableCell>
        <TableCell className={`font-semibold ${TABLE_STYLES.CELL}`}>-</TableCell>
      </TableRow>
    </TableFooter>
  )}
</Table>
          </div>
          {purchaseTotalItems > 0 && (
            <div className="px-6 py-4 bg-white border-t border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-700">Items per page:</span>
                <Select value={purchaseItemsPerPage.toString()} onValueChange={(value) => {
                  setPurchaseItemsPerPage(parseInt(value));
                  setPurchasePage(1);
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
              {purchaseTotalItems > purchaseItemsPerPage && (
                <Pagination
                  currentPage={purchasePage}
                  totalPages={purchaseTotalPages}
                  onPageChange={setPurchasePage}
                  itemsPerPage={purchaseItemsPerPage}
                  totalItems={purchaseTotalItems}
                />
              )}
            </div>
          )}
          </CardContent>
        </Card>

        {/* Eligible Records - Organized by Type */}
        <Card className="bg-white shadow-lg border border-gray-100 mb-6" style={{boxShadow: 'inset 0 2px 4px -1px rgba(59, 130, 246, 0.1)'}}>
          <CardHeader className="pb-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                <div>
                  <CardTitle className="text-xl font-bold text-gray-900">Eligible Holdings</CardTitle>
                  <p className="text-sm text-gray-600 mt-1">Opening balance, bonus shares, right shares, promoter holdings, and IPO allotments</p>
                </div>
                {filteredEligibleRecords.length > 0 && (
                  <span className="ml-4 text-sm text-gray-500">({filteredEligibleRecords.length} records)</span>
                )}
              </div>
            </div>
            
            {/* Search and Column Controls for Eligible */}
            <div className="flex items-center gap-3 mb-4">
              {/* Search Input */}
              <div className="relative flex-1 max-w-lg">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by date, type, or remarks..."
                  value={eligibleSearchTerm}
                  onChange={(e) => setEligibleSearchTerm(e.target.value)}
                  className="pl-10 pr-10 border-gray-200 focus:border-blue-300"
                />
                {eligibleSearchTerm && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEligibleSearchTerm("")}
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
                    checked={eligibleColumnVisibility.date}
                    onCheckedChange={(checked) => 
                      setEligibleColumnVisibility(prev => ({ ...prev, date: checked }))
                    }
                  >
                    Date
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={eligibleColumnVisibility.quantity}
                    onCheckedChange={(checked) => 
                      setEligibleColumnVisibility(prev => ({ ...prev, quantity: checked }))
                    }
                  >
                    Quantity
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={eligibleColumnVisibility.rate}
                    onCheckedChange={(checked) => 
                      setEligibleColumnVisibility(prev => ({ ...prev, rate: checked }))
                    }
                  >
                    Rate
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={eligibleColumnVisibility.amount}
                    onCheckedChange={(checked) => 
                      setEligibleColumnVisibility(prev => ({ ...prev, amount: checked }))
                    }
                  >
                    Amount
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={eligibleColumnVisibility.type}
                    onCheckedChange={(checked) => 
                      setEligibleColumnVisibility(prev => ({ ...prev, type: checked }))
                    }
                  >
                    Type
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={eligibleColumnVisibility.remarks}
                    onCheckedChange={(checked) => 
                      setEligibleColumnVisibility(prev => ({ ...prev, remarks: checked }))
                    }
                  >
                    Remarks
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full overflow-x-auto">
              <Table className="w-full">
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className={`${TABLE_STYLES.HEADER} cursor-pointer hover:bg-gray-100`} onClick={() => handleEligibleHeaderClick('record_type')}>
                      <div className="flex items-center justify-between">
                        Type
                        <SortIndicator field="record_type" tableSortField={eligibleSortField} tableSortOrder={eligibleSortOrder} />
                      </div>
                    </TableHead>
                    <TableHead className={`${TABLE_STYLES.HEADER} cursor-pointer hover:bg-gray-100`} onClick={() => handleEligibleHeaderClick('date')}>
                      <div className="flex items-center justify-between">
                        Date
                        <SortIndicator field="date" tableSortField={eligibleSortField} tableSortOrder={eligibleSortOrder} />
                      </div>
                    </TableHead>
                    <TableHead className={`${TABLE_STYLES.HEADER} cursor-pointer hover:bg-gray-100`} onClick={() => handleEligibleHeaderClick('opening_quantity')}>
                      <div className="flex items-center justify-between">
                        Shares
                        <SortIndicator field="opening_quantity" tableSortField={eligibleSortField} tableSortOrder={eligibleSortOrder} />
                      </div>
                    </TableHead>
                    <TableHead className={`${TABLE_STYLES.HEADER} cursor-pointer hover:bg-gray-100`} onClick={() => handleEligibleHeaderClick('effective_rate')}>
                      <div className="flex items-center justify-between">
                        Rate
                        <SortIndicator field="effective_rate" tableSortField={eligibleSortField} tableSortOrder={eligibleSortOrder} />
                      </div>
                    </TableHead>
                    <TableHead className={`${TABLE_STYLES.HEADER} cursor-pointer hover:bg-gray-100`} onClick={() => handleEligibleHeaderClick('total_value')}>
                      <div className="flex items-center justify-between">
                        Amount
                        <SortIndicator field="total_value" tableSortField={eligibleSortField} tableSortOrder={eligibleSortOrder} />
                      </div>
                    </TableHead>
                    <TableHead className={TABLE_STYLES.HEADER}>Details</TableHead>
                    <TableHead className={`${TABLE_STYLES.HEADER} cursor-pointer hover:bg-gray-100`} onClick={() => handleEligibleHeaderClick('client_id')}>
                      <div className="flex items-center justify-between">
                        Client
                        <SortIndicator field="client_id" tableSortField={eligibleSortField} tableSortOrder={eligibleSortOrder} />
                      </div>
                    </TableHead>
                    <TableHead className={`${TABLE_STYLES.HEADER} text-left`}>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedEligibleData?.map((record) => {
                    const getRecordTypeInfo = () => {
                      switch (record.record_type) {
                        case 'opening':
                          return { 
                            label: 'Opening Balance', 
                            color: 'bg-blue-100 text-blue-800', 
                            icon: '📊'
                          }
                        case 'bonus':
                          return { 
                            label: 'Bonus Shares', 
                            color: 'bg-green-100 text-green-800', 
                            icon: '🎁',
                            detail: `${record.bonus_percent}%`
                          }
                        case 'rights':
                          return { 
                            label: 'Right Shares', 
                            color: 'bg-purple-100 text-purple-800', 
                            icon: '🔄',
                            detail: record.right_ratio
                          }
                        case 'promoter':
                          return { 
                            label: 'Promoter Holdings', 
                            color: 'bg-orange-100 text-orange-800', 
                            icon: '👥'
                          }
                        case 'ipo_allotment':
                          return { 
                            label: 'IPO Allotment', 
                            color: 'bg-indigo-100 text-indigo-800', 
                            icon: '🚀'
                          }
                        case 'ipo_allotment_staging':
                          return { 
                            label: 'Not Dematerialized', 
                            color: 'bg-amber-100 text-amber-800', 
                            icon: '⏳'
                          }
                        default:
                          return { 
                            label: 'Other', 
                            color: 'bg-gray-100 text-gray-800', 
                            icon: '📄'
                          }
                      }
                    }
                    
                    const typeInfo = getRecordTypeInfo()
                    
                    return (
                      <TableRow key={record.id} className={TABLE_STYLES.ROW_HOVER}>
                        <TableCell className={`font-medium ${TABLE_STYLES.CELL}`}>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{typeInfo.icon}</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeInfo.color}`}>
                              {typeInfo.label}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className={`${TABLE_STYLES.CELL} text-sm`}>
                          {record.date ? record.date.toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell className={`${TABLE_STYLES.CELL} font-semibold`}>
                          {record.opening_quantity.toLocaleString()}
                        </TableCell>
                        <TableCell className={TABLE_STYLES.CELL}>
                          Rs. {record.effective_rate.toFixed(2)}
                        </TableCell>
                        <TableCell className={`${TABLE_STYLES.CELL} font-medium`}>
                          Rs. {record.total_value.toLocaleString()}
                        </TableCell>
                        <TableCell className={`${TABLE_STYLES.CELL} text-sm`}>
                          {typeInfo.detail || '-'}
                        </TableCell>
                        <TableCell className={`text-right ${TABLE_STYLES.CELL}`}>{record.client_id}</TableCell>
                        <TableCell className={`${TABLE_STYLES.CELL} text-left`}>
                          <InlineRemarks initial={record.remarks || ''} onSave={async (value) => {
                            await saveEligibleRemarks({
                              type: record.record_type as any,
                              previousFiscalYearId: record.previous_fiscal_year_id,
                              symbol: record.symbol,
                              bonusId: record.bonus_id,
                              rightId: record.right_id,
                              promoterId: record.promoter_id,
                              clientName: currentFund,
                              remarks: value,
                            })
                          }} />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
                {ledgerData?.totals && (
                  <TableFooter>
                    <TableRow className={TABLE_STYLES.FOOTER}>
                      <TableCell className={`font-semibold ${TABLE_STYLES.CELL}`}>TOTAL</TableCell>
                      <TableCell className={`font-semibold ${TABLE_STYLES.CELL}`}>-</TableCell>
                      <TableCell className={`font-semibold ${TABLE_STYLES.CELL}`}>
                        {(ledgerData.totals.eligible?.totalEligibleQuantity || 
                          ledgerData.totals.opening.totalEligibleQuantity || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className={`font-semibold ${TABLE_STYLES.CELL}`}>-</TableCell>
                      <TableCell className={`font-semibold ${TABLE_STYLES.CELL}`}>
                        Rs. {(ledgerData.totals.eligible?.totalEligibleValue || 
                          ledgerData.totals.opening.totalEligibleValue || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className={`font-semibold ${TABLE_STYLES.CELL}`}>-</TableCell>
                      <TableCell className={`font-semibold ${TABLE_STYLES.CELL}`}>-</TableCell>
                      <TableCell className={`font-semibold ${TABLE_STYLES.CELL}`}>-</TableCell>
                      <TableCell className={`font-semibold ${TABLE_STYLES.CELL} text-left`}>-</TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
            {eligibleTotalItems > 0 && (
              <div className="px-6 py-4 bg-white border-t border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-700">Items per page:</span>
                  <Select value={eligibleItemsPerPage.toString()} onValueChange={(value) => {
                    setEligibleItemsPerPage(parseInt(value));
                    setEligiblePage(1);
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
                {eligibleTotalItems > eligibleItemsPerPage && (
                  <Pagination
                    currentPage={eligiblePage}
                    totalPages={eligibleTotalPages}
                    onPageChange={setEligiblePage}
                    itemsPerPage={eligibleItemsPerPage}
                    totalItems={eligibleTotalItems}
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>

  
          <Card className="bg-white shadow-lg border border-gray-100 mb-6" style={{boxShadow: 'inset 0 2px 4px -1px rgba(249, 115, 22, 0.1)'}}>
          <CardHeader className="pb-4 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-orange-500 rounded-full mr-2"></div>
                <div>
                  <CardTitle className="text-xl font-bold text-gray-900">Sales Records</CardTitle>
                  <p className="text-sm text-gray-600 mt-1">Sales transactions with profit/loss calculations</p>
                </div>
                {filteredSalesRecords.length > 0 && (
                  <span className="ml-4 text-sm text-gray-500">({filteredSalesRecords.length} records)</span>
                )}
              </div>
            </div>
            
            {/* Search and Column Controls for Sales */}
            <div className="flex items-center gap-3 mb-4">
              {/* Search Input */}
              <div className="relative flex-1 max-w-lg">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by date or any field..."
                  value={salesSearchTerm}
                  onChange={(e) => setSalesSearchTerm(e.target.value)}
                  className="pl-10 pr-10 border-gray-200 focus:border-orange-300"
                />
                {salesSearchTerm && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSalesSearchTerm("")}
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-100"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              
              {/* Column Visibility Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center gap-2 border-gray-200 hover:border-orange-300">
                    <Settings className="h-4 w-4" />
                    Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 max-h-96 overflow-y-auto">
                  <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={salesColumnVisibility.date}
                    onCheckedChange={(checked) => 
                      setSalesColumnVisibility(prev => ({ ...prev, date: checked }))
                    }
                  >
                    Date
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={salesColumnVisibility.quantity}
                    onCheckedChange={(checked) => 
                      setSalesColumnVisibility(prev => ({ ...prev, quantity: checked }))
                    }
                  >
                    Quantity
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={salesColumnVisibility.rate}
                    onCheckedChange={(checked) => 
                      setSalesColumnVisibility(prev => ({ ...prev, rate: checked }))
                    }
                  >
                    Rate
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={salesColumnVisibility.amount}
                    onCheckedChange={(checked) => 
                      setSalesColumnVisibility(prev => ({ ...prev, amount: checked }))
                    }
                  >
                    Amount
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={salesColumnVisibility.commission}
                    onCheckedChange={(checked) => 
                      setSalesColumnVisibility(prev => ({ ...prev, commission: checked }))
                    }
                  >
                    Commission
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={salesColumnVisibility.netAmount}
                    onCheckedChange={(checked) => 
                      setSalesColumnVisibility(prev => ({ ...prev, netAmount: checked }))
                    }
                  >
                    Net Amount
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={salesColumnVisibility.profitLoss}
                    onCheckedChange={(checked) => 
                      setSalesColumnVisibility(prev => ({ ...prev, profitLoss: checked }))
                    }
                  >
                    Profit/Loss
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={salesColumnVisibility.remarks}
                    onCheckedChange={(checked) => 
                      setSalesColumnVisibility(prev => ({ ...prev, remarks: checked }))
                    }
                  >
                    Remarks
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
          <Table className="w-full">
  <TableHeader>
    <TableRow className="bg-gray-50">
      <TableHead className={`${TABLE_STYLES.HEADER} cursor-pointer hover:bg-gray-100`} onClick={() => handleSalesHeaderClick('transaction_date')}>
        <div className="flex items-center justify-between">
          Sales Date
          <SortIndicator field="transaction_date" tableSortField={salesSortField} tableSortOrder={salesSortOrder} />
        </div>
      </TableHead>
      <TableHead className={`${TABLE_STYLES.HEADER} cursor-pointer hover:bg-gray-100`} onClick={() => handleSalesHeaderClick('quantity')}>
        <div className="flex items-center justify-between">
          Total Shares
          <SortIndicator field="quantity" tableSortField={salesSortField} tableSortOrder={salesSortOrder} />
        </div>
      </TableHead>
      <TableHead className={`${TABLE_STYLES.HEADER} cursor-pointer hover:bg-gray-100`} onClick={() => handleSalesHeaderClick('price')}>
        <div className="flex items-center justify-between">
          Average Price Per Share
          <SortIndicator field="price" tableSortField={salesSortField} tableSortOrder={salesSortOrder} />
        </div>
      </TableHead>
      <TableHead className={`${TABLE_STYLES.HEADER} cursor-pointer hover:bg-gray-100`} onClick={() => handleSalesHeaderClick('txn_value')}>
        <div className="flex items-center justify-between">
          Total Amount
          <SortIndicator field="txn_value" tableSortField={salesSortField} tableSortOrder={salesSortOrder} />
        </div>
      </TableHead>
      <TableHead className={TABLE_STYLES.HEADER}>Commission Rate</TableHead>
      <TableHead className={`${TABLE_STYLES.HEADER} cursor-pointer hover:bg-gray-100`} onClick={() => handleSalesHeaderClick('commission_amount')}>
        <div className="flex items-center justify-between">
          Total Broker Commission
          <SortIndicator field="commission_amount" tableSortField={salesSortField} tableSortOrder={salesSortOrder} />
        </div>
      </TableHead>
      <TableHead className={`${TABLE_STYLES.HEADER} cursor-pointer hover:bg-gray-100`} onClick={() => handleSalesHeaderClick('capital_gain_tax')}>
        <div className="flex items-center justify-between">
          Total CGT
          <SortIndicator field="capital_gain_tax" tableSortField={salesSortField} tableSortOrder={salesSortOrder} />
        </div>
      </TableHead>
      <TableHead className={`${TABLE_STYLES.HEADER} cursor-pointer hover:bg-gray-100`} onClick={() => handleSalesHeaderClick('sebon_commission')}>
        <div className="flex items-center justify-between">
          Total Sebon Commission
          <SortIndicator field="sebon_commission" tableSortField={salesSortField} tableSortOrder={salesSortOrder} />
        </div>
      </TableHead>
      <TableHead className={`${TABLE_STYLES.HEADER} cursor-pointer hover:bg-gray-100`} onClick={() => handleSalesHeaderClick('effective_rate')}>
        <div className="flex items-center justify-between">
          Effective Rate
          <SortIndicator field="effective_rate" tableSortField={salesSortField} tableSortOrder={salesSortOrder} />
        </div>
      </TableHead>
      <TableHead className={`${TABLE_STYLES.HEADER} cursor-pointer hover:bg-gray-100`} onClick={() => handleSalesHeaderClick('net_receivable')}>
        <div className="flex items-center justify-between">
          Total Cost
          <SortIndicator field="net_receivable" tableSortField={salesSortField} tableSortOrder={salesSortOrder} />
        </div>
      </TableHead>
      <TableHead className={`${TABLE_STYLES.HEADER} cursor-pointer hover:bg-gray-100`} onClick={() => handleSalesHeaderClick('profit_loss')}>
        <div className="flex items-center justify-between">
          Total Gain/Loss
          <SortIndicator field="profit_loss" tableSortField={salesSortField} tableSortOrder={salesSortOrder} />
        </div>
      </TableHead>
      <TableHead className={`${TABLE_STYLES.HEADER} text-right cursor-pointer hover:bg-gray-100`} onClick={() => handleSalesHeaderClick('client_id')}>
        <div className="flex items-center justify-end">
          Client
          <SortIndicator field="client_id" tableSortField={salesSortField} tableSortOrder={salesSortOrder} />
        </div>
      </TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {paginatedSalesData.map((record) => (
    <TableRow key={record.contract_number} className={TABLE_STYLES.ROW_HOVER}>
      <TableCell className={`font-medium ${TABLE_STYLES.CELL}`}>
        <div className="flex items-center gap-2">
          <span className="text-orange-500">💰</span>
          <div>
            <div className="font-medium">{record.transaction_date?.toLocaleDateString()}</div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
              Sale Transaction
            </span>
          </div>
        </div>
      </TableCell>
      <TableCell className={TABLE_STYLES.CELL}>{record.quantity.toLocaleString()}</TableCell>
      <TableCell className={TABLE_STYLES.CELL}>Rs. {record.price.toFixed(2)}</TableCell>
      <TableCell className={TABLE_STYLES.CELL}>Rs. {record.txn_value.toLocaleString()}</TableCell>
      <TableCell className={TABLE_STYLES.CELL}>{record.commission_rate}</TableCell>
      <TableCell className={TABLE_STYLES.CELL}>Rs. {record.commission_amount?.toLocaleString()}</TableCell>
      <TableCell className={TABLE_STYLES.CELL}>Rs. {record.capital_gain_tax?.toLocaleString()}</TableCell>
      <TableCell className={TABLE_STYLES.CELL}>Rs. {record.sebon_commission?.toLocaleString()}</TableCell>
      <TableCell className={TABLE_STYLES.CELL}>Rs. {record.effective_rate?.toFixed(2) || '0.00'}</TableCell>
      <TableCell className={TABLE_STYLES.CELL}>Rs. {record.net_receivable?.toLocaleString()}</TableCell>
      <TableCell className={`${TABLE_STYLES.CELL} ${(record.profit_loss || 0) >= 0 ? TABLE_STYLES.PROFIT : TABLE_STYLES.LOSS}`}>Rs. {record.profit_loss?.toLocaleString()}</TableCell>
      <TableCell className={`text-right ${TABLE_STYLES.CELL}`}>{record.client_id}</TableCell>
    </TableRow>
    ))
      }
  </TableBody>
  {ledgerData?.totals && (
    <TableFooter>
      <TableRow className={TABLE_STYLES.FOOTER}>
        <TableCell className={`font-semibold ${TABLE_STYLES.CELL}`}>TOTAL</TableCell>
        <TableCell className={`font-semibold ${TABLE_STYLES.CELL}`}>{ledgerData.totals.sales.totalQuantity.toLocaleString()}</TableCell>
        <TableCell className={`font-semibold ${TABLE_STYLES.CELL}`}>-</TableCell>
        <TableCell className={`font-semibold ${TABLE_STYLES.CELL}`}>Rs. {ledgerData.totals.sales.totalTxnValue.toLocaleString()}</TableCell>
        <TableCell className={`font-semibold ${TABLE_STYLES.CELL}`}>-</TableCell>
        <TableCell className={`font-semibold ${TABLE_STYLES.CELL}`}>Rs. {ledgerData.totals.sales.totalCommissionAmount.toLocaleString()}</TableCell>
        <TableCell className={`font-semibold ${TABLE_STYLES.CELL}`}>Rs. {ledgerData.totals.sales.totalCapitalGainTax.toLocaleString()}</TableCell>
        <TableCell className={`font-semibold ${TABLE_STYLES.CELL}`}>Rs. {ledgerData.totals.sales.totalSebonCommission.toLocaleString()}</TableCell>
        <TableCell className={`font-semibold ${TABLE_STYLES.CELL}`}>-</TableCell>
        <TableCell className={`font-semibold ${TABLE_STYLES.CELL}`}>Rs. {ledgerData.totals.sales.totalNetReceivable.toLocaleString()}</TableCell>
        <TableCell className={`font-semibold ${TABLE_STYLES.CELL} ${ledgerData.totals.sales.totalProfitLoss >= 0 ? TABLE_STYLES.PROFIT : TABLE_STYLES.LOSS}`}>
          Rs. {ledgerData.totals.sales.totalProfitLoss.toLocaleString()}
        </TableCell>
        <TableCell className={`font-semibold ${TABLE_STYLES.CELL}`}>-</TableCell>
      </TableRow>
    </TableFooter>
  )}
</Table>
          </div>
          {salesTotalItems > 0 && (
            <div className="px-6 py-4 bg-white border-t border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-700">Items per page:</span>
                <Select value={salesItemsPerPage.toString()} onValueChange={(value) => {
                  setSalesItemsPerPage(parseInt(value));
                  setSalesPage(1);
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
              {salesTotalItems > salesItemsPerPage && (
                <Pagination
                  currentPage={salesPage}
                  totalPages={salesTotalPages}
                  onPageChange={setSalesPage}
                  itemsPerPage={salesItemsPerPage}
                  totalItems={salesTotalItems}
                />
              )}
            </div>
          )}
          </CardContent>
        </Card>
    </div>
    )
  )
}
