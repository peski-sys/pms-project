"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, File, X, FileText, FileSpreadsheet } from "lucide-react"
import { fileSubmitted } from "@/app/api/upload/actions"
import { toast } from "sonner"
import { useGlobalDragDrop } from "@/hooks/use-global-drag-drop"

interface GlobalDragDropProps {
  children: React.ReactNode
}

export function GlobalDragDrop({ children }: GlobalDragDropProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const router = useRouter()

  const handleFilesDropped = useCallback((files: File[]) => {
    setSelectedFiles(files)
    setIsDialogOpen(true)
  }, [])

  const handleDragStateChange = useCallback((isDragging: boolean) => {
    // You can add additional logic here if needed
    // For example, showing/hiding UI elements based on drag state
  }, [])

  const { isDragOver } = useGlobalDragDrop({
    acceptedTypes: ['.xlsx', '.xls', '.pdf'],
    onFilesDropped: handleFilesDropped,
    onDragStateChange: handleDragStateChange
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const validFiles = Array.from(files).filter(file => 
        file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.pdf')
      )
      setSelectedFiles(validFiles)
    }
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return
    
    try {
      setIsUploading(true)
      await fileSubmitted(selectedFiles)
      toast.success("Files uploaded successfully!")
      setIsDialogOpen(false)
      setSelectedFiles([])
      // Navigate to order-books page
      router.push('/dashboard/order-books')
    } catch (error) {
      console.error('Upload error:', error)
      toast.error("Failed to upload files. Please try again.")
    } finally {
      setIsUploading(false)
    }
  }

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.pdf')) {
      return <FileText className="w-6 h-6 text-red-500" />
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      return <FileSpreadsheet className="w-6 h-6 text-green-500" />
    }
    return <File className="w-6 h-6 text-gray-500" />
  }

  return (
    <>
      {/* Main content */}
      <div className="relative">
        {children}
        
        {/* Global drag overlay */}
        {isDragOver && (
          <div className="fixed inset-0 z-50 bg-blue-500/20 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-white rounded-xl shadow-2xl p-8 border-2 border-dashed border-blue-500 max-w-md mx-4 animate-pulse">
              <div className="text-center">
                <div className="relative mb-4">
                  <Upload className="w-12 h-12 text-blue-500 mx-auto" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Drop Files to Upload
                </h3>
                <p className="text-gray-600 mb-2">
                  Release to open the order book upload dialog
                </p>
                <div className="bg-blue-50 rounded-lg p-3 mb-3">
                  <p className="text-sm text-blue-700 font-medium">
                    📁 Will navigate to Order Books page after upload
                  </p>
                </div>
                <p className="text-sm text-gray-500">
                  Supports .xlsx, .xls, and .pdf files
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Upload Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-center">Upload Order Book Files</DialogTitle>
            <DialogDescription className="text-center">
              Files detected! Review and upload to your order books.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Selected Files Display */}
            {selectedFiles.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Selected Files:</h4>
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getFileIcon(file.name)}
                      <div>
                        <p className="text-sm font-medium text-gray-900">{file.name}</p>
                        <p className="text-xs text-gray-500">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add More Files */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
              <div className="text-center">
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 mb-2">Add more files</p>
                <Input
                  type="file"
                  id="additional-files"
                  className="hidden"
                  onChange={handleFileSelect}
                  accept=".xlsx,.xls,.pdf"
                  multiple
                />
                <Label 
                  htmlFor="additional-files" 
                  className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Browse Files
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setIsDialogOpen(false)
                setSelectedFiles([])
              }}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUpload}
              disabled={selectedFiles.length === 0 || isUploading}
              className="min-w-[120px]"
            >
              {isUploading ? (
                <>
                  <Upload className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload & Go to Order Books
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
