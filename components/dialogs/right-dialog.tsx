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
import { uploadRight } from "@/app/api/sidebarAPIs/actions"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { fetchClientsFor, getFunds } from "@/app/api/fundsAPI/actions"
import { ArrowUpRight } from "lucide-react"

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

interface RightDialogProps {
  onSuccess?: () => void;
}

export function RightDialog({ onSuccess }: RightDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentFund, setCurrentFund] = useState<string>('')
  const [listFunds, setListFunds] = useState<response_funds[]>()
  const [currentClient, setCurrentClient] = useState<string>('')
  const [listClients, setListClients] = useState<cbMAP[]>()
  
  // Right shares calculation states
  const [rightSymbol, setRightSymbol] = useState<string>('')
  const [rightRatioFirst, setRightRatioFirst] = useState<number>(0)
  const [rightRatioSecond, setRightRatioSecond] = useState<number>(0)
  const [calculatedRightShares, setCalculatedRightShares] = useState<number>(0)
  const [rightCurrentHoldings, setRightCurrentHoldings] = useState<number>(0)

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
    resetRightCalculation()
  }

  const setClient = (value: string) => {
    setCurrentClient(value)
    resetRightCalculation()
  }

  // Simple right shares calculation effect
  useEffect(() => {
    const calculateRightShares = async () => {
      if (currentFund && currentClient && rightSymbol && rightRatioFirst > 0 && rightRatioSecond > 0) {
        try {
          const { getCurrentHoldings } = await import('@/app/api/sidebarAPIs/actions')
          const holdingsData = await getCurrentHoldings(currentFund, currentClient, rightSymbol)
          
          if (holdingsData.success && holdingsData.quantity > 0) {
            // Calculate right shares: (current holdings * right ratio second) / right ratio first
            const rightShares = Math.floor((holdingsData.quantity * rightRatioSecond) / rightRatioFirst)
            setCalculatedRightShares(rightShares)
            setRightCurrentHoldings(holdingsData.quantity)
          } else {
            setCalculatedRightShares(0)
            setRightCurrentHoldings(0)
          }
        } catch (error) {
          console.error('Error calculating right shares:', error)
          setCalculatedRightShares(0)
          setRightCurrentHoldings(0)
        }
      } else {
        setCalculatedRightShares(0)
        setRightCurrentHoldings(0)
      }
    }
    
    const timeoutId = setTimeout(calculateRightShares, 500)
    return () => clearTimeout(timeoutId)
  }, [currentFund, currentClient, rightSymbol, rightRatioFirst, rightRatioSecond])

  const resetRightCalculation = () => {
    setRightSymbol('')
    setRightRatioFirst(0)
    setRightRatioSecond(0)
    setCalculatedRightShares(0)
    setRightCurrentHoldings(0)
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

  async function handleRight(formData: FormData) {
    const stock_symbol = formData.get('given_symbol') as string;
    const first_right_ratio = Number(formData.get('right_ratio_first'))
    const second_right_ratio = Number(formData.get('right_ratio_second'))
    const stock_book_close = formData.get('given_book_close') as string;
    const stock_price_per_share = Number(formData.get('given_price'));

    if (!currentFund || !currentClient) {
      toast.error('Please select both fund and client.')
      return
    }

    if (!stock_symbol || !first_right_ratio || !second_right_ratio || !stock_book_close || !stock_price_per_share) {
      toast.error('Please fill in all required fields.')
      return
    }

    try {
      setIsLoading(true);
      await uploadRight(currentFund, currentClient, stock_symbol, first_right_ratio, second_right_ratio, calculatedRightShares, stock_book_close, stock_price_per_share)
      toast.success('Right shares added successfully!')
      resetRightCalculation()
      setIsOpen(false);
      onSuccess?.();
      // Reset form
      setCurrentFund('');
      setCurrentClient('');
    } catch (error) {
      console.error('Error adding right shares:', error)
      toast.error('Failed to add right shares. Please try again.')
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg">
          <ArrowUpRight className="w-4 h-4 mr-2" />
          Add Right
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-blue-700">
            <ArrowUpRight className="w-5 h-5" />
            Add Right Shares
          </DialogTitle>
        </DialogHeader>
        
        <form action={handleRight} id="right-form">
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
                  placeholder="Eg. NABIL"
                  required
                  onValueChange={(value) => setRightSymbol(value)}
                />
              </div>
              
              <div className="grid gap-3">
                <Label htmlFor="given_right_ratio">Right Ratio</Label>
                <div className="flex grid-cols-2 items-center gap-2">
                  <Input 
                    name="right_ratio_first" 
                    className="flex-1" 
                    defaultValue="" 
                    type="number" 
                    step={0.00001} 
                    placeholder="Eg. 1" 
                    required
                    onChange={(e) => setRightRatioFirst(Number(e.target.value) || 0)}
                  />
                  <span className="text-gray-500">:</span>
                  <Input 
                    name="right_ratio_second" 
                    className="flex-1" 
                    defaultValue="" 
                    type="number" 
                    step={0.00001} 
                    placeholder="Eg. 0.5" 
                    required
                    onChange={(e) => setRightRatioSecond(Number(e.target.value) || 0)}
                  />
                </div>
              </div>
              
              {/* Right Shares Preview */}
              {currentFund && currentClient && rightSymbol && rightRatioFirst > 0 && rightRatioSecond > 0 && (
                <div className="grid gap-3">
                  <div className="bg-blue-50 border border-blue-200 p-3 rounded">
                    <Label className="text-sm font-medium text-blue-800">Right Shares Preview</Label>
                    <Input 
                      type="number"
                      required
                      className="mt-2 mb-2"
                      value={calculatedRightShares}
                      onChange={(e) => setCalculatedRightShares(Number(e.target.value))}
                    />
                    <div className="text-lg font-bold text-blue-700">
                      {calculatedRightShares > 0 
                        ? `Right shares` 
                        : 'Calculating...'}
                    </div>
                    <div className="text-xs text-blue-600">
                      Based on {rightRatioFirst}:{rightRatioSecond} ratio from {rightCurrentHoldings.toLocaleString()} holdings
                    </div>
                  </div>
                </div>
              )}

              <div className="grid gap-3">
                <Label htmlFor="given_book_close">Book Close Date</Label>
                <Input name="given_book_close" type="date" required />
              </div>

              <div className="grid gap-3">
                <Label htmlFor="given_price">Price Per Share</Label>
                <Input name="given_price" type="number" defaultValue="100" step="0.01" required />
              </div>
            </CardContent>

            <CardFooter className="flex justify-end">
              <Button type="submit" form="right-form" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
                {isLoading ? 'Adding...' : 'Save changes'}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </DialogContent>
    </Dialog>
  )
}