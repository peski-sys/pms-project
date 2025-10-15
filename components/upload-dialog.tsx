"use client";

import { Button } from "@/components/ui/button"
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

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, File, X } from "lucide-react"
import { useState } from "react"
import { fileSubmitted } from "@/app/api/upload/actions";


export function UploadBook({onUpload} : {onUpload?: () => void}) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File[] | null>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      setSelectedFile(Array.from(files))
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files

    if(!files) {return}

    if (files && (files.length > 0) && (files.length <= 2)) {
      setSelectedFile(Array.from(files))
    }
  }

  const handleFileUpload = async () => {
    await fileSubmitted(selectedFile);
    if (onUpload) {onUpload()}
  }


  const removeFile = () => {
    setSelectedFile(null)
  }

  return (
    <Dialog>
      <form id="fileSubmission" action={handleFileUpload}>
        <DialogTrigger asChild>
          <Button variant="outline" size="default" className="font-bold">+ Upload Order Book</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-center">Upload Your File</DialogTitle>
            <DialogDescription className="text-center">
              Choose a file or drag and drop it here
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Drag & Drop Area */}
            <div 
              className={`flex items-center justify-center w-full h-48 border-2 border-dashed rounded-lg transition-colors ${
                isDragOver 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {selectedFile ? (
  <div className="flex flex-col items-center space-y-2">
    {selectedFile.map((details) => (
      <div className="flex flex-col items-center space-y-2" key={details.name}>
        <File className="size-8 text-blue-500" />
        <p className="text-sm font-medium text-gray-700">{details.name}</p>
      </div>
    ))}
    <div>
      <Button 
        type="button" 
        variant="ghost" 
        size="sm" 
        onClick={removeFile}
        className="text-red-500 hover:text-red-700"
      >
        <X className="size-4 mr-1" />
        Remove
      </Button>
    </div>
  </div>
) : (
  <div className="flex flex-col items-center space-y-2">
    <Upload className="size-8 text-gray-400" />
    <p className="text-sm text-gray-600">Drag and drop your file here</p>
    <p className="text-xs text-gray-500">or</p>
  </div>
)}

            </div>

            {/* Browse Button */}
            <div className="flex justify-center">
              <Input
                type="file"
                name="file-upload"
                id="file-upload"
                className="hidden"
                onChange={handleFileSelect}
                accept=".xlsx,.xls, .pdf"
                multiple
              />
              <Label 
                htmlFor="file-upload" 
                className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Upload className="size-4 mr-2" />
                Browse Files
              </Label>
            </div>

            {/* File Info */}
            {selectedFile && (
              selectedFile.map((details) => (
              <div className="text-xs text-gray-500 text-center" key={details.name}>
                File size: {(details.size / 1024 / 1024).toFixed(2)} MB
              </div>
            )))}
          </div>
          <DialogFooter className="mt-6">
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <DialogClose asChild>
            <Button type="submit" disabled={!selectedFile} form="fileSubmission">
              Upload
            </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </form>
    </Dialog>
  )
}
