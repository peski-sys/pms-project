"use client"

import { getListed, getNewData, addNewStock } from "@/app/api/listedAPI/actions"
import { Card, CardContent } from "./ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import Link from "next/link"

import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Pagination } from "./ui/pagination"
import { SectorAutocompleteInput } from "./ui/sector-autocomplete-input"

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

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useEffect, useState } from "react"

type getting_listed = {
    symbol: string,
    full_form: string,
    sector_id: number | null,
    sectors: {
      sector_name: string,
      instrument_type: string,
    }
}


export default function ListedStocksComponent() {

    const [stocks, setStocks] = useState<getting_listed[]>()
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    
    // Add Stock Dialog state
    const [selectedSector, setSelectedSector] = useState<{sector_id: number, sector_name: string, instrument_type: string} | null>(null)
    const [instrumentType, setInstrumentType] = useState<string>('')
    const [isUploadingStock, setIsUploadingStock] = useState(false)
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    const fetchSocks = async () => {
        setIsLoading(true)
        try {
            const response: getting_listed[] = await getListed()
            setStocks(response)
        } catch (error) {
            console.error('Error fetching stocks:', error)
            toast.error('Failed to load stocks. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    async function handleNewDataUpdate() {
      try {
        setIsRefreshing(true);
        setError(null);
        setSuccessMessage(null);
        
        const result = await getNewData();
        
        if (result && !result.success) {
          setError(result.message || 'Failed to refresh stock data');
          toast.error(result.message || 'Failed to refresh stock data');
          return;
        }
        
        if (result && result.success) {
          setSuccessMessage(result.message);
          toast.success(result.message || 'Stock data refreshed successfully!');
          // Clear success message after 5 seconds
          setTimeout(() => setSuccessMessage(null), 5000);
        }
        
        await fetchSocks();
      } catch (error) {
        console.error('Error refreshing stock data:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsRefreshing(false);
      }
    }

    useEffect(() => {
        fetchSocks()
    }, [])
    
    // Pagination calculations
    const totalPages = Math.ceil((stocks?.length || 0) / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const paginatedStocks = stocks?.slice(startIndex, startIndex + itemsPerPage) || []

    async function handleUpload(formData: FormData) {
        try {
            setIsUploadingStock(true)
            const client_symbol = formData.get("client-symbol") as string
            const client_full_form = formData.get("client-full-form") as string
            const client_category_id = formData.get("client-category_id") as string

            if (!client_symbol || !client_full_form || !client_category_id || !selectedSector) {
                toast.error('Please fill in all required fields and select a valid category.')
                return
            }

            const result = await addNewStock(client_symbol, client_full_form, parseInt(client_category_id))
            
            if (result.success) {
                toast.success(result.message)
                // Reset form state
                setSelectedSector(null)
                setInstrumentType('')
                // Refresh stock list
                await fetchSocks()
            } else {
                toast.error(result.message)
            }
        } catch (error) {
            console.error('Error adding stock:', error)
            toast.error('Failed to add stock. Please try again.')
        } finally {
            setIsUploadingStock(false)
        }
    }

    const handleSectorChange = (sector: {sector_id: number, sector_name: string, instrument_type: string} | null) => {
        setSelectedSector(sector)
        setInstrumentType(sector ? sector.instrument_type : '')
    }

    return (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow-sm p-6 border">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">Total Stocks</p>
                            <p className="text-2xl font-bold text-gray-900">{stocks?.length || 0}</p>
                        </div>
                    </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6 border">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                                </svg>
                            </div>
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">Equity Securities</p>
                            <p className="text-2xl font-bold text-gray-900">{stocks?.filter(s => s.sectors.instrument_type === 'Equity').length || 0}</p>
                        </div>
                    </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6 border">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                            </div>
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">Unique Sectors</p>
                            <p className="text-2xl font-bold text-gray-900">{stocks ? new Set(stocks.map(s => s.sectors.sector_name)).size : 0}</p>
                        </div>
                    </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6 border">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">Most Active Sector</p>
                            <p className="text-lg font-bold text-gray-900">
                                {stocks && stocks.length > 0 
                                    ? Object.entries(
                                        stocks.reduce((acc, stock) => {
                                            const sector = stock.sectors.sector_name
                                            acc[sector] = (acc[sector] || 0) + 1
                                            return acc
                                        }, {} as Record<string, number>)
                                    ).sort(([,a], [,b]) => b - a)[0]?.[0] || 'None'
                                    : 'None'
                                }
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-between items-center mb-6">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  disabled={isLoading || isRefreshing}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Refetch Stock Data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Refresh Stock Listings</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action will <strong>refresh the stock listings</strong> with the latest data from the server.
                    <br /><br />
                    • Existing stocks will be updated with new information
                    <br />• New stocks will be added to the database
                    <br />• <strong>No transactional data will be deleted</strong>
                    <br /><br />
                    This operation may take a few minutes to complete.
                    <br /><br />
                    Are you sure you want to proceed?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleNewDataUpdate}
                  >
                    Yes, Refresh Stock Listings
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Dialog>
                <DialogTrigger asChild>
                  <Button>+ Add Stock</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Add Newly Listed Stocks</DialogTitle>
                    <DialogDescription>
                      ⚠️ Be Careful while adding new stocks. Once Uploaded, It cannot be changed
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4">
                    <form action={handleUpload} id="uploading-form">
                      <div className="grid gap-3">
                        <Label htmlFor="client-symbol">Symbol *</Label>
                        <Input name="client-symbol" required placeholder="e.g., NABIL" />
                      </div>
                      
                      <div className="grid gap-3">
                        <Label htmlFor="client-full-form" className="mt-2">Full Form *</Label>
                        <Input name="client-full-form" required placeholder="e.g., Nabil Bank Limited" className="mb-2"/>
                      </div>

                      <div className="grid gap-3">
                        <Label htmlFor="client-category" className="mt-2">Category *</Label>
                        <SectorAutocompleteInput
                          name="client-category"
                          required
                          placeholder="Search and select a sector..."
                          onValueChange={handleSectorChange}
                        />
                      </div>

                      <div className="grid gap-3">
                        <Label htmlFor="client-instrument-type" className="mt-2">Instrument Type</Label>
                        <Input
                          name="client-instrument-type"
                          value={instrumentType}
                          disabled
                          placeholder={selectedSector ? instrumentType : "Select category first"}
                          className="mb-2 bg-gray-50"
                        />
                        {selectedSector && (
                          <p className="text-xs text-gray-500">
                            Instrument type is automatically set based on selected category.
                          </p>
                        )}
                      </div>
                    </form>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline" disabled={isUploadingStock}>Cancel</Button>
                    </DialogClose>
                    <Button 
                      type="submit" 
                      form="uploading-form" 
                      disabled={isUploadingStock || !selectedSector}
                      className="flex items-center gap-2"
                    >
                      {isUploadingStock && <RefreshCw className="animate-spin size-4" />}
                      {isUploadingStock ? 'Adding Stock...' : 'Add Stock'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-4 border border-red-300 rounded-lg bg-red-50">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <h3 className="text-red-800 font-medium">Error</h3>
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                  <button
                    onClick={() => setError(null)}
                    className="ml-auto text-red-500 hover:text-red-700"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="mb-4 p-4 border border-green-300 rounded-lg bg-green-50">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <h3 className="text-green-800 font-medium">Success</h3>
                    <p className="text-green-700 text-sm">{successMessage}</p>
                  </div>
                  <button
                    onClick={() => setSuccessMessage(null)}
                    className="ml-auto text-green-500 hover:text-green-700"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            <Card className="h-fit">
                <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Symbol</TableHead>
                      <TableHead>Full Form</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Instrument Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {
                    isLoading || isRefreshing ? (
                <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                        <RefreshCw className="animate-spin size-6 mx-auto mb-2" />
                        <p>{isRefreshing ? 'Refreshing stock data... This may take a few minutes.' : 'Loading data...'}</p>
                        {isRefreshing && (
                          <p className="text-sm text-gray-600 mt-2">
                            Please wait while we fetch fresh data from the server.
                          </p>
                        )}
                    </TableCell>
                </TableRow>
    ) : (
                    paginatedStocks?.map((details) => (
                    <TableRow key={details.symbol}>
                      <TableCell className="font-medium"><Link href={`/dashboard/stock/${details.symbol}`} target="_blank">{details.symbol}</Link></TableCell>
                      <TableCell><Link href={`/dashboard/stock/${details.symbol}`} target="_blank">{details.full_form}</Link></TableCell>
                      <TableCell>{details.sectors.sector_name}</TableCell>
                      <TableCell className="text-right">{details.sectors.instrument_type}</TableCell>
                    </TableRow>
                    ))
                  )

}
                  </TableBody>
                </Table>
                {stocks && stocks.length > 0 && (
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    itemsPerPage={itemsPerPage}
                    totalItems={stocks.length}
                  />
                )}
                </CardContent>
            </Card>
        </div>
    )
}