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
import { uploadCash } from "@/app/api/sidebarAPIs/actions"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { fetchClientsFor, getFunds } from "@/app/api/fundsAPI/actions"
import { DollarSign } from "lucide-react"

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
  const [currentFund, setCurrentFund] = useState<string>('')
  const [listFunds, setListFunds] = useState<response_funds[]>()
  const [currentClient, setCurrentClient] = useState<string>('')
  const [listClients, setListClients] = useState<cbMAP[]>()

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
  }

  const setClient = (value: string) => {
    setCurrentClient(value)
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

  async function handleCash(formData: FormData) {
    const stock_symbol = formData.get('given_symbol') as string;
    const stock_cash_amount = Number(formData.get('given_cash_amount'));
    const stock_book_close = formData.get('given_book_close') as string;

    if (!currentFund || !currentClient) {
      toast.error('Please select both fund and client.')
      return
    }

    if (!stock_symbol || !stock_cash_amount || !stock_book_close) {
      toast.error('Please fill in all required fields.')
      return
    }

    try {
      setIsLoading(true);
      await uploadCash(currentFund, currentClient, stock_symbol, stock_cash_amount, stock_book_close)
      toast.success('Cash dividend added successfully!')
      setIsOpen(false);
      onSuccess?.();
      // Reset form
      setCurrentFund('');
      setCurrentClient('');
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
        <Button className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg">
          <DollarSign className="w-4 h-4 mr-2" />
          Add Cash
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-700">
            <DollarSign className="w-5 h-5" />
            Add Cash Dividend
          </DialogTitle>
        </DialogHeader>
        
        <form action={handleCash} id="cash-form">
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
                <AutocompleteInput name="given_symbol" placeholder="Eg. NABIL" required />
              </div>

              <div className="grid gap-3">
                <Label htmlFor="given_cash_amount">Cash Amount</Label>
                <Input name="given_cash_amount" type="number" placeholder="Eg. 6000" step="0.01" required />
              </div>

              <div className="grid gap-3">
                <Label htmlFor="given_book_close">Book Close Date</Label>
                <Input name="given_book_close" type="date" required />
              </div>
            </CardContent>

            <CardFooter className="flex justify-end">
              <Button type="submit" form="cash-form" disabled={isLoading} className="bg-orange-600 hover:bg-orange-700">
                {isLoading ? 'Adding...' : 'Save changes'}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </DialogContent>
    </Dialog>
  )
}