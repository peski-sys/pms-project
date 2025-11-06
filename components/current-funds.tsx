"use client"

import { getFunds, uploadFund } from "@/app/api/fundsAPI/actions"
import { Card, CardContent } from "./ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"

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

import { RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { useEffect, useState } from "react"
import { getCurrentSessionUser } from "@/app/api/dashboardAPICalls/actions"

type getting_funds = {
    fund_id: number,
    fund_name: string,
    uploaded_at: Date | null,
}

export default function CurrentFundsComponent() {

    const [fund, setFund] = useState<getting_funds[]>()
    const [isLoading, setIsLoading] = useState(false);
    const [isAdmin, setIsAdmin] = useState<boolean | null>()


    const fetchData = async () => {
        setIsLoading(true)
        try {
            const userPermission = await getCurrentSessionUser()
            setIsAdmin(userPermission)
            const response: getting_funds[] = await getFunds()
            setFund(response)
        } catch (error) {
            console.error('Error fetching funds:', error)
            toast.error('Failed to load funds. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    async function handleFundUpload(formData: FormData) {
        try {
            const fund_name = formData.get("fund-name") as string
            
            if (!fund_name || fund_name.trim() === '') {
                toast.error('Please enter a fund name.')
                return
            }
            
            await uploadFund(fund_name)
            await fetchData();
            toast.success('Fund added successfully!')
        } catch (error) {
            console.error('Error adding fund:', error)
            toast.error('Failed to add fund. Please try again.')
        }
    }

    return (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow-sm p-6 border">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            </div>
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">Total Funds</p>
                            <p className="text-2xl font-bold text-gray-900">{fund?.length || 0}</p>
                        </div>
                    </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6 border">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                </svg>
                            </div>
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">Active Funds</p>
                            <p className="text-2xl font-bold text-gray-900">{fund?.filter(f => f.uploaded_at).length || 0}</p>
                        </div>
                    </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6 border">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">Latest Fund</p>
                            <p className="text-lg font-bold text-gray-900">
                                {fund && fund.length > 0 
                                    ? fund.reduce((latest, current) => {
                                        const latestDate = latest.uploaded_at ? new Date(latest.uploaded_at) : new Date(0)
                                        const currentDate = current.uploaded_at ? new Date(current.uploaded_at) : new Date(0)
                                        return currentDate > latestDate ? current : latest
                                    }).fund_name 
                                    : 'None'
                                }
                            </p>
                        </div>
                    </div>
                </div>
            </div>

             <div className="flex justify-between items-center mb-6">
                {isAdmin && 
            <Dialog>
                <DialogTrigger asChild>
                  <Button>+ Add Fund</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Add Fund Data</DialogTitle>
                    <DialogDescription>
                      ⚠️ Be Careful while adding Fund Data. Once Uploaded, It cannot be changed
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4">
                    <form action={handleFundUpload} id="uploading-form">
                    <div className="grid gap-3">
                      <Label htmlFor="fund-name" className="mt-2">Fund Name</Label>
                      <Input name="fund-name" required className="mb-2"/>
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
                          <TableHead className="px-6 py-4 font-semibold text-gray-900">Fund ID</TableHead>
                          <TableHead className="px-6 py-4 font-semibold text-gray-900">Fund Name</TableHead>
                          <TableHead className="px-6 py-4 text-center font-semibold text-gray-900">Created Date</TableHead>
                          <TableHead className="px-6 py-4 text-center font-semibold text-gray-900">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? (
                    <TableRow>
                        <TableCell colSpan={4} className="text-center py-8">
                            <RefreshCw className="animate-spin size-6 mx-auto mb-2" />
                            <p>Loading data...</p>
                        </TableCell>
                    </TableRow>
        ) : (
                        fund?.map((details) => (
                        <TableRow key={details.fund_id} className="border-b border-gray-100 hover:bg-gray-50">
                          <TableCell className="px-6 py-4 font-medium text-gray-900">#{details.fund_id}</TableCell>
                          <TableCell className="px-6 py-4 font-medium text-gray-900">{details.fund_name}</TableCell>
                          <TableCell className="px-6 py-4 text-center text-gray-600">
                            {details?.uploaded_at ? new Date(details.uploaded_at).toLocaleDateString() : 'N/A'}
                          </TableCell>
                          <TableCell className="px-6 py-4 text-center">
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                              Active
                            </span>
                          </TableCell>
                        </TableRow>
                        ))
        )
      }
                      </TableBody>
                    </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}