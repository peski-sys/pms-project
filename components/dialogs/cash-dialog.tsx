"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AutocompleteInput } from "@/components/ui/autocomplete-input"
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { uploadCash, uploadCashStaging } from "@/app/api/sidebarAPIs/actions"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { fetchClientsFor, getFunds } from "@/app/api/fundsAPI/actions"
import { DollarSign, Star } from "lucide-react"

type response_funds = {
  fund_id: number,
  fund_name: string,
  uploaded_at: Date | null,
}

type cbMAP = {
  client_id: string,
  client_name: string,
  client_broker: number,
  recorded_at: Date | null,
}

interface CashDialogProps {
  onSuccess?: () => void;
}

export function CashDialog({ onSuccess }: CashDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'demat' | 'non-demat'>('demat')
  const [currentFund, setCurrentFund] = useState<string>('')
  const [listFunds, setListFunds] = useState<response_funds[]>()
  const [currentClient, setCurrentClient] = useState<string>('')
  const [listClients, setListClients] = useState<cbMAP[]>()

  const [cashSymbol, setCashSymbol] = useState<string>('')
  const [cashAmountPerShare, setCashAmountPerShare] = useState<number>(0)
  const [calculatedCashAmount, setCalculatedCashAmount] = useState<number>(0)
  const [cashCurrentHoldings, setCashCurrentHoldings] = useState<number>(0)
  const [stagingTotalHoldings, setStagingTotalHoldings] = useState<number>(0)

  const fetchFunds = async () => {
    const fundsResponse = await getFunds();
    const fetch_funds: response_funds[] = fundsResponse.success ? fundsResponse.data : [];
    setListFunds(fetch_funds)
    // Set first fund as default
    if (fetch_funds.length > 0 && !currentFund) {
      setCurrentFund(fetch_funds[0].fund_name)
    }
  }

  const fetchClients = async () => {
    if (activeTab === 'demat') {
      const fetch_clients: cbMAP[] = await fetchClientsFor(currentFund)
      setListClients(fetch_clients)
    } else {
      setListClients([])
    }
  }

  const setFund = (value: string) => {
    setCurrentFund(value)
    setCurrentClient('')
    resetCashCalculation()
  }

  const setClient = (value: string) => {
    setCurrentClient(value)
    resetCashCalculation()
  }

  useEffect(() => {
    if (activeTab !== 'demat') {
      return
    }

    const calculateCashDemat = async () => {
      if (currentFund && currentClient && cashSymbol) {
        try {
          const { getCurrentHoldings } = await import('@/app/api/sidebarAPIs/actions')
          const holdingsData = await getCurrentHoldings(currentFund, currentClient, cashSymbol)

          if (holdingsData.success && holdingsData.quantity > 0) {
            setCashCurrentHoldings(holdingsData.quantity)
            setStagingTotalHoldings(0)
            return
          }
        } catch (error) {
          console.error('Error fetching holdings for cash:', error)
        }
      }

      setCashCurrentHoldings(0)
      setStagingTotalHoldings(0)
    }

    const timeoutId = setTimeout(calculateCashDemat, 500)
    return () => clearTimeout(timeoutId)
  }, [activeTab, currentFund, currentClient, cashSymbol])

  useEffect(() => {
    if (activeTab !== 'non-demat') {
      return
    }

    const calculateCashStaging = async () => {
      if (currentFund && cashSymbol) {
        try {
          const { getStagingHoldings } = await import('@/app/api/sidebarAPIs/actions')
          const holdingsData = await getStagingHoldings(currentFund, cashSymbol)

          if (holdingsData.success && holdingsData.quantity > 0) {
            setCashCurrentHoldings(holdingsData.quantity)
            setStagingTotalHoldings(holdingsData.totalQuantity || holdingsData.quantity)
            return
          }
        } catch (error) {
          console.error('Error fetching staging holdings for cash:', error)
        }
      }

      setCashCurrentHoldings(0)
      setStagingTotalHoldings(0)
    }

    const timeoutId = setTimeout(calculateCashStaging, 500)
    return () => clearTimeout(timeoutId)
  }, [activeTab, currentFund, cashSymbol])

  useEffect(() => {
    const total = cashAmountPerShare > 0 && cashCurrentHoldings > 0
      ? cashAmountPerShare * cashCurrentHoldings
      : 0
    setCalculatedCashAmount(total)
  }, [cashAmountPerShare, cashCurrentHoldings])

  const resetCashCalculation = () => {
    setCashSymbol('')
    setCashAmountPerShare(0)
    setCalculatedCashAmount(0)
    setCashCurrentHoldings(0)
    setStagingTotalHoldings(0)
  }

  useEffect(() => {
    if (isOpen) {
      fetchFunds();
    }
  }, [isOpen])

  useEffect(() => {
    if (currentFund && activeTab === 'demat') {
      fetchClients();
    }
  }, [currentFund, activeTab])

  async function handleCash(formData: FormData) {
    const stock_symbol = formData.get('given_symbol') as string;
    const stock_cash_amount = Number(formData.get('given_cash_amount'));
    const stock_book_close = formData.get('given_book_close') as string;

    if (!currentFund) {
      toast.error('Please select fund.')
      return
    }

    if (activeTab === 'demat' && !currentClient) {
      toast.error('Please select a client.')
      return
    }

    if (!stock_symbol || !stock_cash_amount || !stock_book_close) {
      toast.error('Please fill in all required fields.')
      return
    }

    const resolvedAmount = calculatedCashAmount > 0 ? calculatedCashAmount : stock_cash_amount

    if (resolvedAmount <= 0) {
      toast.error('Calculated cash amount must be greater than 0.')
      return
    }

    try {
      setIsLoading(true);
      let result;
      
      if (activeTab === 'demat') {
        result = await uploadCash(currentFund, currentClient, stock_symbol, resolvedAmount, stock_book_close)
      } else {
        result = await uploadCashStaging(currentFund, stock_symbol, resolvedAmount, stock_book_close)
      }
      
      if (result.success) {
        toast.success(result.message || (activeTab === 'demat' ? 'Cash dividend added successfully!' : 'Cash staging record added successfully!'))
        resetCashCalculation()
        setIsOpen(false);
        onSuccess?.();
        // Reset form
        setCurrentFund('');
        setCurrentClient('');
        setActiveTab('demat')
      } else {
        toast.error(result.error || 'Failed to add cash dividend')
      }
    } catch (error) {
      console.error('Error adding cash dividend:', error)
      toast.error('Failed to add cash dividend. Please try again.')
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg"
          data-cash-dialog-trigger
          title="Add Cash (Alt+C)"
        >
          <DollarSign className="w-4 h-4 mr-2" />
          Add Cash
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-700">
            <DollarSign className="w-5 h-5" />
            Add Cash Dividend
          </DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'demat' | 'non-demat')} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="demat" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              DEMAT (Allocated)
            </TabsTrigger>
            <TabsTrigger value="non-demat" className="flex items-center gap-2">
              <Star className="w-4 h-4" />
              Non-DEMAT (Pending)
            </TabsTrigger>
          </TabsList>

          <form action={handleCash} id="cash-form">
            <Card className="mt-4">
              <CardContent className="grid gap-6">
              <div className="grid gap-3">
                <Label htmlFor="fund">Fund</Label>
                <Select name="fund" onValueChange={setFund} value={currentFund} required>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Fund" />
                  </SelectTrigger>
                  <SelectContent>
                    {listFunds?.map((details) => (
                      <SelectItem value={details.fund_name} key={details.fund_id}>
                        {details.fund_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <TabsContent value="demat" className="mt-0">
                <div className="grid gap-3">
                  <Label htmlFor="client">Client ID</Label>
                  <Select name="client" onValueChange={setClient} required={activeTab === 'demat'} value={currentClient}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Client" />
                    </SelectTrigger>
                    <SelectContent>
                      {listClients?.map((details) => (
                        <SelectItem value={details.client_id} key={details.client_id}>
                          {details.client_id} | Broker: {details.client_broker}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="non-demat" className="mt-0">
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-800">Non-DEMAT Notice</span>
                  </div>
                  <p className="text-xs text-amber-700">
                    This cash dividend will be staged without assigning a client. You can dematerialize it later from manual stock history.
                  </p>
                </div>
              </TabsContent>

              <div className="grid gap-3">
                <Label htmlFor="given_symbol">Stock Symbol</Label>
                <AutocompleteInput 
                  name="given_symbol" 
                  placeholder="Eg. NABIL" 
                  required 
                  onValueChange={(value) => setCashSymbol(value)}
                />
              </div>

              <div className="grid gap-3">
                <Label htmlFor="given_cash_amount">Cash Amount</Label>
                <Input 
                  name="given_cash_amount" 
                  type="number" 
                  placeholder="Eg. 6000" 
                  step="0.01" 
                  required 
                  value={cashAmountPerShare || ''}
                  onChange={(e) => setCashAmountPerShare(Number(e.target.value) || 0)}
                />
              </div>

              <div className="grid gap-3">
                <Label htmlFor="given_book_close">Book Close Date</Label>
                <Input name="given_book_close" type="date" required />
              </div>

              {currentFund && cashSymbol && cashAmountPerShare > 0 && (
                <div className={`grid gap-3 ${activeTab === 'demat' ? '' : 'mt-3'}`}>
                  <div className={`${activeTab === 'demat' ? 'bg-orange-50 border border-orange-200' : 'bg-amber-100 border border-amber-200'} p-3 rounded`}>
                    <Label className={`text-sm font-medium ${activeTab === 'demat' ? 'text-orange-800' : 'text-amber-800'}`}>Cash Amount Preview</Label>
                    <Input 
                      type="number"
                      required
                      className="mt-2 mb-2"
                      value={calculatedCashAmount}
                      onChange={(e) => setCalculatedCashAmount(Number(e.target.value) || 0)}
                    />
                    <div className={`text-sm font-semibold ${activeTab === 'demat' ? 'text-orange-700' : 'text-amber-700'}`}>
                      {calculatedCashAmount > 0 ? `₹${calculatedCashAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : 'Awaiting holdings...'}
                    </div>
                    <div className={`text-xs ${activeTab === 'demat' ? 'text-orange-600' : 'text-amber-600'}`}>
                      Based on {cashCurrentHoldings.toLocaleString()} holdings {activeTab === 'non-demat' && stagingTotalHoldings > 0 && stagingTotalHoldings !== cashCurrentHoldings ? `(Total staging quantity: ${stagingTotalHoldings.toLocaleString()} shares)` : ''}
                    </div>
                    <div className={`text-xs ${activeTab === 'demat' ? 'text-orange-500' : 'text-amber-500'} mt-1`}>
                      Calculation uses Rs. {cashAmountPerShare} per share.
                    </div>
                  </div>
                </div>
              )}
              </CardContent>

              <CardFooter className="flex justify-end">
                <Button type="submit" form="cash-form" disabled={isLoading} className="bg-orange-600 hover:bg-orange-700">
                  {isLoading ? 'Adding...' : activeTab === 'demat' ? 'Save changes' : 'Save to Staging'}
                </Button>
              </CardFooter>
            </Card>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}