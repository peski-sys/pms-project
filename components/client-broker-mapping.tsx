"use client"

import {
  Card,
  CardContent,
} from "@/components/ui/card"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { getBrokerClientData, uploadNewClient } from "@/app/api/brokerClientMapping/actions"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "./ui/button"
import { RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

type BrokerClientData = {
  client_id: string,
  boid: string | null,
  fund_id: number,
  client_name: string,
  client_broker: number,
  recorded_at: Date | null,
  dp_name: string | null,
}

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type fund_data = {
  fund_id: number,
  fund_name: string,
  uploaded_at: Date | null
}

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog"
import { getFunds } from "@/app/api/fundsAPI/actions"
import { getCurrentSessionUser } from "@/app/api/dashboardAPICalls/actions"

export default function ClientMap() {
    const [fetchBrokerClientData, setFetchBrokerClientData] = useState<BrokerClientData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [listFunds, selectlistFunds] = useState<fund_data[]>()
    const [selectValue, setselectValue] = useState<string>('')
    const [isAdmin, setIsAdmin] = useState<boolean | null>()


    function handleValueChange(value: string) {
      setselectValue(value)
    }


    const loadBrokerClientData = async () => {
        setIsLoading(true);
        try {
          const userPermission = await getCurrentSessionUser()
          setIsAdmin(userPermission)
            const response = await getBrokerClientData();
            // getBrokerClientData returns array directly, not wrapped in success object
            if (Array.isArray(response)) {
                setFetchBrokerClientData(response);
            } else {
                toast.error('Failed to load broker client data');
            }

            const fund_response = await getFunds()
            if (fund_response.success) {
                selectlistFunds(fund_response.data)
            } else {
                toast.error(fund_response.error || 'Failed to load funds');
            }
        } catch (error) {
            console.error('Error fetching broker client data:', error);
            toast.error('Failed to load broker client data. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadBrokerClientData();
    }, []);

    const handleUploadNewClient = async (formData: FormData) => {
        try {
            const result = await uploadNewClient(formData, selectValue);
            if (result.success) {
                // Refresh the data after successful upload
                await loadBrokerClientData();
                toast.success(result.message || 'Client mapping added successfully!');
            } else {
                toast.error(result.error || 'Failed to add client mapping');
            }
        } catch (error) {
            console.error('Error adding client mapping:', error);
            toast.error('Failed to add client mapping. Please try again.');
        }
    };

    return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm p-6 border">
                <div className="flex items-center">
                    <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </div>
                    </div>
                    <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Total Clients</p>
                        <p className="text-2xl font-bold text-gray-900">{fetchBrokerClientData.length}</p>
                    </div>
                </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-6 border">
                <div className="flex items-center">
                    <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                    <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">With BOID</p>
                        <p className="text-2xl font-bold text-gray-900">{fetchBrokerClientData.filter(client => client.boid).length}</p>
                    </div>
                </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-6 border">
                <div className="flex items-center">
                    <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                        </div>
                    </div>
                    <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Active Funds</p>
                        <p className="text-2xl font-bold text-gray-900">{listFunds?.length || 0}</p>
                    </div>
                </div>
            </div>
        </div>

        <div className="flex justify-between items-center mb-6">
            <Button 
                onClick={loadBrokerClientData} 
                disabled={isLoading}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
            >
                <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh Data
            </Button>
            {isAdmin && 
            <Dialog>
                <DialogTrigger asChild>
                  <Button>+ Add Client Mapping</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Add Broker Client Mapping</DialogTitle>
                    <DialogDescription>
                      ⚠️ Be Careful while adding new client. Once Uploaded, It cannot be changed
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 w-full">
                    <form action={handleUploadNewClient} id="uploading-form">
                    <div className="grid gap-3 mb-4">
                      <Label htmlFor="client-fund" className="mt-2">Fund</Label>
                      <Select onValueChange={handleValueChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select Fund" />
                        </SelectTrigger>
                        <SelectContent>
                        {listFunds?.map((details) => (
                          <SelectItem value={`${details.fund_id}`} key={details.fund_id}>{details.fund_name}</SelectItem>
                        ))
}
                      </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-3">
                      <Label htmlFor="client-id">Client ID</Label>
                      <Input name="client-id" required />
                    </div>
                    <div className="grid gap-3">
                      <Label htmlFor="client-boid" className="mt-2">BOID Number</Label>
                      <Input name="client-boid" type="number" required />
                    </div>
                    <div className="grid gap-3">
                      <Label htmlFor="client-dp-name" className="mt-2">DP Name</Label>
                      <Input name="client-dp-name" required className="mb-2"/>
                    </div>
                    <div className="grid gap-3">
                      <Label htmlFor="client-name" className="mt-2">Client Name</Label>
                      <Input name="client-name" required className="mb-2"/>
                    </div>
                      <div className="grid gap-3">
                      <Label htmlFor="client-broker" className="mt-2">Client Broker</Label>
                      <Input name="client-broker" required type="number" className="mb-2" />
                    </div>
                    </form>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <DialogClose asChild>
                    <Button type="submit" form="uploading-form">Save changes</Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
            </Dialog>
            }
        </div>

        <Card className="shadow-sm border">
          <CardContent className="p-0">
                <div className="overflow-x-auto">
                <Table>
          <TableHeader>
            <TableRow className="border-b border-gray-200">
              <TableHead className="px-6 py-4 font-semibold text-gray-900">Client ID</TableHead>
              <TableHead className="px-6 py-4 text-center font-semibold text-gray-900">BOID Number</TableHead>
              <TableHead className="px-6 py-4 text-center font-semibold text-gray-900">DP Name</TableHead>
              <TableHead className="px-6 py-4 text-right font-semibold text-gray-900">Broker Number</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                        <RefreshCw className="animate-spin size-6 mx-auto mb-2" />
                        <p>Loading broker client data...</p>
                    </TableCell>
                </TableRow>
            ) : fetchBrokerClientData.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                        <p>No broker client mappings found</p>
                    </TableCell>
                </TableRow>
            ) : (
                fetchBrokerClientData.map((row) => (
                <TableRow key={row.client_id} className="border-b border-gray-100 hover:bg-gray-50">
                <TableCell className="px-6 py-4 font-medium text-gray-900">{row.client_id}</TableCell>
                <TableCell className="px-6 py-4 text-center text-gray-600">{row.boid || '-'}</TableCell>
                  <TableCell className="px-6 py-4 text-center text-gray-900">{row.dp_name || '-'}</TableCell>
                <TableCell className="px-6 py-4 text-right text-gray-600">{row.client_broker}</TableCell>
                </TableRow>
                ))
            )}
          </TableBody>
        </Table>
        </div>
          </CardContent>
        </Card>
                </div>
        )
}