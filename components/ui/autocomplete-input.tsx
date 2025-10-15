"use client"

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { getStockSymbols } from '@/app/api/sidebarAPIs/actions'

type StockSuggestion = {
  symbol: string
  full_form: string
}

interface AutocompleteInputProps {
  name: string
  placeholder?: string
  required?: boolean
  defaultValue?: string
  onValueChange?: (value: string) => void
}

export function AutocompleteInput({ 
  name, 
  placeholder, 
  required, 
  defaultValue = "",
  onValueChange 
}: AutocompleteInputProps) {
  const [value, setValue] = useState(defaultValue)
  const [suggestions, setSuggestions] = useState<StockSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (value.length > 0) {
        setIsLoading(true)
        try {
          const stocks = await getStockSymbols(value)
          setSuggestions(stocks)
          setShowSuggestions(true)
        } catch (error) {
          console.error('Error fetching suggestions:', error)
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
    const newValue = e.target.value.toUpperCase()
    setValue(newValue)
    onValueChange?.(newValue)
  }

  const handleSuggestionClick = (suggestion: StockSuggestion) => {
    setValue(suggestion.symbol)
    onValueChange?.(suggestion.symbol)
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
              key={suggestion.symbol}
              className="px-3 py-2 cursor-pointer hover:bg-gray-100 border-b last:border-b-0"
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <div className="font-medium text-sm">{suggestion.symbol}</div>
              <div className="text-xs text-gray-500 truncate">{suggestion.full_form}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}