"use client"

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { getSectors } from '@/app/api/listedAPI/actions'
import { Check, X } from 'lucide-react'

type SectorSuggestion = {
  sector_id: number
  sector_name: string
  instrument_type: string
}

interface PromoterSectorAutocompleteProps {
  defaultValue?: string
  placeholder?: string
  onConfirm?: (sector: SectorSuggestion | null) => void
  disabled?: boolean
}

export function PromoterSectorAutocomplete({ 
  defaultValue = "",
  placeholder = "Select promoter sector...",
  onConfirm,
  disabled = false
}: PromoterSectorAutocompleteProps) {
  const [value, setValue] = useState(defaultValue)
  const [suggestions, setSuggestions] = useState<SectorSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedSector, setSelectedSector] = useState<SectorSuggestion | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Initialize with defaultValue
  useEffect(() => {
    setValue(defaultValue)
    setHasChanges(false)
    setSelectedSector(null)
  }, [defaultValue])

  // Fetch suggestions when user types
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (value.length > 0 && showSuggestions) {
        setIsLoading(true)
        try {
          const sectors = await getSectors(value)
          setSuggestions(sectors)
        } catch (error) {
          console.error('Error fetching sector suggestions:', error)
          setSuggestions([])
        } finally {
          setIsLoading(false)
        }
      } else {
        setSuggestions([])
      }
    }

    const timeoutId = setTimeout(fetchSuggestions, 300) // Debounce
    return () => clearTimeout(timeoutId)
  }, [value, showSuggestions])

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setValue(newValue)
    setHasChanges(true)
    setShowSuggestions(true) // Show suggestions when typing
    
    // Reset selected sector when typing
    if (selectedSector) {
      setSelectedSector(null)
    }
  }

  const handleInputFocus = () => {
    // Show suggestions when focused, especially if there's already a value
    if (value.length > 0) {
      setShowSuggestions(true)
    }
  }

  const handleInputClick = () => {
    // Show suggestions when clicking on input
    if (value.length > 0) {
      setShowSuggestions(true)
    }
  }

  const handleSuggestionClick = (suggestion: SectorSuggestion) => {
    setValue(suggestion.sector_name)
    setSelectedSector(suggestion)
    setHasChanges(suggestion.sector_name !== defaultValue)
    setShowSuggestions(false)
  }

  const handleConfirm = () => {
    if (onConfirm && selectedSector) {
      onConfirm(selectedSector)
      setHasChanges(false)
      // Update defaultValue to the confirmed value
      setValue(selectedSector.sector_name)
    }
  }

  const handleClear = () => {
    setValue(defaultValue)
    setSelectedSector(null)
    setHasChanges(false)
    setShowSuggestions(false)
    if (onConfirm) {
      onConfirm(null)
    }
  }

  const handleCancel = () => {
    setValue(defaultValue)
    setSelectedSector(null)
    setHasChanges(false)
    setShowSuggestions(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
    if (e.key === 'Enter' && selectedSector) {
      e.preventDefault()
      handleConfirm()
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Input
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onClick={handleInputClick}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className="min-w-[200px]"
        />
        
        {showSuggestions && (
          <div
            ref={suggestionsRef}
            className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
          >
            {isLoading && (
              <div className="px-3 py-2 text-sm text-gray-500">Loading...</div>
            )}
            {!isLoading && suggestions.length > 0 && suggestions.map((suggestion) => (
              <div
                key={suggestion.sector_id}
                className="px-3 py-2 cursor-pointer hover:bg-gray-100 border-b last:border-b-0"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                <div className="font-medium text-sm">{suggestion.sector_name}</div>
                <div className="text-xs text-gray-500">{suggestion.instrument_type}</div>
              </div>
            ))}
            {!isLoading && suggestions.length === 0 && value.length > 0 && (
              <div className="px-3 py-2 text-sm text-gray-500">No sectors found</div>
            )}
            {!isLoading && suggestions.length === 0 && value.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-500">Start typing to search sectors...</div>
            )}
          </div>
        )}
      </div>
      
      {hasChanges && (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={handleConfirm}
            disabled={disabled || !selectedSector}
            className="h-8 px-2"
            title="Confirm selection"
          >
            <Check className="w-3 h-3" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleCancel}
            disabled={disabled}
            className="h-8 px-2"
            title="Cancel changes"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}
      {!hasChanges && defaultValue && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleClear}
          disabled={disabled}
          className="h-8 px-2"
          title="Clear selection"
        >
          <X className="w-3 h-3" />
        </Button>
      )}
    </div>
  )
}

