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
import { uploadBonus, uploadBonusStaging } from "@/app/api/sidebarAPIs/actions"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { fetchClientsFor, getFunds } from "@/app/api/fundsAPI/actions"
import { Star, TrendingUp } from "lucide-react"

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

interface BonusDialogProps {
  onSuccess?: () => void;
}

export function BonusDialog({ onSuccess }: BonusDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'demat' | 'non-demat'>('demat')
  const [currentFund, setCurrentFund] = useState<string>('')
  const [listFunds, setListFunds] = useState<response_funds[]>()
  const [currentClient, setCurrentClient] = useState<string>('')
  const [listClients, setListClients] = useState<cbMAP[]>()
  
  // Bonus calculation states
  const [bonusSymbol, setBonusSymbol] = useState<string>('')
  const [bonusPercent, setBonusPercent] = useState<number>(0)
  const [calculatedBonusShares, setCalculatedBonusShares] = useState<number>(0)
  const [currentHoldings, setCurrentHoldings] = useState<number>(0)
  const [stagingTotalHoldings, setStagingTotalHoldings] = useState<number>(0)

  const fetchFunds = async () => {
    const fetch_funds: response_funds[] = await getFunds();
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
    resetBonusCalculation()
    setCurrentClient('')
  }

  const setClient = (value: string) => {
    setCurrentClient(value)
    resetBonusCalculation()
  }

  // Simple bonus calculation effect using existing API
  useEffect(() => {
    if (activeTab !== 'demat') {
      return
    }

    const calculateBonus = async () => {
      if (currentFund && currentClient && bonusSymbol && bonusPercent > 0) {
        try {
          const { getCurrentHoldings } = await import('@/app/api/sidebarAPIs/actions')
          const holdingsData = await getCurrentHoldings(currentFund, currentClient, bonusSymbol)
          
          if (holdingsData.success && holdingsData.quantity > 0) {
            const bonusShares = Math.floor((holdingsData.quantity * bonusPercent) / 100)
            setCalculatedBonusShares(bonusShares)
            setCurrentHoldings(holdingsData.quantity)
            setStagingTotalHoldings(0)
            return
          }
        } catch (error) {
          console.error('Error calculating bonus:', error)
        }
      }

      setCalculatedBonusShares(0)
      setCurrentHoldings(0)
      setStagingTotalHoldings(0)
    }
    
    const timeoutId = setTimeout(calculateBonus, 500)
    return () => clearTimeout(timeoutId)
  }, [activeTab, currentFund, currentClient, bonusSymbol, bonusPercent])

  useEffect(() => {
    if (activeTab !== 'non-demat') {
      return
    }

    const calculateStagingBonus = async () => {
      if (currentFund && bonusSymbol && bonusPercent > 0) {
        try {
          const { getStagingHoldings } = await import('@/app/api/sidebarAPIs/actions')
          const holdingsData = await getStagingHoldings(currentFund, bonusSymbol)

          if (holdingsData.success && holdingsData.quantity > 0) {
            const bonusShares = Math.floor((holdingsData.quantity * bonusPercent) / 100)
            setCalculatedBonusShares(bonusShares)
            setCurrentHoldings(holdingsData.quantity)
            setStagingTotalHoldings(holdingsData.totalQuantity || holdingsData.quantity)
            return
          }
        } catch (error) {
          console.error('Error calculating staging bonus:', error)
        }
      }

      setCalculatedBonusShares(0)
      setCurrentHoldings(0)
      setStagingTotalHoldings(0)
    }

    const timeoutId = setTimeout(calculateStagingBonus, 500)
    return () => clearTimeout(timeoutId)
  }, [activeTab, currentFund, bonusSymbol, bonusPercent])

  const resetBonusCalculation = () => {
    setBonusSymbol('')
    setBonusPercent(0)
    setCalculatedBonusShares(0)
    setCurrentHoldings(0)
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

  async function handleBonus(formData: FormData) {
    const stock_symbol = formData.get('given_symbol') as string;
    const stock_bonus_percent = Number(formData.get('given_bonus_percent'))
    const book_close = formData.get('given_book_close') as string;
    const price_per_share = Number(formData.get('given_price'));

    if (!currentFund) {
      toast.error('Please select fund.')
      return
    }

    if (activeTab === 'demat' && !currentClient) {
      toast.error('Please select a client.')
      return
    }

    if (!stock_symbol || !book_close || !price_per_share) {
      toast.error('Please fill in all required fields.')
      return
    }

    try {
      setIsLoading(true);
      if (activeTab === 'demat') {
        await uploadBonus(currentFund, currentClient, stock_symbol, stock_bonus_percent, calculatedBonusShares, book_close, price_per_share)
      } else {
        await uploadBonusStaging(currentFund, stock_symbol, stock_bonus_percent, calculatedBonusShares, book_close, price_per_share)
      }
      toast.success(activeTab === 'demat' ? 'Bonus shares added successfully!' : 'Bonus staging record added successfully!')
      resetBonusCalculation()
      setIsOpen(false);
      onSuccess?.();
      // Reset form
      setCurrentFund('');
      setCurrentClient('');
      setBonusSymbol('');
      setBonusPercent(0);
      setCalculatedBonusShares(0);
      setActiveTab('demat')
    } catch (error) {
      console.error('Error adding bonus shares:', error)
      toast.error('Failed to add bonus shares. Please try again.')
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg">
          <TrendingUp className="w-4 h-4 mr-2" />
          Add Bonus
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-700">
            <TrendingUp className="w-5 h-5" />
            Add Bonus Shares
          </DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'demat' | 'non-demat')} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="demat" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              DEMAT (Allocated)
            </TabsTrigger>
            <TabsTrigger value="non-demat" className="flex items-center gap-2">
              <Star className="w-4 h-4" />
              Non-DEMAT (Pending)
            </TabsTrigger>
          </TabsList>

          <form action={handleBonus} id="bonus-form">
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
                    This bonus entry will be staged without assigning a client. You can dematerialize it later from manual stock history.
                  </p>
                </div>

                {currentFund && bonusSymbol && bonusPercent > 0 && (
                  <div className="grid gap-3 mt-3">
                    <div className="bg-amber-100 border border-amber-200 p-3 rounded">
                      <Label className="text-sm font-medium text-amber-800">Bonus Shares Preview</Label>
                      <Input
                        type="number"
                        required
                        className="mt-2 mb-2"
                        value={calculatedBonusShares}
                        onChange={(e) => setCalculatedBonusShares(Number(e.target.value) || 0)}
                      />
                      <div className="text-sm font-semibold text-amber-700">
                        {calculatedBonusShares > 0 ? `${calculatedBonusShares.toLocaleString()} bonus shares` : 'Awaiting staging holdings...'}
                      </div>
                      <div className="text-xs text-amber-700">
                        Available non-DEMAT holdings: {currentHoldings.toLocaleString()} shares
                        {stagingTotalHoldings > 0 && stagingTotalHoldings !== currentHoldings && (
                          <span> (Total staging quantity: {stagingTotalHoldings.toLocaleString()} shares)</span>
                        )}
                      </div>
                      <div className="text-xs text-amber-600 mt-1">
                        Calculation uses {bonusPercent}% bonus rate on non-DEMAT staging quantity.
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              <div className="grid gap-3">
                <Label htmlFor="given_symbol">Stock Symbol</Label>
                <AutocompleteInput 
                  name="given_symbol" 
                  required 
                  placeholder="Eg. NABIL"
                  onValueChange={(value) => setBonusSymbol(value)}
                />
              </div>

              <div className="grid gap-3">
                <Label htmlFor="given_bonus_percent">Bonus %</Label>
                <Input 
                  name="given_bonus_percent" 
                  type="number" 
                  required 
                  placeholder="Eg. 7" 
                  step="0.0001"
                  onChange={(e) => setBonusPercent(Number(e.target.value) || 0)}
                />
              </div>
              
              {/* Bonus Shares Preview */}
              {activeTab === 'demat' && currentFund && currentClient && bonusSymbol && bonusPercent > 0 && (
                <div className="grid gap-3">
                  <div className="bg-green-50 border border-green-200 p-3 rounded">
                    <Label className="text-sm font-medium text-green-800">Bonus Shares Preview</Label>
                    <div className="text-lg font-bold text-green-700">
                      <Input 
                        type="number"
                        className="mt-2 mb-2"
                        required
                        value={calculatedBonusShares}
                        onChange={(e) => setCalculatedBonusShares(Number(e.target.value) || 0)} 
                      />
                      {calculatedBonusShares > 0 
                        ? `Bonus shares` 
                        : (currentHoldings > 0 ? `${calculatedBonusShares} bonus shares` : 'Calculating...')}
                    </div>
                    <div className="text-xs text-green-600">
                      {currentHoldings > 0 
                        ? `From ${currentHoldings.toLocaleString()} holdings at ${bonusPercent}% rate`
                        : `Based on ${bonusPercent}% bonus rate`}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid gap-3">
                <Label htmlFor="given_book_close">Book Close Date</Label>
                <Input name="given_book_close" required type="date" />
              </div>

              <div className="grid gap-3">
                <Label htmlFor="given_price">Price Per Share</Label>
                <Input name="given_price" required defaultValue="100" step="0.01" />
              </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-2">
                {activeTab === 'demat' && calculatedBonusShares > 0 && (
                  <div className="text-sm text-green-700 bg-green-50 p-2 rounded border">
                    💡 <strong>{calculatedBonusShares.toLocaleString()} bonus shares</strong> will be added based on {currentHoldings.toLocaleString()} current holdings at {bonusPercent}% bonus rate.
                  </div>
                )}
                <div className="flex justify-end">
                  <Button type="submit" form="bonus-form" disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700">
                    {isLoading ? 'Adding...' : activeTab === 'demat' ? 'Save changes' : 'Save to Staging'}
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}