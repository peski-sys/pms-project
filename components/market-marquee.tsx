'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getMarketSnapshotsForMarquee, type MarketSnapshot } from '@/app/api/marketMarqueeAPI/actions'
import { TrendingDown, Activity, ChartCandlestick } from 'lucide-react'

export function MarketMarquee() {
  const [marketData, setMarketData] = useState<MarketSnapshot[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMarketData = async () => {
    try {
      setError(null)
      const data = await getMarketSnapshotsForMarquee()
      setMarketData(data)
    } catch (err) {
      console.error('Error fetching market data:', err)
      setError('Failed to load market data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchMarketData()
    
    // Refresh data every 30 seconds
    const interval = setInterval(fetchMarketData, 30000)
    
    return () => clearInterval(interval)
  }, [])

  const formatCurrency = (amount: number) => {
    return `Rs. ${amount.toLocaleString()}`
  }

  if (isLoading) {
    return (
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-2 overflow-hidden">
        <div className="flex items-center justify-center space-x-2">
          <Activity className="w-4 h-4 animate-pulse" />
          <span className="text-sm font-medium">Loading market data...</span>
        </div>
      </div>
    )
  }

  if (error || marketData.length === 0) {
    return (
      <div className="bg-gradient-to-r from-gray-600 to-gray-700 text-white py-2 overflow-hidden">
        <div className="flex items-center justify-center space-x-2">
          <TrendingDown className="w-4 h-4" />
          <span className="text-sm font-medium">
            {error || 'No market data available'}
          </span>
        </div>
      </div>
    )
  }

  // Duplicate the data to create seamless loop
  const duplicatedData = [...marketData, ...marketData]

  return (
    <div className="w-full bg-gradient-to-r from-slate-700 to-gray-800 text-white py-5 relative">
      {/* Live indicator */}
      <div className="absolute left-4 top-1/2 transform -translate-y-1/2 flex items-center space-x-2 z-10 bg-slate-800 px-3 py-1 rounded-full">
        <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
        <span className="text-xs font-bold">Latest Data</span>
      </div>
      
      {/* Fixed width scrolling container */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="flex animate-marquee whitespace-nowrap h-full items-center">
          {duplicatedData.map((stock, index) => (
            <Link
              key={`${stock.symbol}-${index}`}
              href={`/dashboard/stock/${stock.symbol}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 mx-4 px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg transition-all duration-200 hover:scale-105 cursor-pointer group flex-shrink-0"
            >
              <ChartCandlestick className="w-3 h-3 text-blue-300 group-hover:text-blue-200 fill-current" />
              <span className="font-bold text-sm">{stock.symbol}:</span>
              <span className="font-semibold text-sm text-gray-100">
                {formatCurrency(stock.ltp)}
              </span>
            </Link>
          ))}
        </div>
      </div>
      
      {/* Refresh indicator */}
      <div className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10">
        <button
          onClick={fetchMarketData}
          className="text-xs text-gray-300 hover:text-white transition-colors duration-200"
          title="Refresh market data"
        >
          <Activity className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

// Note: CSS animation styles are defined in globals.css
