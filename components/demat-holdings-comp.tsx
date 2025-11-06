"use client"

import { useEffect, useMemo, useState } from "react"
import { getCurrentSessionUser, getUsers } from "@/app/api/dashboardAPICalls/actions"
import { getDematHoldings, getFiscalYears, updateLTPForSymbol, updateWACCForSymbol, type DematHoldingRow } from "@/app/api/dematHoldings/actions"

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
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { RefreshCw, Database, Save, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"

type UserItem = {
  client_id: string,
  client_name: string,
  client_broker: number,
  recorded_at: Date | null,
}

type FiscalYear = {
  fiscal_year_id: number,
  year_label: string,
  start_date: Date,
  end_date: Date,
}

export default function DematHoldingsComponent() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([])
  const [selectedFund, setSelectedFund] = useState<string>("")
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number | null>(null)
  const [rows, setRows] = useState<DematHoldingRow[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [ltpUpdateLoading, setLtpUpdateLoading] = useState<boolean>(false)
  const [isAdmin, setIsAdmin] = useState<boolean | null>()
  
  // State for editable fields
  const [editingFields, setEditingFields] = useState<Record<string, { ltp: number; wacc: number }>>({}) 
  const [pendingUpdates, setPendingUpdates] = useState<{ symbol: string; field: 'ltp' | 'wacc'; value: number; row: DematHoldingRow }[]>([]) 
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [currentUpdate, setCurrentUpdate] = useState<{ symbol: string; field: 'ltp' | 'wacc'; value: number; row: DematHoldingRow } | null>(null)

  useEffect(() => {
    async function bootstrap() {
      setLoading(true)
      try {
        const [u, fy] = await Promise.all([
          getUsers(),
          getFiscalYears()
        ])
        
        const userPermission = await getCurrentSessionUser()
        setIsAdmin(userPermission)
        setUsers(u)
        setFiscalYears(fy)
        
        const first = u[0]?.client_name || ""
        setSelectedFund(first)
        
        // Find current fiscal year based on today's date
        const currentDate = new Date()
        const currentFY = fy.find(fiscalYear => {
          const startDate = new Date(fiscalYear.start_date)
          const endDate = new Date(fiscalYear.end_date)
          return currentDate >= startDate && currentDate <= endDate
        })?.fiscal_year_id || fy[0]?.fiscal_year_id || null
        
        setSelectedFiscalYear(currentFY)
        
        if (first) {
          const data = await getDematHoldings(first, currentFY || undefined)
          setRows(data)
        }
      } finally {
        setLoading(false)
      }
    }
    bootstrap()
  }, [])

  async function refresh() {
    if (!selectedFund) return
    setLoading(true)
    try {
      const data = await getDematHoldings(selectedFund, selectedFiscalYear || undefined)
      setRows(data)
    } finally {
      setLoading(false)
    }
  }
  
  async function refreshLTP() {
    setLtpUpdateLoading(true)
    try {
      const response = await fetch('/api/update-ltp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      const result = await response.json()
      
      if (result.success) {
        // Refresh the data after LTP update
        await refresh()
        alert('LTP data updated successfully!')
      } else {
        alert(`Failed to update LTP: ${result.message}`)
      }
    } catch (error) {
      console.error('Error updating LTP:', error)
      alert('Failed to update LTP data')
    } finally {
      setLtpUpdateLoading(false)
    }
  }
  
  // Initialize editing fields when rows change
  useEffect(() => {
    const initialFields: Record<string, { ltp: number; wacc: number }> = {}
    rows.forEach(row => {
      initialFields[row.symbol] = {
        ltp: row.today_closing_price,
        wacc: row.wacc
      }
    })
    setEditingFields(initialFields)
  }, [rows])
  
  // Handle fiscal year change
  useEffect(() => {
    if (selectedFund && selectedFiscalYear !== null) {
      refresh()
    }
  }, [selectedFiscalYear])
  
  // Handle field value changes
  const handleFieldChange = (symbol: string, field: 'ltp' | 'wacc', value: string) => {
    const numericValue = parseFloat(value) || 0
    setEditingFields(prev => ({
      ...prev,
      [symbol]: {
        ...prev[symbol],
        [field]: numericValue
      }
    }))
  }
  
  // Handle save button click - show confirmation dialog
  const handleSaveClick = async (symbol: string, field: 'ltp' | 'wacc', row?: DematHoldingRow) => {
    setPendingUpdates((pending) => [
      ...pending,
      { symbol, field, value: editingFields[symbol]?.[field] ?? 0, row: row || rows.find(r => r.symbol === symbol)! }
    ])
    try {
      if (field === 'wacc') {
        await updateWACCForSymbol(symbol, row?.fund_id ?? 0, row?.fiscal_year_id ?? 0, editingFields[symbol]?.wacc ?? 0)
      } else if (field === 'ltp') {
        await updateLTPForSymbol(symbol, row?.fiscal_year_id ?? 0, editingFields[symbol]?.ltp ?? 0)
      }
      await refresh(); // Refresh all data after update
    } finally {
      setPendingUpdates((pending) => pending.filter(u => !(u.symbol === symbol && u.field === field)))
    }
  }
  
  // Handle confirmed update
  const handleConfirmedUpdate = async () => {
    if (!currentUpdate) return
    
    setLoading(true)
    try {
      let result: { success: boolean; message: string }
      
      if (currentUpdate.field === 'ltp') {
        result = await updateLTPForSymbol(
          currentUpdate.symbol,
          currentUpdate.row.fiscal_year_id,
          currentUpdate.value
        )
      } else {
        result = await updateWACCForSymbol(
          currentUpdate.symbol,
          currentUpdate.row.fund_id,
          currentUpdate.row.fiscal_year_id,
          currentUpdate.value
        )
      }
      
      if (result.success) {
        alert(`${result.message}`)
        // Refresh data to show updated values
        await refresh()
      } else {
        alert(`Failed to update ${currentUpdate.field.toUpperCase()}: ${result.message}`)
        // Reset the field to original value
        setEditingFields(prev => ({
          ...prev,
          [currentUpdate.symbol]: {
            ...prev[currentUpdate.symbol],
            [currentUpdate.field]: currentUpdate.field === 'ltp' ? currentUpdate.row.today_closing_price : currentUpdate.row.wacc
          }
        }))
      }
    } catch (error) {
      console.error(`Error updating ${currentUpdate.field}:`, error)
      alert(`Failed to update ${currentUpdate.field.toUpperCase()}`)
      // Reset the field to original value
      setEditingFields(prev => ({
        ...prev,
        [currentUpdate.symbol]: {
          ...prev[currentUpdate.symbol],
          [currentUpdate.field]: currentUpdate.field === 'ltp' ? currentUpdate.row.today_closing_price : currentUpdate.row.wacc
        }
      }))
    } finally {
      setLoading(false)
      setShowConfirmDialog(false)
      setCurrentUpdate(null)
    }
  }
  
  // Handle dialog cancel
  const handleCancelUpdate = () => {
    if (currentUpdate) {
      // Reset the field to original value
      setEditingFields(prev => ({
        ...prev,
        [currentUpdate.symbol]: {
          ...prev[currentUpdate.symbol],
          [currentUpdate.field]: currentUpdate.field === 'ltp' ? currentUpdate.row.today_closing_price : currentUpdate.row.wacc
        }
      }))
    }
    setShowConfirmDialog(false)
    setCurrentUpdate(null)
  }

  const maxValueLTP = useMemo(() => Math.max(1, ...rows.map(r => r.value_ltp)), [rows])

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Filters */}
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-gray-900">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-center">
            <Select value={selectedFund} onValueChange={(v) => setSelectedFund(v)}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select Fund" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Fund</SelectLabel>
                  {users.map(u => (
                    <SelectItem key={u.client_id} value={u.client_name}>{u.client_name}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            
            <Select 
              value={selectedFiscalYear?.toString() || ""} 
              onValueChange={(v) => setSelectedFiscalYear(v ? parseInt(v) : null)}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select Fiscal Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Fiscal Year</SelectLabel>
                  {fiscalYears.map(fy => (
                    <SelectItem key={fy.fiscal_year_id} value={fy.fiscal_year_id.toString()}>
                      {fy.year_label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            
            <Button 
              onClick={refresh} 
              variant="outline" 
              size="sm" 
              disabled={loading}
              className="inline-flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh Data
            </Button>
            
            <Button 
              onClick={refreshLTP} 
              variant="outline" 
              size="sm" 
              disabled={ltpUpdateLoading}
              className="inline-flex items-center gap-2 bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700"
            >
              <Database className={`w-4 h-4 ${ltpUpdateLoading ? 'animate-spin' : ''}`} />
              {ltpUpdateLoading ? 'Updating LTP...' : 'Refresh LTP'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* TABLES GROUPED BY DP NAME */}
      {/** Group rows by DP Name **/}
      {useMemo(() => {
        if (loading) return (
          <Card className="bg-white shadow-sm border border-gray-200 mt-4"><CardContent className="p-9 text-center text-gray-500">Loading...</CardContent></Card>
        )
        if (rows.length === 0) return (
          <Card className="bg-white shadow-sm border border-gray-200 mt-4"><CardContent className="p-9 text-center text-gray-500">No data</CardContent></Card>
        )

        // Group by dp_name
        const grouped = rows.reduce((acc, row) => {
          (acc[row.dp_name || '-'] = acc[row.dp_name || '-'] || []).push(row);
          return acc;
        }, {} as Record<string, DematHoldingRow[]>);

        return Object.entries(grouped).map(([dp, groupRows], gIdx) => (
          <Card key={dp} className="bg-white shadow-sm border border-gray-200 mt-6">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>DP: {dp}</CardTitle>
                <div className="text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded-md">Holdings: {groupRows.length}</div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-center">S.N</TableHead>
                      <TableHead>Scrip</TableHead>
                      <TableHead className="text-right">Total Balance</TableHead>
                      <TableHead className="text-right">Actual DEMAT</TableHead>
                      <TableHead className="text-right">LTP (Fiscal Year)</TableHead>
                      <TableHead className="text-right">Value @ LTP</TableHead>
                      <TableHead className="text-right">WACC</TableHead>
                      <TableHead className="text-right">Price Margin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupRows.map((r, idx) => {
                      const currentLTP = editingFields[r.symbol]?.ltp || r.today_closing_price;
                      const marginColor = r.price_margin_percent > 0 ? "text-green-600" : (r.price_margin_percent < 0 ? "text-red-600" : "text-gray-600");
                      const marginBar = r.price_margin_percent > 0 ? "bg-green-400" : (r.price_margin_percent < 0 ? "bg-red-400" : "bg-gray-400");
                      const currentMarginPercent = ((currentLTP - (editingFields[r.symbol]?.wacc || r.wacc)) / (editingFields[r.symbol]?.wacc || r.wacc)) * 100 || 0;
                      return (
                        <TableRow key={r.symbol}>
                          <TableCell className="text-center">{idx + 1}</TableCell>
                          <TableCell>{r.company}<br /><span className="text-xs text-gray-500">{r.symbol}</span></TableCell>
                          <TableCell className="text-right">{r.current_balance}</TableCell>
                          <TableCell className="text-right">{r.demat}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center gap-2 justify-end">
                              <span className="text-sm">Rs.</span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={editingFields[r.symbol]?.ltp || r.today_closing_price}
                                onChange={(e) => handleFieldChange(r.symbol, 'ltp', e.target.value)}
                                className="w-24 h-8 text-right"
                                disabled={!isAdmin}
                              />
                              {isAdmin &&
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSaveClick(r.symbol, 'ltp', r)}
                                disabled={loading || (editingFields[r.symbol]?.ltp === undefined || editingFields[r.symbol]?.ltp === r.today_closing_price)}
                                className="h-8 w-8 p-0"
                              >
                                <Save className="h-3 w-3" />
                              </Button>
                    }
                            </div>
                          </TableCell>
                          <TableCell className="text-right">Rs. {((currentLTP) * r.demat).toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center gap-2 justify-end">
                              <span className="text-sm">Rs.</span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={editingFields[r.symbol]?.wacc || r.wacc}
                                onChange={(e) => handleFieldChange(r.symbol, 'wacc', e.target.value)}
                                className="w-24 h-8 text-right"
                                disabled={!isAdmin}
                              />
                              {isAdmin && 
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSaveClick(r.symbol, 'wacc', r)}
                                disabled={loading || (editingFields[r.symbol]?.wacc === undefined || editingFields[r.symbol]?.wacc === r.wacc)}
                                className="h-8 w-8 p-0"
                              >
                                <Save className="h-3 w-3" />
                              </Button>
                    }
                            </div>
                          </TableCell>
                          <TableCell className={`text-right ${marginColor}`}>
                            <div className="flex items-center gap-2 justify-end">
                              <div className="w-20 h-1.5 bg-gray-200 rounded">
                                <div className={`h-1.5 rounded ${marginBar}`} style={{ width: `${Math.min(100, Math.abs(currentMarginPercent))}%` }} />
                              </div>
                              {currentMarginPercent.toFixed(2)}%
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ));
      }, [rows, editingFields, loading])}
      
      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Update</AlertDialogTitle>
            <AlertDialogDescription>
              {currentUpdate && (
                <div className="space-y-2">
                  <p>
                    Are you sure you want to update the <strong>{currentUpdate.field.toUpperCase()}</strong> for <strong>{currentUpdate.symbol}</strong>?
                  </p>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <div className="text-sm">
                      <p><strong>Current Value:</strong> Rs. {currentUpdate.field === 'ltp' ? currentUpdate.row.today_closing_price.toFixed(2) : currentUpdate.row.wacc.toFixed(2)}</p>
                      <p><strong>New Value:</strong> Rs. {currentUpdate.value.toFixed(2)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600">
                    This action will update the {currentUpdate.field === 'ltp' ? 'market snapshot' : 'symbol holdings'} table and create an audit log entry.
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelUpdate}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmedUpdate}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Check className="w-4 h-4 mr-2" />
              Update {currentUpdate?.field.toUpperCase()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
