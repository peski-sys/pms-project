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
import { RefreshCw, Download } from "lucide-react"

import { useEffect, useState } from "react"
import { getUsers } from "@/app/api/dashboardAPICalls/actions"
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
  record_type: 'opening' | 'bonus' | 'rights' | 'promoter' | 'ipo_allotment'
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
  const [effectiveRateLoading, setEffectiveRateLoading] = useState(INITIAL_STATE.RATE_LOADING)
  const [isLoadingMain, setIsLoadingMain] = useState(INITIAL_STATE.LOADING)

  // Event Handlers
  const handleFundChange = (value: string) => {
    setCurrentFund(value)
  }

  const handleFiscalChange = (value: string) => {
    setFiscalID(value)
  }

  const handleSymbolChange = (value: string) => {
    setSymbol(value)
  }

  const fetchEffectiveRate = async (symbolValue: string, fundValue: string) => {
    if (!symbolValue || !fundValue) return
    
    setEffectiveRateLoading(true)
    try {
      const rateData = await getSymbolHoldingsEffectiveRate(symbolValue, fundValue)
      setEffectiveRate(rateData.success ? rateData.effective_rate : INITIAL_STATE.EFFECTIVE_RATE)
    } catch (error) {
      console.error('Error fetching effective rate:', error)
      setEffectiveRate(INITIAL_STATE.EFFECTIVE_RATE)
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
      
      if (usersData.length > 0) {
        const firstUser = usersData[0].client_name
        setCurrentUser(firstUser)
        setCurrentFund(firstUser)
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
              
              {/* Price Per Share Display - positioned right after the text */}
              <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm ml-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Price Per Share</div>
                <div className="flex items-center justify-center">
                  {effectiveRateLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                  ) : (
                    <span className="text-lg font-bold text-gray-900">
                      <mark> Rs. {effectiveRate > 0 ? effectiveRate.toFixed(2) : 'N/A'} </mark>
                    </span>
                  )}
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
        <Card className="bg-white shadow-sm border border-gray-200 mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-gray-900">Purchase Records</CardTitle>
            <p className="text-sm text-gray-600 mt-1">Purchase transactions and closeout records</p>
          </CardHeader>
          <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
          <Table className="w-full">
  <TableHeader>
    <TableRow className="bg-gray-50">
      <TableHead className={TABLE_STYLES.HEADER}>Purchased Date</TableHead>
      <TableHead className={TABLE_STYLES.HEADER}>Total Shares</TableHead>
      <TableHead className={TABLE_STYLES.HEADER}>Average Price Per Share</TableHead>
      <TableHead className={TABLE_STYLES.HEADER}>Total Amount</TableHead>
      <TableHead className={TABLE_STYLES.HEADER}>Commission Rate</TableHead>
      <TableHead className={TABLE_STYLES.HEADER}>Total Broker Commission</TableHead>
      <TableHead className={TABLE_STYLES.HEADER}>Total Sebon Commission</TableHead>
      <TableHead className={TABLE_STYLES.HEADER}>Effective Rate</TableHead>
      <TableHead className={TABLE_STYLES.HEADER}>Total Cost</TableHead>
      <TableHead className={`${TABLE_STYLES.HEADER} text-right`}>Client</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {ledgerData?.purchased_sanitized.map((record) => (
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
          </CardContent>
        </Card>

        {/* Eligible Records - Organized by Type */}
        <Card className="bg-white shadow-sm border border-gray-200 mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-gray-900">Eligible Holdings</CardTitle>
            <p className="text-sm text-gray-600 mt-1">Opening balance, bonus shares, right shares, promoter holdings, and IPO allotments</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full overflow-x-auto">
              <Table className="w-full">
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className={TABLE_STYLES.HEADER}>Type</TableHead>
                    <TableHead className={TABLE_STYLES.HEADER}>Date</TableHead>
                    <TableHead className={TABLE_STYLES.HEADER}>Shares</TableHead>
                    <TableHead className={TABLE_STYLES.HEADER}>Rate</TableHead>
                    <TableHead className={TABLE_STYLES.HEADER}>Amount</TableHead>
                    <TableHead className={TABLE_STYLES.HEADER}>Details</TableHead>
                    <TableHead className={TABLE_STYLES.HEADER}>Client</TableHead>
                    <TableHead className={`${TABLE_STYLES.HEADER} text-left`}>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgerData?.eligible_sanitized?.map((record) => {
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
                        <TableCell className={`${TABLE_STYLES.CELL} text-sm`}>
                          {record.client_id || '-'}
                        </TableCell>
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
          </CardContent>
        </Card>

  
          <Card className="bg-white shadow-sm border border-gray-200 mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-gray-900">Sales Records</CardTitle>
            <p className="text-sm text-gray-600 mt-1">Sales transactions with profit/loss calculations</p>
          </CardHeader>
          <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
          <Table className="w-full">
  <TableHeader>
    <TableRow className="bg-gray-50">
      <TableHead className={TABLE_STYLES.HEADER}>Sales Date</TableHead>
      <TableHead className={TABLE_STYLES.HEADER}>Total Shares</TableHead>
      <TableHead className={TABLE_STYLES.HEADER}>Average Price Per Share</TableHead>
      <TableHead className={TABLE_STYLES.HEADER}>Total Amount</TableHead>
      <TableHead className={TABLE_STYLES.HEADER}>Commission Rate</TableHead>
      <TableHead className={TABLE_STYLES.HEADER}>Total Broker Commission</TableHead>
      <TableHead className={TABLE_STYLES.HEADER}>Total CGT</TableHead>
      <TableHead className={TABLE_STYLES.HEADER}>Total Sebon Commission</TableHead>
      <TableHead className={TABLE_STYLES.HEADER}>Effective Rate</TableHead>
      <TableHead className={TABLE_STYLES.HEADER}>Total Cost</TableHead>
      <TableHead className={TABLE_STYLES.HEADER}>Total Gain/Loss</TableHead>
      <TableHead className={`${TABLE_STYLES.HEADER} text-right`}>Client</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {ledgerData?.sales_sanitized.map((record) => (
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
          </CardContent>
        </Card>
    </div>
    )
  )
}
