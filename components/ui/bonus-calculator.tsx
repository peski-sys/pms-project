"use client"

import { useState, useEffect } from 'react'
import { getCurrentHoldings } from '@/app/api/sidebarAPIs/actions'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Calculator, TrendingUp, AlertTriangle } from 'lucide-react'

interface BonusCalculatorProps {
  fundName: string
  clientId: string
  symbol: string
  bonusPercent: number
  onCalculationComplete?: (bonusShares: number, currentHoldings: number) => void
}

type HoldingsResponse = {
  success: boolean
  message: string
  quantity: number
  symbol?: string
  clientId?: string
}

export function BonusSharesCalculator({ 
  fundName, 
  clientId, 
  symbol, 
  bonusPercent,
  onCalculationComplete 
}: BonusCalculatorProps) {
  const [holdings, setHoldings] = useState<HoldingsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [bonusShares, setBonusShares] = useState<number>(0)

  // Calculate bonus shares whenever inputs change
  useEffect(() => {
    const calculateBonusShares = async () => {
      // Reset states
      setError('')
      setBonusShares(0)
      
      // Validate inputs
      if (!fundName || !clientId || !symbol || bonusPercent <= 0) {
        setHoldings(null)
        return
      }

      if (bonusPercent > 1000) {
        setError('Bonus percentage cannot exceed 1000%')
        return
      }

      setIsLoading(true)

      try {
        const holdingsData = await getCurrentHoldings(fundName, clientId, symbol)
        setHoldings(holdingsData)

        if (holdingsData.success && holdingsData.quantity > 0) {
          // Calculate bonus shares: (current holdings * bonus %) / 100
          const calculatedBonusShares = Math.floor((holdingsData.quantity * bonusPercent) / 100)
          setBonusShares(calculatedBonusShares)
          
          // Notify parent component
          onCalculationComplete?.(calculatedBonusShares, holdingsData.quantity)
          
          if (calculatedBonusShares === 0 && bonusPercent > 0) {
            setError('Bonus percentage too low to generate whole shares')
          }
        } else {
          setError(holdingsData.message)
        }
      } catch (err) {
        setError('Failed to fetch holdings data')
        console.error('Bonus calculation error:', err)
      } finally {
        setIsLoading(false)
      }
    }

    const timeoutId = setTimeout(calculateBonusShares, 300) // Debounce
    return () => clearTimeout(timeoutId)
  }, [fundName, clientId, symbol, bonusPercent, onCalculationComplete])

  // Don't render if no valid inputs
  if (!fundName || !clientId || !symbol || bonusPercent <= 0) {
    return null
  }

  return (
    <div className="border rounded-lg p-4 bg-blue-50 space-y-3">
      <div className="flex items-center gap-2">
        <Calculator className="w-4 h-4 text-blue-600" />
        <span className="text-sm font-medium text-blue-800">Bonus Shares Calculator</span>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Calculating bonus shares...</span>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {holdings && holdings.success && !isLoading && !error && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="bg-white p-2 rounded border">
              <div className="text-gray-600">Current Holdings</div>
              <div className="font-bold text-lg text-gray-900">
                {holdings.quantity.toLocaleString()} shares
              </div>
            </div>
            
            <div className="bg-white p-2 rounded border">
              <div className="text-gray-600">Bonus Shares ({bonusPercent}%)</div>
              <div className="font-bold text-lg text-green-600 flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                {bonusShares.toLocaleString()} shares
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-600 bg-white p-2 rounded border">
            <div className="font-medium mb-1">Calculation Details:</div>
            <div>• Current Holdings: {holdings.quantity.toLocaleString()} shares</div>
            <div>• Bonus Rate: {bonusPercent}%</div>
            <div>• Formula: ({holdings.quantity.toLocaleString()} × {bonusPercent}%) ÷ 100 = {bonusShares.toLocaleString()} shares</div>
            {bonusShares !== ((holdings.quantity * bonusPercent) / 100) && (
              <div className="text-amber-600 mt-1">
                • Note: Fractional shares rounded down to whole numbers
              </div>
            )}
          </div>

          {bonusShares > 0 && (
            <div className="bg-green-50 border border-green-200 p-2 rounded text-center">
              <span className="text-sm font-medium text-green-800">
                ✓ {bonusShares.toLocaleString()} bonus shares will be added
              </span>
            </div>
          )}
        </div>
      )}

      {holdings && !holdings.success && !isLoading && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {holdings.message}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}