"use client"

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { getSectors } from '@/app/api/listedAPI/actions'

type SectorSuggestion = {
  sector_id: number
  sector_name: string
  instrument_type: string
}

interface SectorAutocompleteInputProps {
  name: string
  placeholder?: string
  required?: boolean
  defaultValue?: string
  onValueChange?: (sector: SectorSuggestion | null) => void
}

export function SectorAutocompleteInput({ 
  name, 
  placeholder, 
  required, 
  defaultValue = "",
  onValueChange 
}: SectorAutocompleteInputProps) {
  const [value, setValue] = useState(defaultValue)
  const [suggestions, setSuggestions] = useState<SectorSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedSector, setSelectedSector] = useState<SectorSuggestion | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Sync with defaultValue changes (only if value doesn't match)
  useEffect(() => {
    if (defaultValue !== value && (!selectedSector || selectedSector.sector_name !== defaultValue)) {
      setValue(defaultValue)
      // Only reset selected sector if the new defaultValue doesn't match current selection
      if (defaultValue && selectedSector && selectedSector.sector_name !== defaultValue) {
        setSelectedSector(null)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValue])

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (value.length > 0) {
        setIsLoading(true)
        try {
          const sectors = await getSectors(value)
          setSuggestions(sectors)
          setShowSuggestions(true)
        } catch (error) {
          console.error('Error fetching sector suggestions:', error)
          setSuggestions([])
        } finally {
          setIsLoading(false)
        }
      } else {
        setSuggestions([])
        setShowSuggestions(false)
      }
    }

    const timeoutId = setTimeout(fetchSuggestions, 300) // Debounce
    return () => clearTimeout(timeoutId)
  }, [value])

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
    
    // Reset selected sector when typing
    if (selectedSector) {
      setSelectedSector(null)
      onValueChange?.(null)
    }
  }

  const handleSuggestionClick = (suggestion: SectorSuggestion) => {
    setValue(suggestion.sector_name)
    setSelectedSector(suggestion)
    onValueChange?.(suggestion)
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        name={name}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
      />
      
      {/* Hidden input for sector_id */}
      <input 
        type="hidden" 
        name={`${name}_id`} 
        value={selectedSector?.sector_id || ''} 
      />
      
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
        >
          {isLoading && (
            <div className="px-3 py-2 text-sm text-gray-500">Loading...</div>
          )}
          {!isLoading && suggestions.map((suggestion) => (
            <div
              key={suggestion.sector_id}
              className="px-3 py-2 cursor-pointer hover:bg-gray-100 border-b last:border-b-0"
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <div className="font-medium text-sm">{suggestion.sector_name}</div>
              <div className="text-xs text-gray-500">{suggestion.instrument_type}</div>
            </div>
          ))}
        </div>
      )}
      
      {selectedSector && (
        <div className="mt-1 text-xs text-green-600">
          ✓ Selected: {selectedSector.sector_name} ({selectedSector.instrument_type})
        </div>
      )}
    </div>
  )
}