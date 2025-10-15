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
import { uploadBonus } from "@/app/api/sidebarAPIs/actions"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { fetchClientsFor, getFunds } from "@/app/api/fundsAPI/actions"
import { TrendingUp } from "lucide-react"

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
  const [currentFund, setCurrentFund] = useState<string>('')
  const [listFunds, setListFunds] = useState<response_funds[]>()
  const [currentClient, setCurrentClient] = useState<string>('')
  const [listClients, setListClients] = useState<cbMAP[]>()
  
  // Bonus calculation states
  const [bonusSymbol, setBonusSymbol] = useState<string>('')
  const [bonusPercent, setBonusPercent] = useState<number>(0)
  const [calculatedBonusShares, setCalculatedBonusShares] = useState<number>(0)
  const [currentHoldings, setCurrentHoldings] = useState<number>(0)

  const fetchFunds = async () => {
    const fetch_funds: response_funds[] = await getFunds();
    setListFunds(fetch_funds)
    // Set first fund as default
    if (fetch_funds.length > 0 && !currentFund) {
      setCurrentFund(fetch_funds[0].fund_name)
    }
  }

  const fetchClients = async () => {
    const fetch_clients: cbMAP[] = await fetchClientsFor(currentFund)
    setListClients(fetch_clients)
  }

  const setFund = (value: string) => {
    setCurrentFund(value)
    resetBonusCalculation()
  }

  const setClient = (value: string) => {
    setCurrentClient(value)
    resetBonusCalculation()
  }

  // Simple bonus calculation effect using existing API
  useEffect(() => {
    const calculateBonus = async () => {
      if (currentFund && currentClient && bonusSymbol && bonusPercent > 0) {
        try {
          // Use existing getCurrentHoldings function
          const { getCurrentHoldings } = await import('@/app/api/sidebarAPIs/actions')
          const holdingsData = await getCurrentHoldings(currentFund, currentClient, bonusSymbol)
          
          if (holdingsData.success && holdingsData.quantity > 0) {
            const bonusShares = Math.floor((holdingsData.quantity * bonusPercent) / 100)
            setCalculatedBonusShares(bonusShares)
            setCurrentHoldings(holdingsData.quantity)
          } else {
            setCalculatedBonusShares(0)
            setCurrentHoldings(0)
          }
        } catch (error) {
          console.error('Error calculating bonus:', error)
          setCalculatedBonusShares(0)
          setCurrentHoldings(0)
        }
      } else {
        setCalculatedBonusShares(0)
        setCurrentHoldings(0)
      }
    }
    
    const timeoutId = setTimeout(calculateBonus, 500)
    return () => clearTimeout(timeoutId)
  }, [currentFund, currentClient, bonusSymbol, bonusPercent])

  const resetBonusCalculation = () => {
    setBonusSymbol('')
    setBonusPercent(0)
    setCalculatedBonusShares(0)
    setCurrentHoldings(0)
  }

  useEffect(() => {
    if (isOpen) {
      fetchFunds();
    }
  }, [isOpen])

  useEffect(() => {
    if (currentFund) {
      fetchClients();
    }
  }, [currentFund])

  async function handleBonus(formData: FormData) {
    const stock_symbol = formData.get('given_symbol') as string;
    const stock_bonus_percent = Number(formData.get('given_bonus_percent'))
    const book_close = formData.get('given_book_close') as string;
    const price_per_share = Number(formData.get('given_price'));

    if (!currentFund || !currentClient) {
      toast.error('Please select both fund and client.')
      return
    }

    if (!stock_symbol || !book_close || !price_per_share) {
      toast.error('Please fill in all required fields.')
      return
    }

    try {
      setIsLoading(true);
      await uploadBonus(currentFund, currentClient, stock_symbol, stock_bonus_percent, calculatedBonusShares, book_close, price_per_share)
      toast.success('Bonus shares added successfully!')
      resetBonusCalculation()
      setIsOpen(false);
      onSuccess?.();
      // Reset form
      setCurrentFund('');
      setCurrentClient('');
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
        
        <form action={handleBonus} id="bonus-form">
          <Card>
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

              <div className="grid gap-3">
                <Label htmlFor="client">Client ID</Label>
                <Select name="client" onValueChange={setClient} required>
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
              {currentFund && currentClient && bonusSymbol && bonusPercent > 0 && (
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
              {calculatedBonusShares > 0 && (
                <div className="text-sm text-green-700 bg-green-50 p-2 rounded border">
                  💡 <strong>{calculatedBonusShares.toLocaleString()} bonus shares</strong> will be added based on {currentHoldings.toLocaleString()} current holdings at {bonusPercent}% bonus rate.
                </div>
              )}
              <div className="flex justify-end">
                <Button type="submit" form="bonus-form" disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700">
                  {isLoading ? 'Adding...' : 'Save changes'}
                </Button>
              </div>
            </CardFooter>
          </Card>
        </form>
      </DialogContent>
    </Dialog>
  )
}