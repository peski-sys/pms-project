"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, Split, X } from "lucide-react"
import { InsufficientBalanceError } from "@/app/api/upload/validation"
import { toast } from "sonner"

interface InsufficientBalanceDialogProps {
  isOpen: boolean
  onClose: () => void
  errors: InsufficientBalanceError[]
  fileName: string
  uploadId: number
}

export function InsufficientBalanceDialog({
  isOpen,
  onClose,
  errors,
  fileName,
  uploadId
}: InsufficientBalanceDialogProps) {

  const totalShortfall = errors.reduce((sum, error) => sum + error.shortfall, 0)
  const uniqueSymbols = [...new Set(errors.map(error => error.symbol))]
  const uniqueClients = [...new Set(errors.map(error => error.client_id))]

  const handleStockSplitterOpen = () => {
    // Find the stock splitter trigger button and click it
    const stockSplitterTrigger = document.querySelector('[data-stock-splitter-trigger]') as HTMLButtonElement
    if (stockSplitterTrigger) {
      stockSplitterTrigger.click()
      onClose() // Close the insufficient balance dialog
    } else {
      toast.error('Stock Splitter not available. Please navigate to the main dashboard.')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader className="pb-4 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold text-red-700">
                  Insufficient Balance Detected
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-600 mt-1">
                  Cannot confirm upload "{fileName}" due to insufficient stock quantities
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            {/* Summary Alert */}
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <AlertDescription className="text-red-700">
                <div className="space-y-1">
                  <p className="font-medium">
                    Found {errors.length} insufficient balance error(s) affecting {uniqueClients.length} client(s) and {uniqueSymbols.length} symbol(s)
                  </p>
                  <p className="text-sm">
                    Total shortfall: <span className="font-semibold">{totalShortfall.toLocaleString()} shares</span>
                  </p>
                </div>
              </AlertDescription>
            </Alert>

            {/* Detailed Error Table */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold text-gray-900">Client</TableHead>
                    <TableHead className="font-semibold text-gray-900">Symbol</TableHead>
                    <TableHead className="font-semibold text-gray-900 text-right">Required</TableHead>
                    <TableHead className="font-semibold text-gray-900 text-right">Available</TableHead>
                    <TableHead className="font-semibold text-gray-900 text-right">Shortfall</TableHead>
                    <TableHead className="font-semibold text-gray-900">Contract</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {errors.map((error, index) => (
                    <TableRow key={index} className="hover:bg-gray-50">
                      <TableCell className="font-medium">
                        <div>
                          <div className="font-semibold text-gray-900">{error.client_name}</div>
                          <div className="text-xs text-gray-500">{error.client_id}</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-blue-600">
                        {error.symbol}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {error.required_quantity.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {error.available_quantity.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        -{error.shortfall.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500 font-mono">
                        {error.contract_number}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Resolution Instructions */}
            <Alert className="border-blue-200 bg-blue-50">
              <Split className="h-4 w-4 text-blue-500" />
              <AlertDescription className="text-blue-700">
                <div className="space-y-2">
                  <p className="font-medium">How to resolve this issue:</p>
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>Use the <strong>Stock Splitter</strong> tool to redistribute shares between clients</li>
                    <li>Transfer sufficient quantities from clients with excess holdings</li>
                    <li>Ensure all clients have adequate balances for their sell orders</li>
                    <li>Return to confirm the upload once balances are corrected</li>
                  </ol>
                </div>
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter className="pt-6 border-t border-gray-200 flex-shrink-0 bg-white">
            <div className="flex items-center justify-between w-full">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Close
              </Button>
              <Button
                onClick={handleStockSplitterOpen}
                className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
              >
                <Split className="h-4 w-4" />
                Open Stock Splitter
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  )
}
