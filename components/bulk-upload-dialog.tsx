"use client"

import { useState, useCallback } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, File, X, FileText, FileSpreadsheet, Calendar, CheckCircle, AlertCircle, Clock } from "lucide-react"
import { toast } from "sonner"
import { bulkUploadOrderBooks } from "@/app/api/upload/actions"

interface BulkUploadDialogProps {
  onUpload?: () => void
}

interface FileWithDate {
  file: File
  extractedDate: Date | null
  dateString: string
  isValid: boolean
  error?: string
}

export function BulkUploadDialog({ onUpload }: BulkUploadDialogProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<FileWithDate[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadResults, setUploadResults] = useState<Record<string, 'success' | 'error'> | null>(null)

  // Extract date from filename like "Order Book 29-10-2025.xlsx"
  const extractDateFromFilename = useCallback((filename: string): { date: Date | null, dateString: string, error?: string } => {
    try {
      // Remove file extension
      const nameWithoutExt = filename.replace(/\.(xlsx|xls|pdf)$/i, '')
      
      // Look for date pattern: DD-MM-YYYY or DD/MM/YYYY
      const datePattern = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/
      const match = nameWithoutExt.match(datePattern)
      
      if (!match) {
        return { 
          date: null, 
          dateString: 'No date found', 
          error: 'Date pattern not found in filename' 
        }
      }
      
      const [, day, month, year] = match
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      
      // Validate date
      if (isNaN(date.getTime())) {
        return { 
          date: null, 
          dateString: 'Invalid date', 
          error: 'Invalid date format' 
        }
      }
      
      return { 
        date, 
        dateString: date.toLocaleDateString('en-GB', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric' 
        })
      }
    } catch (error) {
      return { 
        date: null, 
        dateString: 'Parse error', 
        error: 'Failed to parse date from filename' 
      }
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const validFiles = Array.from(files).filter(file => 
        file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.pdf')
      )
      
      const filesWithDates: FileWithDate[] = validFiles.map(file => {
        const { date, dateString, error } = extractDateFromFilename(file.name)
        return {
          file,
          extractedDate: date,
          dateString,
          isValid: date !== null,
          error
        }
      })
      
      // Sort by date (oldest first), put invalid dates at the end
      filesWithDates.sort((a, b) => {
        if (!a.isValid && !b.isValid) return 0
        if (!a.isValid) return 1
        if (!b.isValid) return -1
        return a.extractedDate!.getTime() - b.extractedDate!.getTime()
      })
      
      setSelectedFiles(filesWithDates)
      
      setUploadResults(null) // Reset results
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer?.files || [])
    const validFiles = files.filter(file => 
      file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.pdf')
    )
    
    if (validFiles.length > 0) {
      const filesWithDates: FileWithDate[] = validFiles.map(file => {
        const { date, dateString, error } = extractDateFromFilename(file.name)
        return {
          file,
          extractedDate: date,
          dateString,
          isValid: date !== null,
          error
        }
      })
      
      // Sort by date (oldest first)
      filesWithDates.sort((a, b) => {
        if (!a.isValid && !b.isValid) return 0
        if (!a.isValid) return 1
        if (!b.isValid) return -1
        return a.extractedDate!.getTime() - b.extractedDate!.getTime()
      })
      
      setSelectedFiles(filesWithDates)
      
      setUploadResults(null) // Reset results
    }
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleBulkUpload = async () => {
    if (selectedFiles.length === 0) return
    
    try {
      setIsUploading(true)
      
      // Separate valid and invalid files
      const validFiles = selectedFiles.filter(f => f.isValid)
      const invalidFiles = selectedFiles.filter(f => !f.isValid)
      
      if (invalidFiles.length > 0) {
        toast.error(`${invalidFiles.length} files have invalid dates and will be skipped`)
      }
      
      if (validFiles.length === 0) {
        toast.error("No valid files to upload")
        return
      }
      
      // Process files sequentially by date
      const filesToProcess = validFiles.map(f => f.file)
      
      const result = await bulkUploadOrderBooks(filesToProcess)
      
      if (result && result.success) {
        // Create results map from server response
        const resultsMap: Record<string, 'success' | 'error'> = {}
        const errorDetails: Record<string, string> = {}
        
        result.results?.forEach((r: any) => {
          resultsMap[r.file] = r.status
          if (r.status === 'error' && r.error) {
            errorDetails[r.file] = r.error
          }
        })
        setUploadResults(resultsMap)
        
        // Show detailed success/error message
        const successCount = result.successCount || 0
        const errorCount = result.errorCount || 0
        const totalFiles = validFiles.length
        
        if (errorCount > 0) {
          // Show which files failed
          const failedFiles = Object.keys(errorDetails)
          toast.error(
            <div className="space-y-2">
              <p className="font-medium">
                Bulk upload completed: {successCount} successful, {errorCount} failed
              </p>
              <div className="text-sm">
                <p className="font-medium text-red-600">Failed files:</p>
                {failedFiles.map(file => (
                  <div key={file} className="ml-2">
                    <p className="font-medium">{file}</p>
                    <p className="text-xs text-gray-600">{errorDetails[file]}</p>
                  </div>
                ))}
              </div>
            </div>,
            { duration: 10000 }
          )
        } else {
          toast.success(`Bulk upload completed! All ${successCount} files processed successfully.`)
        }
        
        // Don't auto-close if there are errors - let user review
        if (errorCount === 0) {
          setTimeout(() => {
            setIsDialogOpen(false)
            setSelectedFiles([])
            setUploadResults(null)
            onUpload?.()
          }, 3000)
        }
      } else {
        toast.error(result?.error || "Bulk upload failed")
      }
      
    } catch (error) {
      console.error('Bulk upload error:', error)
      toast.error("Failed to upload files. Please try again.")
    } finally {
      setIsUploading(false)
    }
  }

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.pdf')) {
      return <FileText className="w-5 h-5 text-red-500" />
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      return <FileSpreadsheet className="w-5 h-5 text-green-500" />
    }
    return <File className="w-5 h-5 text-gray-500" />
  }

  const getStatusIcon = (fileName: string) => {
    if (!uploadResults) {
      return isUploading ? <Upload className="w-4 h-4 text-blue-500 animate-spin" /> : <Clock className="w-4 h-4 text-gray-400" />
    }
    
    const status = uploadResults[fileName]
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const getFileStatus = (fileName: string) => {
    if (!uploadResults) return null
    return uploadResults[fileName]
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="default" className="font-bold bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 hover:from-purple-600 hover:to-pink-600">
          <Upload className="w-4 h-4 mr-2" />
          Bulk Upload Order Books
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center flex items-center justify-center gap-2">
            <Calendar className="w-5 h-5 text-purple-500" />
            Bulk Upload Order Books
          </DialogTitle>
          <DialogDescription className="text-center">
            Upload multiple order book files. Files will be processed in chronological order (oldest first) and automatically confirmed to main tables.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* File Drop Zone */}
          <div 
            className="flex items-center justify-center w-full h-32 border-2 border-dashed border-purple-300 rounded-lg hover:border-purple-400 transition-colors bg-purple-50"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <div className="text-center">
              <Upload className="w-8 h-8 text-purple-400 mx-auto mb-2" />
              <p className="text-sm text-purple-600 mb-1">Drag and drop files here</p>
              <p className="text-xs text-gray-500">Supports .xlsx, .xls, and .pdf files</p>
            </div>
          </div>

          {/* File Browser */}
          <div className="flex justify-center">
            <Input
              type="file"
              id="bulk-file-upload"
              className="hidden"
              onChange={handleFileSelect}
              accept=".xlsx,.xls,.pdf"
              multiple
            />
            <Label 
              htmlFor="bulk-file-upload" 
              className="cursor-pointer inline-flex items-center px-4 py-2 border border-purple-300 rounded-md shadow-sm text-sm font-medium text-purple-700 bg-white hover:bg-purple-50"
            >
              <Upload className="w-4 h-4 mr-2" />
              Browse Files
            </Label>
          </div>

          {/* File List */}
          {selectedFiles.length > 0 && (
            <div className="space-y-3 max-h-60 overflow-y-auto">
              <h4 className="font-medium text-gray-900 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Files to Process ({selectedFiles.length})
              </h4>
              
              {selectedFiles.map((fileWithDate, index) => {
                const fileStatus = getFileStatus(fileWithDate.file.name)
                const borderColor = fileStatus === 'error' ? 'bg-red-50 border-red-200' : 
                                  fileStatus === 'success' ? 'bg-green-50 border-green-200' :
                                  fileWithDate.isValid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                
                return (
                <div key={index} className={`flex items-center justify-between p-3 rounded-lg border ${borderColor}`}>
                  <div className="flex items-center space-x-3 flex-1">
                    {getFileIcon(fileWithDate.file.name)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {fileWithDate.file.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-gray-500">
                          {(fileWithDate.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        {fileWithDate.isValid ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600">
                            <Calendar className="w-3 h-3" />
                            {fileWithDate.dateString}
                          </span>
                        ) : (
                          <span className="text-xs text-red-600">
                            {fileWithDate.error}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(fileWithDate.file.name)}
                      <span className="text-xs font-medium text-gray-500">
                        #{index + 1}
                      </span>
                    </div>
                  </div>
                  {!isUploading && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="text-red-500 hover:text-red-700 ml-2"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                )
              })}
            </div>
          )}

          {/* Upload Results Summary */}
          {uploadResults && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h5 className="font-medium text-gray-900 mb-2">Upload Results:</h5>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Successful: {Object.values(uploadResults).filter(s => s === 'success').length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span>Failed: {Object.values(uploadResults).filter(s => s === 'error').length}</span>
                </div>
              </div>
              {Object.values(uploadResults).some(s => s === 'error') && (
                <p className="text-xs text-red-600 mt-2">
                  Check the detailed error message in the notification above for failed files.
                </p>
              )}
            </div>
          )}

          {/* Upload Info */}
          {selectedFiles.length > 0 && !uploadResults && (
            <div className="bg-blue-50 rounded-lg p-4">
              <h5 className="font-medium text-blue-900 mb-2">Upload Process:</h5>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Files will be processed in chronological order (oldest first)</li>
                <li>• Excel files will be parsed and auto-confirmed to main tables</li>
                <li>• PDF files will be processed for buy/sell data</li>
                <li>• Invalid date formats will be skipped</li>
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="mt-6">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => {
              setIsDialogOpen(false)
              setSelectedFiles([])
              setUploadResults(null)
            }}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleBulkUpload}
            disabled={selectedFiles.length === 0 || isUploading || selectedFiles.filter(f => f.isValid).length === 0}
            className="min-w-[160px] bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          >
            {isUploading ? (
              <>
                <Upload className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Bulk Upload ({selectedFiles.filter(f => f.isValid).length} files)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
