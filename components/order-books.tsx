"use client"
import { UploadBook } from "./upload-dialog"
import { getOrderBooks, viewDataFor } from "@/app/api/orderBooksAPICalls/actions"

import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

import { RefreshCw } from "lucide-react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type buy_result = {
    _sum: {
        quantity: number | null,
        txn_value: number | null,
        commission_amount: number | null,
        net_payable: number | null,
    },
    client_id: string,
    symbol: string
}


type sell_result = {
    _sum: {
        quantity: number | null,
        txn_value: number | null,
        commission_amount: number | null,
        net_receivable: number | null,
        approx_profit_loss: number | null,
        profit_loss: number | null,
    },
    client_id: string,
    symbol: string
}


type groupedBuys = {
  client_id: string;
  client_name: string;
  client_broker: number;
  symbols: buy_result[],
}


type groupedSells = {
  client_id: string;
  client_name: string;
  client_broker: number;
  symbols: sell_result[]
}



type overall_result = {
  buying: groupedBuys[],
  selling: groupedSells[]
}

type orderType = {
    upload_id: number,
    file_name: string | null,
    uploaded_at: Date | null,
    is_confirmed: boolean | null,
    total_dp_amount: number,
}

import { Button } from "./ui/button"

import { Trash, View, FileText, CheckCircle, Clock, Upload } from "lucide-react"
import { ConfirmDelete } from "@/app/api/deleteConfirmation/actions"
import { useEffect, useState } from "react"
import { confirmSubmission } from "@/app/api/upload/actions"
import { toast } from "sonner"
import { UploadDEMAT } from "./upload-dialog-demat"
import { Pagination } from "./ui/pagination"
import { UploadMigration } from "./upload-dialog-migration"

