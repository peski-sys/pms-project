"use client"
import { getFiscal, uploadFiscal, syncInitialBalance } from "@/app/api/fiscalAPI/actions"
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
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"

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
import { useEffect, useState } from "react"
import { getCurrentSessionUser } from "@/app/api/dashboardAPICalls/actions"

type getting_fiscal = {
    fiscal_year_id: number,
    year_label: string,
    start_date: Date | null,
    end_date: Date | null,
    initial_balance_synced: boolean | null,
}

export default function FiscalYearComponent() {

    const [fiscal, setFiscal] = useState<getting_fiscal[]>()
    const [isLoading, setLoading] = useState(false);
    const [isAdmin, setIsAdmin] = useState<boolean | null>()
    const [syncingFiscalId, setSyncingFiscalId] = useState<number | null>(null);

    const fetchFiscal = async () => {
        setLoading(true)
        try {
          const userPermission = await getCurrentSessionUser()
          setIsAdmin(userPermission)
            const response: getting_fiscal[] = await getFiscal()
            setFiscal(response)
        } catch (error) {
            console.error('Error fetching fiscal years:', error)
            toast.error('Failed to load fiscal years. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchFiscal()
    }, [])

    async function post_fiscal(formData: FormData) {
        try {
            const given_year_label = formData.get('client-year-label') as string
            const given_start_date = formData.get('client-start-date') as string
            const given_end_date= formData.get('client-end-date') as string

            if(!given_year_label || !given_start_date || !given_end_date) {
                toast.error('Please fill in all required fields.')
                return
            }

            const startDate = new Date(given_start_date)
            const endDate = new Date(given_end_date)

            if (startDate >= endDate) {
                toast.error('End date must be after start date.')
                return
            }

            await uploadFiscal(given_year_label, startDate, endDate);
            await fetchFiscal();
            toast.success('Fiscal year added successfully!');
        } catch (error) {
            console.error('Error adding fiscal year:', error)
            toast.error('Failed to add fiscal year. Please try again.')
        }
    }

    async function handleSyncInitialBalance(currentFiscalYearId: number) {
        try {
            setSyncingFiscalId(currentFiscalYearId);
            
            const result = await syncInitialBalance(currentFiscalYearId);
            
            if (result.success) {
                toast.success(result.message);
                await fetchFiscal(); // Refresh the data
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            console.error('Error syncing initial balance:', error);
            toast.error('Failed to sync initial balance. Please try again.');
        } finally {
            setSyncingFiscalId(null);
        }
    }

    return (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow-sm p-6 border">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a4 4 0 118 0v4m-8 9v2h8v-2M8 7v8M8 7H6M8 15H6m8-8h2m0 0h2m-2 0V5m2 2h2" />
                                </svg>
                            </div>
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">Total Fiscal Years</p>
                            <p className="text-2xl font-bold text-gray-900">{fiscal?.length || 0}</p>
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
                            <p className="text-sm font-medium text-gray-600">Current Year</p>
                            <p className="text-2xl font-bold text-gray-900">{fiscal?.find(f => {
                                const now = new Date()
                                const start = f.start_date ? new Date(f.start_date) : null
                                const end = f.end_date ? new Date(f.end_date) : null
                                return start && end && now >= start && now <= end
                            })?.year_label || 'N/A'}</p>
                        </div>
                    </div>
                </div>
            </div>

             <div className="flex justify-between items-center mb-6">
            {isAdmin && 
            <Dialog>
                <DialogTrigger asChild>
                  <Button>+ Add Fiscal Year</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Add Fiscal Year Mapping</DialogTitle>
                    <DialogDescription>
                      ⚠️ Be Careful while adding new fiscals. Once Uploaded, It cannot be changed
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4">
                    <form action={post_fiscal} id="uploading-form">
                    <div className="grid gap-3">
                      <Label htmlFor="client-year-label">Year Label</Label>
                      <Input name="client-year-label" required />
                    </div>
                    <div className="grid gap-3">
                      <Label htmlFor="client-start-date" className="mt-2">Start Date</Label>
                      <Input name="client-start-date" required type="date" className="mb-2"/>
                    </div>

                      <div className="grid gap-3">
                      <Label htmlFor="client-end-date" className="mt-2">End Date</Label>
                      <Input name="client-end-date" required type="date" className="mb-2" />
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
                          <TableHead className="px-6 py-4 font-semibold text-gray-900">Year Label</TableHead>
                          <TableHead className="px-6 py-4 text-center font-semibold text-gray-900">Start Date</TableHead>
                          <TableHead className="px-6 py-4 text-center font-semibold text-gray-900">End Date</TableHead>
                          <TableHead className="px-6 py-4 text-center font-semibold text-gray-900">Duration</TableHead>
                          <TableHead className="px-6 py-4 text-center font-semibold text-gray-900">Initial Balance Synced</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? (
                        <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                            <RefreshCw className="animate-spin size-6 mx-auto mb-2" />
                            <p>Loading data...</p>
                        </TableCell>
                    </TableRow>
                    ) : (
                        fiscal?.map((details) => {
                            const startDate = details?.start_date ? new Date(details.start_date) : null
                            const endDate = details?.end_date ? new Date(details.end_date) : null
                            const duration = startDate && endDate ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) : null
                            const isActive = startDate && endDate && new Date() >= startDate && new Date() <= endDate
                            
                            return (
                            <TableRow key={details.fiscal_year_id} className={`border-b border-gray-100 hover:bg-gray-50 ${isActive ? 'bg-green-50' : ''}`}>
                              <TableCell className="px-6 py-4 font-medium text-gray-900">
                                <div className="flex items-center gap-2">
                                  {details.year_label}
                                  {isActive && (
                                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                                      Current
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="px-6 py-4 text-center text-gray-600">{startDate?.toLocaleDateString()}</TableCell>
                              <TableCell className="px-6 py-4 text-center text-gray-600">{endDate?.toLocaleDateString()}</TableCell>
                              <TableCell className="px-6 py-4 text-center text-gray-600">{duration ? `${duration} days` : '-'}</TableCell>
                              <TableCell className="px-6 py-4 text-center">
                                {isActive ? (
                                  details.initial_balance_synced ? (
                                    <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-green-100 text-green-800 rounded-full">
                                      Balance Synced
                                    </span>
                                  ) : (
                                    <Button 
                                      size="sm" 
                                      variant="outline" 
                                      className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300"
                                      onClick={() => handleSyncInitialBalance(details.fiscal_year_id)}
                                      disabled={syncingFiscalId === details.fiscal_year_id}
                                    >
                                      {syncingFiscalId === details.fiscal_year_id ? (
                                        <>
                                          <RefreshCw className="animate-spin size-4 mr-2" />
                                          Syncing...
                                        </>
                                      ) : (
                                        'Sync Initial Balance'
                                      )}
                                    </Button>
                                  )
                                ) : (
                                  <span className="text-gray-400 text-sm">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                            )
                        })
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