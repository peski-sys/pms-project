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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { uploadIPOAllotment, uploadIPOAllotmentStaging } from "@/app/api/ipoAllotmentAPI/actions"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { fetchClientsFor, getFunds } from "@/app/api/fundsAPI/actions"
import { getListed } from "@/app/api/listedAPI/actions"
import { getSubClasses } from "@/app/api/subClassApiCalls/actions"
import { TrendingUp, Star, Users } from "lucide-react"

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

type SubClass = {
  sub_id: number
  fund_id: number
  sub_name: string
  funds: {
    fund_name: string
  }
}

interface IPOAllotmentDialogProps {
  onSuccess?: () => void;
}

export function IPOAllotmentDialog({ onSuccess }: IPOAllotmentDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('demat');
  const [currentFund, setCurrentFund] = useState<string>('')
  const [listFunds, setListFunds] = useState<response_funds[]>()
  const [currentClient, setCurrentClient] = useState<string>('')
  const [listClients, setListClients] = useState<cbMAP[]>()
  const [currentSymbol, setCurrentSymbol] = useState<string>('')
  const [listStocks, setListStocks] = useState<StockInfo[]>()
  const [currentSubClass, setCurrentSubClass] = useState<string>('')
  const [listSubClasses, setListSubClasses] = useState<SubClass[]>()

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

  const fetchSubClasses = async () => {
    const fetch_subclasses: SubClass[] = await getSubClasses()
    const filteredSubClasses = fetch_subclasses.filter(sc => sc.funds.fund_name === currentFund)
    setListSubClasses(filteredSubClasses)
    // Set first sub class as default if available
    if (filteredSubClasses.length > 0 && !currentSubClass) {
      setCurrentSubClass(filteredSubClasses[0].sub_id.toString())
    }
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

  const setSubClass = (value: string) => {
    setCurrentSubClass(value)
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
      fetchSubClasses();
    }
  }, [currentFund])

  async function handleIPOAllotment(formData: FormData) {
    const stock_quantity = Number(formData.get('given_quantity'))
    const stock_price = Number(formData.get('given_price'));
    const stock_added_at = formData.get('given_date') as string;

    if (!currentFund || !currentSymbol) {
      toast.error('Please select fund and symbol.')
      return
    }

    if (!currentSubClass) {
      toast.error('Please select a sub class.')
      return
    }

    if (!stock_quantity || !stock_price || !stock_added_at) {
      toast.error('Please fill in all required fields.')
      return
    }

    // DEMAT tab requires client_id
    if (activeTab === 'demat' && !currentClient) {
      toast.error('Please select a client.')
      return
    }

    try {
      setIsLoading(true);
      let result;
      
      if (activeTab === 'demat') {
        // Upload to ipo_allotment_records with client_id
        result = await uploadIPOAllotment(currentFund, currentClient, currentSymbol, stock_quantity, stock_price, stock_added_at, parseInt(currentSubClass))
      } else {
        // Upload to ipo_allotment_staging without client_id
        result = await uploadIPOAllotmentStaging(currentFund, currentSymbol, stock_quantity, stock_price, stock_added_at, parseInt(currentSubClass))
      }
      
      if (result.success) {
        const message = activeTab === 'demat' 
          ? 'IPO allotment record added successfully!' 
          : 'Non-DEMAT IPO allotment added to staging successfully!';
        toast.success(message)
        setIsOpen(false);
        onSuccess?.();
        // Reset form
        setCurrentFund('');
        setCurrentClient('');
        setCurrentSymbol('');
        setCurrentSubClass('');
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
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-indigo-700">
            <Star className="w-5 h-5" />
            Add IPO Allotment Record
          </DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="demat" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              DEMAT (Allocated)
            </TabsTrigger>
            <TabsTrigger value="non-demat" className="flex items-center gap-2">
              <Star className="w-4 h-4" />
              Non-DEMAT (Pending)
            </TabsTrigger>
          </TabsList>

          <form action={handleIPOAllotment} id="ipo-allotment-form">
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
                  <Select name="client" onValueChange={setClient} required={activeTab === 'demat'}>
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
                    This IPO allotment is not yet dematerialized to a specific client. 
                    You can assign it to a client later from the Manual Stock History page.
                  </p>
                </div>
              </TabsContent>

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

              <div className="grid gap-3">
                <Label htmlFor="sub_class">Sub Class</Label>
                <Select name="sub_class" onValueChange={setSubClass} value={currentSubClass} required>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Sub Class" />
                  </SelectTrigger>
                  <SelectContent>
                    {listSubClasses?.map((subClass) => (
                      <SelectItem value={subClass.sub_id.toString()} key={subClass.sub_id}>
                        {subClass.sub_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-indigo-600" />
                  <span className="text-sm font-medium text-indigo-800">IPO Allotment Info</span>
                </div>
                <p className="text-xs text-indigo-600">
                  {activeTab === 'demat' 
                    ? 'This record will track IPO share allotments for the selected client. The total value will be calculated automatically based on quantity × price.'
                    : 'This IPO will be added to staging without a client assignment. You can dematerialize it later when the client is known.'}
                </p>
              </div>
              </CardContent>

              <CardFooter className="flex justify-end">
                <Button type="submit" form="ipo-allotment-form" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700">
                  {isLoading ? 'Adding...' : activeTab === 'demat' ? 'Save IPO Allotment' : 'Save to Staging'}
                </Button>
              </CardFooter>
            </Card>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}