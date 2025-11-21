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
import { uploadCloseout } from "@/app/api/sidebarAPIs/actions"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { fetchClientsFor, getFunds } from "@/app/api/fundsAPI/actions"
import { X } from "lucide-react"

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

interface CloseoutDialogProps {
  onSuccess?: () => void;
}

export function CloseoutDialog({ onSuccess }: CloseoutDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentFund, setCurrentFund] = useState<string>('')
  const [listFunds, setListFunds] = useState<response_funds[]>()
  const [currentClient, setCurrentClient] = useState<string>('')
  const [listClients, setListClients] = useState<cbMAP[]>()

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

  async function handleCloseout(formData: FormData) {
    const stock_symbol = formData.get('given_symbol') as string;
    const stock_quantity = Number(formData.get('given_number_of_shares'))
    const stock_amount = Number(formData.get('given_closeout_amount'))
    const stock_added_at = formData.get('given_closeout_date') as string;

    if (!currentFund || !currentClient) {
      toast.error('Please select both fund and client.')
      return
    }

    if (!stock_symbol || !stock_quantity || !stock_amount || !stock_added_at) {
      toast.error('Please fill in all required fields.')
      return
    }

    try {
      setIsLoading(true);
      const result = await uploadCloseout(currentFund, currentClient, stock_symbol, stock_quantity, stock_amount, stock_added_at)
      
      if (result.success) {
        toast.success(result.message || 'Closeout shares added successfully!')
        setIsOpen(false);
        onSuccess?.();
        // Reset form
        setCurrentFund('');
        setCurrentClient('');
      } else {
        toast.error(result.error || 'Failed to add closeout shares')
      }
    } catch (error) {
      console.error('Error adding Closeout shares:', error)
      toast.error('Failed to add closeout shares. Please try again.')
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg">
          <X className="w-4 h-4 mr-2" />
          Add Closeout
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <X className="w-5 h-5" />
            Add Closeout Record
          </DialogTitle>
        </DialogHeader>
        
        <form action={handleCloseout} id="closeout-form">
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
                />
              </div>

              <div className="grid gap-3">
                <Label htmlFor="given_number_of_shares">No. of Shares</Label>
                <Input 
                  name="given_number_of_shares" 
                  type="number" 
                  required 
                  placeholder="Eg. 10 Shares" 
                  step="1"
                />
              </div>

              <div className="grid gap-3">
                <Label htmlFor="given_closeout_amount">Closeout Amount</Label>
                <Input name="given_closeout_amount" required type="number" placeholder="Eg. 12,500" step="0.01"/>
              </div>

              <div className="grid gap-3">
                <Label htmlFor="given_closeout_date">Closeout Date</Label>
                <Input name="given_closeout_date" required type="date" />
              </div>
            </CardContent>

            <CardFooter className="flex justify-end">
              <Button type="submit" form="closeout-form" disabled={isLoading} className="bg-red-600 hover:bg-red-700">
                {isLoading ? 'Adding...' : 'Save changes'}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </DialogContent>
    </Dialog>
  )
}