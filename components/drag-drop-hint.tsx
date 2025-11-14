"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Upload } from "lucide-react"

export function DragDropHint() {
  const [hasShownHint, setHasShownHint] = useState(false)

  useEffect(() => {
    // Show hint after a delay when component mounts (only once per session)
    const hasShownBefore = sessionStorage.getItem('drag-drop-hint-shown')
    
    if (!hasShownBefore && !hasShownHint) {
      const timer = setTimeout(() => {
        toast.info(
          <div className="flex items-center space-x-2">
            <Upload className="w-4 h-4 text-blue-500" />
            <div>
              <p className="font-medium">Drag & Drop Available</p>
              <p className="text-xs text-gray-600">
                Drop .xlsx, .xls, or .pdf files anywhere to upload to Order Books
              </p>
            </div>
          </div>,
          {
            duration: 5000,
            position: "bottom-right"
          }
        )
        setHasShownHint(true)
        sessionStorage.setItem('drag-drop-hint-shown', 'true')
      }, 3000) // Show after 3 seconds

      return () => clearTimeout(timer)
    }
  }, [hasShownHint])

  return null // This component doesn't render anything visible
}
