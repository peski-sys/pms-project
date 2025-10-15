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
import { uploadPromoter } from "@/app/api/sidebarAPIs/actions"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { fetchClientsFor, getFunds } from "@/app/api/fundsAPI/actions"
import { Users } from "lucide-react"

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

interface PromoterDialogProps {
  onSuccess?: () => void;
}

export function PromoterDialog({ onSuccess }: PromoterDialogProps) {
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

  async function handlePromoter(formData: FormData) {
    const stock_symbol = formData.get('given_symbol') as string;
    const stock_quantity = Number(formData.get('given_quantity'))
    const stock_price = Number(formData.get('given_price'));
    const stock_added_at = formData.get('given_date') as string;

    if (!currentFund || !currentClient) {
      toast.error('Please select both fund and client.')
      return
    }

    if (!stock_symbol || !stock_quantity || !stock_price || !stock_added_at) {
      toast.error('Please fill in all required fields.')
      return
    }

    try {
      setIsLoading(true);
      await uploadPromoter(currentFund, currentClient, stock_symbol, stock_quantity, stock_price, stock_added_at)
      toast.success('Promoter shares added successfully!')
      setIsOpen(false);
      onSuccess?.();
      // Reset form
      setCurrentFund('');
      setCurrentClient('');
    } catch (error) {
      console.error('Error adding promoter shares:', error)
      toast.error('Failed to add promoter shares. Please try again.')
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-lg">
          <Users className="w-4 h-4 mr-2" />
          Add Promoter
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-purple-700">
            <Users className="w-5 h-5" />
            Add Promoter Shares
          </DialogTitle>
        </DialogHeader>
        
        <form action={handlePromoter} id="promoter-form">
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
                <AutocompleteInput name="given_symbol" placeholder="Eg. NABIL" required/>
              </div>

              <div className="grid gap-3">
                <Label htmlFor="given_quantity">Quantity</Label>
                <Input name="given_quantity" type="number" placeholder="Eg. 200 Shares" required />
              </div>

              <div className="grid gap-3">
                <Label htmlFor="given_price">Price Per Share</Label>
                <Input name="given_price" type="number" defaultValue="100" step="0.01" required />
              </div>

              <div className="grid gap-3">
                <Label htmlFor="given_date">Added At</Label>
                <Input name="given_date" type="date" required />
              </div>
            </CardContent>

            <CardFooter className="flex justify-end">
              <Button type="submit" form="promoter-form" disabled={isLoading} className="bg-purple-600 hover:bg-purple-700">
                {isLoading ? 'Adding...' : 'Save changes'}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </DialogContent>
    </Dialog>
  )
}