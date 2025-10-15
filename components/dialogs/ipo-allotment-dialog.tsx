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
import { uploadIPOAllotment } from "@/app/api/ipoAllotmentAPI/actions"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { fetchClientsFor, getFunds } from "@/app/api/fundsAPI/actions"
import { getListed } from "@/app/api/listedAPI/actions"
import { TrendingUp, Star } from "lucide-react"

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

type StockInfo = {
  symbol: string,
  full_form: string,
  sector_id: number,
  sectors: {
    sector_name: string,
    instrument_type: string
  }
}

interface IPOAllotmentDialogProps {
  onSuccess?: () => void;
}

export function IPOAllotmentDialog({ onSuccess }: IPOAllotmentDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentFund, setCurrentFund] = useState<string>('')
  const [listFunds, setListFunds] = useState<response_funds[]>()
  const [currentClient, setCurrentClient] = useState<string>('')
  const [listClients, setListClients] = useState<cbMAP[]>()
  const [currentSymbol, setCurrentSymbol] = useState<string>('')
  const [listStocks, setListStocks] = useState<StockInfo[]>()

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

  const fetchStocks = async () => {
    const fetch_stocks: StockInfo[] = await getListed()
    setListStocks(fetch_stocks)
  }

  const setFund = (value: string) => {
    setCurrentFund(value)
  }

  const setClient = (value: string) => {
    setCurrentClient(value)
  }

  const setSymbol = (value: string) => {
    setCurrentSymbol(value)
  }

  useEffect(() => {
    if (isOpen) {
      fetchFunds();
      fetchStocks();
    }
  }, [isOpen])

  useEffect(() => {
    if (currentFund) {
      fetchClients();
    }
  }, [currentFund])

  async function handleIPOAllotment(formData: FormData) {
    const stock_quantity = Number(formData.get('given_quantity'))
    const stock_price = Number(formData.get('given_price'));
    const stock_added_at = formData.get('given_date') as string;

    if (!currentFund || !currentClient || !currentSymbol) {
      toast.error('Please select fund, client, and symbol.')
      return
    }

    if (!stock_quantity || !stock_price || !stock_added_at) {
      toast.error('Please fill in all required fields.')
      return
    }

    try {
      setIsLoading(true);
      const result = await uploadIPOAllotment(currentFund, currentClient, currentSymbol, stock_quantity, stock_price, stock_added_at)
      
      if (result.success) {
        toast.success('IPO allotment record added successfully!')
        setIsOpen(false);
        onSuccess?.();
        // Reset form
        setCurrentFund('');
        setCurrentClient('');
        setCurrentSymbol('');
      } else {
        toast.error(result.error || 'Failed to add IPO allotment record')
      }
    } catch (error) {
      console.error('Error adding IPO allotment record:', error)
      toast.error('Failed to add IPO allotment record. Please try again.')
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white shadow-lg">
          <Star className="w-4 h-4 mr-2" />
          Add IPO Allotment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-indigo-700">
            <Star className="w-5 h-5" />
            Add IPO Allotment Record
          </DialogTitle>
        </DialogHeader>
        
        <form action={handleIPOAllotment} id="ipo-allotment-form">
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
                <Label htmlFor="symbol">Stock Symbol</Label>
                <Select name="symbol" onValueChange={setSymbol} required>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Stock Symbol" />
                  </SelectTrigger>
                  <SelectContent>
                    {listStocks?.map((stock) => (
                      <SelectItem value={stock.symbol} key={stock.symbol}>
                        {stock.symbol} - {stock.full_form}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-3">
                <Label htmlFor="given_quantity">Quantity Allotted</Label>
                <Input name="given_quantity" type="number" placeholder="Eg. 200 Shares" step="1" required />
              </div>

              <div className="grid gap-3">
                <Label htmlFor="given_price">Price Per Share</Label>
                <Input name="given_price" type="number" placeholder="Eg. 100" step="0.01" required />
              </div>

              <div className="grid gap-3">
                <Label htmlFor="given_date">Allotment Date</Label>
                <Input name="given_date" type="date" required />
              </div>

              <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-indigo-600" />
                  <span className="text-sm font-medium text-indigo-800">IPO Allotment Info</span>
                </div>
                <p className="text-xs text-indigo-600">
                  This record will track IPO share allotments for the selected client. 
                  The total value will be calculated automatically based on quantity × price.
                </p>
              </div>
            </CardContent>

            <CardFooter className="flex justify-end">
              <Button type="submit" form="ipo-allotment-form" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700">
                {isLoading ? 'Adding...' : 'Save changes'}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </DialogContent>
    </Dialog>
  )
}