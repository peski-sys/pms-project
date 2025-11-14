"use client"

import { useState, useEffect, useRef } from "react"

interface UseGlobalDragDropOptions {
  acceptedTypes?: string[]
  onFilesDropped?: (files: File[]) => void
  onDragStateChange?: (isDragging: boolean) => void
}

export function useGlobalDragDrop({
  acceptedTypes = ['.xlsx', '.xls', '.pdf'],
  onFilesDropped,
  onDragStateChange
}: UseGlobalDragDropOptions = {}) {
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounterRef = useRef(0)

  const isValidFile = (file: File) => {
    return acceptedTypes.some(type => file.name.toLowerCase().endsWith(type.toLowerCase()))
  }

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault()
      dragCounterRef.current++
      
      if (e.dataTransfer?.items) {
        const hasValidFiles = Array.from(e.dataTransfer.items).some(item => {
          if (item.kind === 'file') {
            const file = item.getAsFile()
            return file && isValidFile(file)
          }
          return false
        })
        
        if (hasValidFiles) {
          setIsDragOver(true)
          onDragStateChange?.(true)
        }
      }
    }

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
    }

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault()
      dragCounterRef.current--
      
      if (dragCounterRef.current === 0) {
        setIsDragOver(false)
        onDragStateChange?.(false)
      }
    }

    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      dragCounterRef.current = 0
      setIsDragOver(false)
      onDragStateChange?.(false)
      
      const files = Array.from(e.dataTransfer?.files || [])
      const validFiles = files.filter(isValidFile)
      
      if (validFiles.length > 0) {
        onFilesDropped?.(validFiles)
      }
    }

    // Add event listeners to document
    document.addEventListener('dragenter', handleDragEnter)
    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('dragleave', handleDragLeave)
    document.addEventListener('drop', handleDrop)

    return () => {
      document.removeEventListener('dragenter', handleDragEnter)
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('dragleave', handleDragLeave)
      document.removeEventListener('drop', handleDrop)
    }
  }, [acceptedTypes, onFilesDropped, onDragStateChange])

  return {
    isDragOver,
    isValidFile
  }
}
