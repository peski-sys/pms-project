"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { getFunds } from "@/app/api/fundsAPI/actions"
import { 
  getCurrentFiscalYear,
  getStockDistribution,
  getFundHoldings,
  getFundStocks,
  processStockTransfer,
  getClientsForFund,
  StockDistribution
} from "@/app/api/stockTransferAPI/actions"
import { Split, Plus, X, AlertCircle, ArrowRight, Check } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AutocompleteInput } from "@/components/ui/autocomplete-input"

type Fund = {
  fund_id: number
  fund_name: string
  uploaded_at: Date | null
}

type ClientTransfer = {
  id: string
  client_id: string
  client_name: string
  quantity: number
  isSource: boolean
  originalQuantity?: number
  opening_quantity?: number
  added_quantity?: number
}

interface StockSplitterDialogProps {
  onSuccess?: () => void
}

export function StockSplitterDialog({ onSuccess }: StockSplitterDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  // Fund and fiscal year
  const [funds, setFunds] = useState<Fund[]>([])
  const [selectedFund, setSelectedFund] = useState<number | null>(null)
  const [fiscalYearId, setFiscalYearId] = useState<number | null>(null)
  const [fiscalYear, setFiscalYear] = useState<string>('')
  
  // Stock selection
  const [availableStocks, setAvailableStocks] = useState<Array<{ symbol: string; total_quantity: number }>>([])
  const [selectedSymbol, setSelectedSymbol] = useState<string>('')
  const [totalFundHoldings, setTotalFundHoldings] = useState<number>(0)
  
  // Distribution data
  const [currentDistribution, setCurrentDistribution] = useState<StockDistribution[]>([])
  const [clientTransfers, setClientTransfers] = useState<ClientTransfer[]>([])
  
  // Available clients for adding
  const [availableClients, setAvailableClients] = useState<Array<{ client_id: string; client_name: string }>>([])
  
  // Validation
  const [validationError, setValidationError] = useState<string>('')

  // Load funds on dialog open
  useEffect(() => {
    if (isOpen) {
      loadInitialData()
    } else {
      resetState()
    }
  }, [isOpen])

  // Load stocks when fund is selected
  useEffect(() => {
    if (selectedFund && fiscalYearId) {
      loadFundStocks()
      loadAvailableClients()
    }
  }, [selectedFund, fiscalYearId])

  // Load distribution when symbol is selected
  useEffect(() => {
    if (selectedFund && fiscalYearId && selectedSymbol) {
      loadDistribution()
    }
  }, [selectedSymbol, selectedFund, fiscalYearId])

  // Validate transfers whenever they change
  useEffect(() => {
    validateTransfers()
  }, [clientTransfers])

  const loadInitialData = async () => {
    try {
      // Load funds
      const fundsResult = await getFunds()
      if (fundsResult.success && fundsResult.data) {
        setFunds(fundsResult.data)
        
        // Set first fund as default
        if (fundsResult.data.length > 0) {
          setSelectedFund(fundsResult.data[0].fund_id)
        }
      }
      
      // Load current fiscal year
      const fiscalYearResult = await getCurrentFiscalYear()
      if (fiscalYearResult.success) {
        setFiscalYearId(fiscalYearResult.fiscal_year_id!)
        setFiscalYear(fiscalYearResult.fiscal_year!)
      } else {
        toast.error(fiscalYearResult.error || 'Failed to load fiscal year')
      }
    } catch (error) {
      console.error('Error loading initial data:', error)
      toast.error('Failed to load initial data')
    }
  }

  const loadFundStocks = async () => {
    if (!selectedFund || !fiscalYearId) return
    
    try {
      const result = await getFundStocks(selectedFund, fiscalYearId)
      if (result.success && result.stocks) {
        setAvailableStocks(result.stocks)
      }
    } catch (error) {
      console.error('Error loading stocks:', error)
    }
  }

  const loadAvailableClients = async () => {
    if (!selectedFund) return
    
    try {
      const result = await getClientsForFund(selectedFund)
      if (result.success && result.clients) {
        setAvailableClients(result.clients)
      }
    } catch (error) {
      console.error('Error loading clients:', error)
    }
  }

  const loadDistribution = async () => {
    if (!selectedFund || !fiscalYearId || !selectedSymbol) return
    
    setIsLoading(true)
    try {
      // Get distribution
      const distResult = await getStockDistribution(selectedFund, fiscalYearId, selectedSymbol)
      if (distResult.success && distResult.data) {
        setCurrentDistribution(distResult.data)
        
        // Initialize client transfers with current holdings
        const transfers: ClientTransfer[] = distResult.data.map((dist, index) => ({
          id: `${dist.client_id}-${index}`,
          client_id: dist.client_id,
          client_name: dist.client_name,
          quantity: dist.total_quantity,
          isSource: true,
          originalQuantity: dist.total_quantity,
          opening_quantity: dist.opening_quantity,
          added_quantity: dist.added_quantity
        }))
        
        setClientTransfers(transfers)
      }
      
      // Get total fund holdings
      const holdingsResult = await getFundHoldings(selectedFund, fiscalYearId, selectedSymbol)
      if (holdingsResult.success) {
        setTotalFundHoldings(holdingsResult.total_quantity || 0)
      }
    } catch (error) {
      console.error('Error loading distribution:', error)
      toast.error('Failed to load stock distribution')
    } finally {
      setIsLoading(false)
    }
  }

  const validateTransfers = () => {
    if (clientTransfers.length === 0) {
      setValidationError('')
      return
    }

    const totalAllocated = clientTransfers.reduce((sum, t) => sum + t.quantity, 0)
    
    if (totalAllocated !== totalFundHoldings) {
      setValidationError(`Total must equal ${totalFundHoldings.toLocaleString()} shares. Currently: ${totalAllocated.toLocaleString()}`)
    } else {
      setValidationError('')
    }
  }

  const handleQuantityChange = (transferId: string, newQuantity: number) => {
    setClientTransfers(prev => 
      prev.map(t => 
        t.id === transferId 
          ? { ...t, quantity: Math.max(0, newQuantity) }
          : t
      )
    )
  }

  const handleAddClient = (clientId: string) => {
    const client = availableClients.find(c => c.client_id === clientId)
    if (!client) return
    
    // Check if client already exists
    if (clientTransfers.some(t => t.client_id === clientId)) {
      toast.error('Client already added')
      return
    }
    
    const newTransfer: ClientTransfer = {
      id: `new-${Date.now()}-${clientId}`,
      client_id: clientId,
      client_name: client.client_name,
      quantity: 0,
      isSource: false,
      originalQuantity: 0
    }
    
    setClientTransfers(prev => [...prev, newTransfer])
  }

  const handleRemoveClient = (transferId: string) => {
    const transfer = clientTransfers.find(t => t.id === transferId)
    if (transfer && transfer.originalQuantity && transfer.originalQuantity > 0) {
      toast.error('Cannot remove client with existing holdings. Set quantity to 0 instead.')
      return
    }
    
    setClientTransfers(prev => prev.filter(t => t.id !== transferId))
  }

  const handleTransfer = async () => {
    if (!selectedFund || !fiscalYearId || !selectedSymbol) {
      toast.error('Please select fund, fiscal year, and stock')
      return
    }

    if (validationError) {
      toast.error(validationError)
      return
    }

    // Prepare transfer data
    const transfers = []
    
    for (const transfer of clientTransfers) {
      const originalQty = transfer.originalQuantity || 0
      const newQty = transfer.quantity
      
      if (newQty < originalQty) {
        // Client is a source (reducing holdings)
        transfers.push({
          client_id: transfer.client_id,
          quantity: originalQty - newQty,
          transfer_type: 'SOURCE' as const
        })
      } else if (newQty > originalQty) {
        // Client is a destination (increasing holdings)
        transfers.push({
          client_id: transfer.client_id,
          quantity: newQty - originalQty,
          transfer_type: 'DESTINATION' as const
        })
      }
      // If equal, no transfer needed for this client
    }

    if (transfers.length === 0) {
      toast.error('No changes detected')
      return
    }

    setIsLoading(true)
    try {
      const result = await processStockTransfer(
        selectedFund,
        fiscalYearId,
        selectedSymbol,
        transfers,
        undefined, // initiated_by will be set by backend if needed
        `Stock split transfer for ${selectedSymbol}`
      )

      // Handle both nested and flat response structures
      const transferResult = (result as any).process_stock_transfer || result
      
      if (transferResult.success) {
        toast.success(transferResult.message || 'Stock transfer completed successfully')
        setIsOpen(false)
        onSuccess?.()
      } else {
        toast.error(transferResult.error || 'Transfer failed')
      }
    } catch (error) {
      console.error('Error processing transfer:', error)
      toast.error('Failed to process transfer')
    } finally {
      setIsLoading(false)
    }
  }

  const resetState = () => {
    setSelectedSymbol('')
    setCurrentDistribution([])
    setClientTransfers([])
    setValidationError('')
    setTotalFundHoldings(0)
  }

  const getClientOptions = () => {
    const existingClientIds = clientTransfers.map(t => t.client_id)
    return availableClients.filter(c => !existingClientIds.includes(c.client_id))
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-lg"
          data-stock-splitter-trigger
          title="Stock Splitter (Alt+X)"
        >
          <Split className="w-4 h-4 mr-2" />
          Stock Splitter
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-purple-700">
            <Split className="w-5 h-5" />
            Stock Splitter - Redistribute Holdings
          </DialogTitle>
          <DialogDescription>
            Transfer stock holdings between clients within the same fund and fiscal year
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {/* Fund Selection */}
          <div className="grid gap-2">
            <Label htmlFor="fund">Fund</Label>
            <Select 
              value={selectedFund?.toString()} 
              onValueChange={(value) => {
                setSelectedFund(Number(value))
                resetState()
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Fund" />
              </SelectTrigger>
              <SelectContent>
                {funds.map((fund) => (
                  <SelectItem key={fund.fund_id} value={fund.fund_id.toString()}>
                    {fund.fund_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fiscal Year Display */}
          <div className="grid gap-2">
            <Label>Fiscal Year</Label>
            <Input 
              value={fiscalYear} 
              disabled 
              className="bg-gray-50"
            />
          </div>

          {/* Stock Selection */}
          <div className="grid gap-2">
            <Label htmlFor="symbol">Stock Symbol</Label>
            <AutocompleteInput
              name="symbol"
              placeholder="Select stock symbol"
              defaultValue={selectedSymbol}
              onValueChange={(value) => setSelectedSymbol(value)}
            />
            {totalFundHoldings > 0 && (
              <p className="text-sm text-gray-600">
                Total Fund Holdings: <span className="font-semibold">{totalFundHoldings.toLocaleString()} shares</span>
              </p>
            )}
          </div>

          {/* Distribution Management */}
          {selectedSymbol && currentDistribution.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span>Client Distribution</span>
                  <span className="text-purple-600">
                    {clientTransfers.reduce((sum, t) => sum + t.quantity, 0).toLocaleString()} / {totalFundHoldings.toLocaleString()}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {clientTransfers.map((transfer) => (
                  <div key={transfer.id} className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{transfer.client_id}</span>
                        <span className="text-xs text-gray-500">{transfer.client_name}</span>
                        {transfer.originalQuantity && transfer.originalQuantity > 0 && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                            Original: {transfer.originalQuantity.toLocaleString()}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          value={transfer.quantity}
                          onChange={(e) => handleQuantityChange(transfer.id, Number(e.target.value) || 0)}
                          className="w-32"
                        />
                        <span className="text-xs text-gray-500">shares</span>
                        {transfer.originalQuantity !== undefined && transfer.quantity !== transfer.originalQuantity && (
                          <span className={`text-xs px-2 py-1 rounded ${
                            transfer.quantity > transfer.originalQuantity 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {transfer.quantity > transfer.originalQuantity ? '+' : ''}
                            {(transfer.quantity - transfer.originalQuantity).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    {(!transfer.originalQuantity || transfer.originalQuantity === 0) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveClient(transfer.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}

                {/* Add Client */}
                {getClientOptions().length > 0 && (
                  <div className="pt-2 border-t">
                    <Select onValueChange={handleAddClient}>
                      <SelectTrigger className="w-full">
                        <div className="flex items-center gap-2">
                          <Plus className="w-4 h-4" />
                          <span>Add Client</span>
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {getClientOptions().map((client) => (
                          <SelectItem key={client.client_id} value={client.client_id}>
                            {client.client_id} - {client.client_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>

              {/* Validation Alert */}
              {validationError && (
                <CardContent className="pt-0">
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{validationError}</AlertDescription>
                  </Alert>
                </CardContent>
              )}

              {!validationError && clientTransfers.length > 0 && (
                <CardContent className="pt-0">
                  <Alert className="bg-green-50 border-green-200">
                    <Check className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      Distribution is balanced. Ready to transfer.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              )}

              <CardFooter className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleTransfer}
                  disabled={isLoading || !!validationError || clientTransfers.length === 0}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {isLoading ? 'Processing...' : (
                    <>
                      <ArrowRight className="w-4 h-4 mr-2" />
                      Execute Transfer
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* No holdings message */}
          {selectedSymbol && currentDistribution.length === 0 && !isLoading && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No holdings found for {selectedSymbol} in the selected fund and fiscal year.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