export default function OrderBooks() {

  const [listOrders, setListOrders] = useState<orderType[]>()
  const [selectedData, setselectedData] = useState<overall_result>()
  const [currentID, setcurrentID] = useState<number>()
  const [Isloading, setIsLoading] = useState<boolean>(false)
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 5


  const fetchOrders = async () => {
    try {
      const list_orders: orderType[] = await getOrderBooks();
      setListOrders(list_orders)
    } catch (error) {
      console.error('Error fetching order books:', error)
      toast.error('Failed to load order books. Please try again.')
    }
  }


  useEffect(() => {
    fetchOrders();
  }, [])

  async function uploadDone() {
    await fetchOrders();
    toast.success('File uploaded successfully!');
  }

  const handleRecordSave = async () => {
    if(!currentID) {
      toast.error('No record selected to confirm.')
      return
    }
    
    try {
      await confirmSubmission(currentID)
      await fetchOrders();
      toast.success('Record confirmed successfully!')
    } catch (error) {
      console.error('Error confirming record:', error)
      toast.error('Failed to confirm record. Please try again.')
    }
  }

  const handleDelete = async (formData: FormData) => {
    const uploaded_id = Number(formData.get("upload-id"));
    const file_name = formData.get("file-name") as string;
    
    if (!uploaded_id || !file_name) {
      toast.error('Invalid file information for deletion.')
      return
    }
    
    try {
      await ConfirmDelete(uploaded_id, file_name)
      await fetchOrders();
      toast.success('File deleted successfully!')
    } catch (error) {
      console.error('Error deleting file:', error)
      toast.error('Failed to delete file. Please try again.')
    }
  }

  // Calculate summary statistics
  const totalUploads = listOrders?.length || 0;
  const confirmedUploads = listOrders?.filter(order => order.is_confirmed).length || 0;
  const pendingUploads = totalUploads - confirmedUploads;
  
  // Pagination calculations
  const totalPages = Math.ceil(totalUploads / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedOrders = listOrders?.slice(startIndex, startIndex + itemsPerPage) || []
  
  // Reset to first page if current page is beyond available pages
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1)
    }
  }, [currentPage, totalPages])

    return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Uploads</p>
              <p className="text-2xl font-bold text-gray-900">{totalUploads}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Confirmed</p>
              <p className="text-2xl font-bold text-gray-900">{confirmedUploads}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Clock className="h-8 w-8 text-amber-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Pending</p>
              <p className="text-2xl font-bold text-gray-900">{pendingUploads}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="mb-4 sm:mb-0">
            <h2 className="text-lg font-semibold text-gray-900">Upload New Files</h2>
            <p className="text-sm text-gray-600">Upload DEMAT statements or trading order books</p>
          </div>
          <div className="flex gap-3">
            <UploadDEMAT onUpload={uploadDone} />
            <UploadBook onUpload={uploadDone} />
            {/* <UploadMigration onUpload={uploadDone} /> */}
          </div>
        </div>
      </div>

      {/* Uploaded Files Section */}
      {listOrders && listOrders.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Uploaded Files</h2>
        </div>
      )}
      
    {paginatedOrders?.map((orders) => (
    <Card className={`mb-4 bg-white shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200 ${!orders.is_confirmed ? 'border-l-4 border-l-amber-400' : 'border-l-4 border-l-green-400'}`} key={orders.upload_id}>
  <CardHeader className="pb-4">
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <CardTitle className="text-lg font-semibold text-gray-900 mb-2">{orders.file_name}</CardTitle>
        <CardDescription className="text-sm text-gray-600">
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Uploaded on {orders.uploaded_at?.toLocaleDateString()}
          </span>
          {orders.total_dp_amount > 0 && (
            <div className="flex items-center gap-2 mt-1 text-xs text-blue-600">
              <span className="font-medium">DP Amount:</span>
              <span className="font-semibold">Rs. {orders.total_dp_amount.toLocaleString()}</span>
            </div>
          )}
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-2 ${
            orders.is_confirmed 
              ? 'bg-green-100 text-green-800' 
              : 'bg-amber-100 text-amber-800'
          }`}>
            {orders.is_confirmed ? (
              <><CheckCircle className="h-3 w-3 mr-1" />Confirmed</>
            ) : (
              <><Clock className="h-3 w-3 mr-1" />Pending Confirmation</>
            )}
          </span>
        </CardDescription>
      </div>
    </div>
    <CardAction>
        <div className="flex gap-3 mt-4">

      <form id="viewIDForm">
        <input value={`${orders.upload_id}`}  type="hidden" name="view-upload-id" readOnly/>
        <Dialog>
            <DialogTrigger asChild>
              <Button 
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                onClick={async () => {
                  setIsLoading(true)
                  const extracted_data: overall_result = await viewDataFor(Number(orders.upload_id))
                  setselectedData(extracted_data)
                  setcurrentID(orders.upload_id)
                  setIsLoading(false)
                }}
              >
                <View className="h-4 w-4" />
                View Details
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
              <DialogHeader className="pb-4 flex-shrink-0">
                <DialogTitle className="text-xl font-semibold text-gray-900">Order Book Summary</DialogTitle>
                <DialogDescription className="text-sm text-gray-600">
                  Detailed view of buy and sell transactions for {orders.file_name}
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto pr-2">
                  <Tabs defaultValue="buy" className="w-full h-full">
                    <TabsList className="grid w-full grid-cols-2 mb-6">
                      <TabsTrigger value="buy" className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        Buy Orders
                      </TabsTrigger>
                      <TabsTrigger value="sell" className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        Sell Orders
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="buy">
                      {
                        !Isloading ? (
                    selectedData?.buying.map((details) => (
                      <div key={details.client_id} className="mb-8">
                        <div className="bg-gray-50 px-4 py-3 rounded-t-lg border-b">
                          <h3 className="font-semibold text-lg text-gray-900">
                            {details.client_broker > 0 
                              ? `Broker No. ${details.client_broker} (${details.client_id})` 
                              : `${details.client_id}`
                            }
                          </h3>
                        </div>
                      <div className="border border-gray-200 rounded-b-lg overflow-hidden">
                      <Table key={details.client_id} className="w-full">
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="font-semibold text-gray-900 py-2 px-3 text-sm">Symbol</TableHead>
                          <TableHead className="font-semibold text-gray-900 py-2 px-3 text-sm">Quantity</TableHead>
                          <TableHead className="font-semibold text-gray-900 py-2 px-3 text-sm">Price</TableHead>
                          <TableHead className="font-semibold text-gray-900 py-2 px-3 text-sm">Value</TableHead>
                          <TableHead className="font-semibold text-gray-900 py-2 px-3 text-sm">Commission</TableHead>
                          <TableHead className="font-semibold text-gray-900 py-2 px-3 text-sm text-right">Net Payable</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {details.symbols.map((singles) => (
                        <TableRow key={singles.symbol} className="hover:bg-gray-50">
                          <TableCell className="font-medium py-2 px-3 text-sm">{singles.symbol}</TableCell>
                          <TableCell className="py-2 px-3 text-sm">{singles._sum.quantity?.toLocaleString()}</TableCell>
                          <TableCell className="py-2 px-3 text-sm">{(singles._sum.txn_value && singles._sum.quantity) ? ((singles._sum.txn_value / singles._sum.quantity).toFixed(2)) : 0}</TableCell>
                          <TableCell className="py-2 px-3 text-sm">{singles._sum.txn_value?.toLocaleString()}</TableCell>
                          <TableCell className="py-2 px-3 text-sm">{singles._sum.commission_amount?.toLocaleString()}</TableCell>
                          <TableCell className="text-right py-2 px-3 text-sm">{singles._sum.net_payable?.toLocaleString()}</TableCell>
                        </TableRow>
                        ))}
                        {/* Grand Total Row for Buy Records */}
                        <TableRow className="border-t-2 border-gray-300 bg-gray-100">
                          <TableCell className="font-bold text-gray-900 py-2 px-3 text-sm">GRAND TOTAL</TableCell>
                          <TableCell className="font-bold text-green-700 py-2 px-3 text-sm">
                            {details.symbols.reduce((sum, item) => sum + (item._sum.quantity || 0), 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="font-bold text-gray-900 py-2 px-3 text-sm">-</TableCell>
                          <TableCell className="font-bold text-green-700 py-2 px-3 text-sm">
                            {details.symbols.reduce((sum, item) => sum + (item._sum.txn_value || 0), 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="font-bold text-amber-700 py-2 px-3 text-sm">
                            {details.symbols.reduce((sum, item) => sum + (item._sum.commission_amount || 0), 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-bold text-blue-700 py-2 px-3 text-sm">
                            {details.symbols.reduce((sum, item) => sum + (item._sum.net_payable || 0), 0).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                      </Table>
                      </div>
                      </div>
                  ))
                ) : (
              <RefreshCw className="justify-center items-center size-6 animate-spin text-center" />
                )
                  }
                      </TabsContent>
                <TabsContent value="sell">
                  
                  {
                    selectedData?.selling.map((details) => (
                      <div key={details.client_id} className="mb-8">
                        <div className="bg-gray-50 px-4 py-3 rounded-t-lg border-b">
                          <h3 className="font-semibold text-lg text-gray-900">
                            {details.client_broker > 0 
                              ? `Broker No. ${details.client_broker} (${details.client_id})` 
                              : `${details.client_id}`
                            }
                          </h3>
                        </div>
                      <div className="border border-gray-200 rounded-b-lg overflow-hidden">
                      <Table className="w-full">
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="font-semibold text-gray-900 py-2 px-3 text-sm">Symbol</TableHead>
                          <TableHead className="font-semibold text-gray-900 py-2 px-3 text-sm">Quantity</TableHead>
                          <TableHead className="font-semibold text-gray-900 py-2 px-3 text-sm">Price</TableHead>
                          <TableHead className="font-semibold text-gray-900 py-2 px-3 text-sm">Value</TableHead>
                          <TableHead className="font-semibold text-gray-900 py-2 px-3 text-sm">Commission</TableHead>
                          <TableHead className="font-semibold text-gray-900 py-2 px-3 text-sm text-right">Net Receivable</TableHead>
                          <TableHead className="font-semibold text-gray-900 py-2 px-3 text-sm">Approx P/L</TableHead>
                          <TableHead className="font-semibold text-gray-900 py-2 px-3 text-sm">Actual P/L</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {details.symbols.map((singles) => (
                        <TableRow key={singles.symbol} className="hover:bg-gray-50">
                          <TableCell className="font-medium py-2 px-3 text-sm">{singles.symbol}</TableCell>
                          <TableCell className="py-2 px-3 text-sm">{singles._sum.quantity?.toLocaleString()}</TableCell>
                          <TableCell className="py-2 px-3 text-sm">{(singles._sum.txn_value && singles._sum.quantity) ? ((singles._sum.txn_value / singles._sum.quantity).toFixed(2)) : 0}</TableCell>
                          <TableCell className="py-2 px-3 text-sm">{singles._sum.txn_value?.toLocaleString()}</TableCell>
                          <TableCell className="py-2 px-3 text-sm">{singles._sum.commission_amount?.toLocaleString()}</TableCell>
                          <TableCell className="text-right py-2 px-3 text-sm">{singles._sum.net_receivable?.toLocaleString()}</TableCell>
                          <TableCell className="text-right py-2 px-3 text-sm">{singles._sum.approx_profit_loss?.toLocaleString()}</TableCell>
                          <TableCell className="text-right py-2 px-3 text-sm">{singles._sum.profit_loss?.toLocaleString()}</TableCell>
                        </TableRow>
                        ))}
                        {/* Grand Total Row for Sell Records */}
                        <TableRow className="border-t-2 border-gray-300 bg-gray-100">
                          <TableCell className="font-bold text-gray-900 py-2 px-3 text-sm">GRAND TOTAL</TableCell>
                          <TableCell className="font-bold text-red-700 py-2 px-3 text-sm">
                            {details.symbols.reduce((sum, item) => sum + (item._sum.quantity || 0), 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="font-bold text-gray-900 py-2 px-3 text-sm">-</TableCell>
                          <TableCell className="font-bold text-red-700 py-2 px-3 text-sm">
                            {details.symbols.reduce((sum, item) => sum + (item._sum.txn_value || 0), 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="font-bold text-amber-700 py-2 px-3 text-sm">
                            {details.symbols.reduce((sum, item) => sum + (item._sum.commission_amount || 0), 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-bold text-blue-700 py-2 px-3 text-sm">
                            {details.symbols.reduce((sum, item) => sum + (item._sum.net_receivable || 0), 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-bold text-purple-700 py-2 px-3 text-sm">
                            {details.symbols.reduce((sum, item) => sum + (item._sum.approx_profit_loss || 0), 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-bold text-green-700 py-2 px-3 text-sm">
                            {details.symbols.reduce((sum, item) => sum + (item._sum.profit_loss || 0), 0).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                      </Table>
                      </div>
                      </div>
                  ))
                  }

                </TabsContent>

              </Tabs>
              </div>
              {
              !orders.is_confirmed && (
                <div className="flex justify-end pt-6 border-t border-gray-200 flex-shrink-0 bg-white">
                  <DialogClose asChild>
                    <Button 
                      onClick={handleRecordSave} 
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2"
                    >
                      Save Record
                    </Button>
                  </DialogClose>
                </div>
              )
            }
            
            </DialogContent>
        </Dialog>
        </form>

        {/* Only show delete button if record is NOT confirmed */}
        {!orders.is_confirmed && (
          <form action={handleDelete} id={`${orders.upload_id}-${orders.file_name}`}>
            <input value={`${orders.upload_id}`} type="hidden" name="upload-id" readOnly/>
            <input value={`${orders.file_name}`} type="hidden" name="file-name" readOnly/>
          <Dialog>
          <DialogTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 hover:border-red-300"
              >
                <Trash className="h-4 w-4" />
                Delete
              </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>⚠️ Confirm Deletion</DialogTitle>
              <DialogDescription>Are you sure you want to delete this record?</DialogDescription>
            </DialogHeader>
              <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">No</Button>
              </DialogClose>
              <DialogClose asChild>
              <Button type="submit" form={`${orders.upload_id}-${orders.file_name}`} className="bg-red-500 hover:bg-red-600">Yes, Delete</Button>
            </DialogClose>
            </DialogFooter>
          </DialogContent>
      </Dialog>
      </form>
        )}
        </div>
    </CardAction>
  </CardHeader>
</Card>


    ))}
    
    {/* Pagination */}
    {listOrders && listOrders.length > 0 && (
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        itemsPerPage={itemsPerPage}
        totalItems={totalUploads}
      />
    )}
    </div>
    )
}