'use client'
import { getForStock } from '@/app/api/individualStocksAPI/actions'
import { use } from 'react'
import { useState, useEffect } from 'react'
import { fetchStockInformation } from '@/app/api/stockSlugAPI/actions'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts'
import { TrendingUp, ArrowUp, ArrowDown, Mail, Building2 } from 'lucide-react'
import { Badge } from "@/components/ui/badge"

import { RefreshCw } from 'lucide-react'

type BasicInfo = {
  openPrice: number
  highPrice: number
  lowPrice: number
  totalTradeQuantity: number
  totalTradeValue: number
  lastTradedPrice: number
  perChange: number
  schange: string
  lastUpdatedDateTime: string
  lastUpdatedDate: string
  totalTrades: number
  previousClose: number
  marketCapitalization: number
  fiftyTwoWeekHigh: number
  fiftyTwoWeekLow: number
  averageTradedPrice: number
  companyName: string
  symbol: string
  instrumentType: string
  public: string
  promoter: string
  companyEmail: string
  sectorName: string
  cap_type: string | null
}

type ReportInfo = {
  name: string
  avg: number
  ratio_value: number
}

type stockInfoType = {
  basicInfo: BasicInfo
  reportInfo: ReportInfo[]
}


type individual_stocks_type = {
    symbol: string,
    full_form: string,
    sector_id: number,
}

// Chart configurations
const shareHoldingConfig = {
  public: {
    label: "Public Shares",
    color: "#3b82f6", // Blue
  },
  promoter: {
    label: "Promoter Shares",
    color: "#f59e0b", // Amber/Orange
  },
} satisfies ChartConfig

const ratioConfig = {
  company: {
    label: "Company",
    color: "#10b981", // Emerald/Green
  },
  industry: {
    label: "Industry Average",
    color: "#8b5cf6", // Violet/Purple
  },
} satisfies ChartConfig

export default function StocksPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)

  const [stockDetails, setstockDetails] = useState<individual_stocks_type | null>(null)
  const [stockInfo, setStockInfo] = useState<stockInfoType | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
    
  const fetchStockDetails = async () => {
    try {
      setIsLoading(true)
      setError(null) // Clear any previous errors
      
      const stock: individual_stocks_type | '' = await getForStock(slug)
      if (stock) {
        setstockDetails(stock)
      }

      const info: any = await fetchStockInformation(slug.toUpperCase())
      
      // Check if API returned error status
      if (info && info.status === 'error') {
        setStockInfo(null)
        setError(`Stock information for "${slug}" is currently unavailable. Stock Information is available only for Equity Stocks.`)
      } else if (info && info.basicInfo && info.reportInfo) {
        setStockInfo(info as stockInfoType)
        setError(null)
      } else {
        setStockInfo(null)
        setError('Received invalid data format from the server. Please try again later.')
      }
    } catch (error) {
      setStockInfo(null)
      setError('Failed to connect to the server. Please check your internet connection and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchStockDetails();
  }, [slug])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="animate-spin size-6 mx-auto mb-2" />
      </div>
    )
  }

  if (!stockInfo && !isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="mb-4">
            <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Stock Information Unavailable</h2>
          <p className="text-gray-600 mb-4">
            {error || 'Unable to load stock information at this time.'}
          </p>
          <button 
            onClick={() => fetchStockDetails()}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
          >
            Try Again
          </button>
          <p className="text-sm text-gray-500 mt-4">
            Stock Symbol: <span className="font-mono font-semibold">{slug}</span>
          </p>
        </div>
      </div>
    )
  }

  // Early return handled above, so stockInfo is guaranteed to be non-null here
  if (!stockInfo) {
    return null // This shouldn't happen due to the check above, but TypeScript safety
  }

  const { basicInfo, reportInfo } = stockInfo

  // Prepare data for charts
  const shareHoldingData = [
    {
      name: 'Public',
      value: parseInt(basicInfo.public),
      fill: '#3b82f6' // Blue
    },
    {
      name: 'Promoter',
      value: parseInt(basicInfo.promoter),
      fill: '#f59e0b' // Amber/Orange
    }
  ]

  const ratioComparisonData = reportInfo.map(item => ({
    name: item.name.replace('/', '/\n'),
    company: item.ratio_value,
    industry: item.avg
  }))

  const formatNumber = (num: number) => {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B'
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M'
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K'
    return num.toFixed(2)
  }

  const formatCurrency = (amount: number) => {
    return `Rs. ${amount.toLocaleString()}`
  }

  const isPositiveChange = basicInfo.perChange >= 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Enhanced Header Section */}
      <div className="bg-white shadow-lg border-b border-gray-100">
        <div className="mx-auto max-w-[98%] px-2 sm:px-4 lg:px-6 py-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center space-x-4 mb-4">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                      {basicInfo.symbol}
                    </h1>
                    <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-800 border-emerald-200">
                      {basicInfo.instrumentType}
                    </Badge>
                    {basicInfo.cap_type && (
                      <Badge variant="outline" className="text-xs border-gray-300">
                        {basicInfo.cap_type}
                      </Badge>
                    )}
                  </div>
                  <h2 className="text-lg text-gray-700 mb-3 font-medium">{basicInfo.companyName}</h2>
                  <div className="flex flex-wrap items-center gap-6 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-emerald-600" />
                      <span className="font-medium">{basicInfo.sectorName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-emerald-600" />
                      <span>{basicInfo.companyEmail}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                      <span className="font-medium">Market Cap: {formatNumber(basicInfo.marketCapitalization)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex-shrink-0">
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-6 border border-gray-200">
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-900 mb-2 leading-tight">
                    {formatCurrency(basicInfo.lastTradedPrice)}
                  </div>
                  <div className={`flex items-center justify-end gap-2 text-lg font-bold mb-2 ${
                    isPositiveChange ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {isPositiveChange ? <ArrowUp className="w-5 h-5" /> : <ArrowDown className="w-5 h-5" />}
                    <span>{basicInfo.schange}</span>
                    <span className="text-base">({basicInfo.perChange.toFixed(2)}%)</span>
                  </div>
                  <div className="text-xs text-gray-600 bg-white px-3 py-1 rounded-full border">
                    Updated: {new Date(basicInfo.lastUpdatedDateTime).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Live Data Indicator */}
          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span>Live Market Data</span>
            </div>
            <button 
              onClick={() => fetchStockDetails()}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Data
            </button>
          </div>
        </div>
      </div>

      {/* Content Section with full width utilization */}
      <div className="mx-auto max-w-[98%] px-2 sm:px-4 lg:px-6 py-8 space-y-8">

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Price Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Enhanced Market Data */}
          <Card className="bg-white shadow-lg border border-gray-100">
            <CardHeader className="pb-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-gray-100">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-emerald-500 rounded-full mr-2"></div>
                <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  Market Data & Price Analysis
                </CardTitle>
              </div>
              <p className="text-sm text-gray-600 mt-1">Real-time trading metrics and price movements</p>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="text-center p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                  <div className="text-sm font-medium text-gray-600 mb-2">Opening Price</div>
                  <div className="text-base font-bold text-gray-900">{formatCurrency(basicInfo.openPrice)}</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl border border-green-200">
                  <div className="text-sm font-medium text-green-700 mb-2">Day High</div>
                  <div className="text-base font-bold text-green-800">{formatCurrency(basicInfo.highPrice)}</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-red-50 to-rose-100 rounded-xl border border-red-200">
                  <div className="text-sm font-medium text-red-700 mb-2">Day Low</div>
                  <div className="text-base font-bold text-red-800">{formatCurrency(basicInfo.lowPrice)}</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl border border-blue-200">
                  <div className="text-sm font-medium text-blue-700 mb-2">Previous Close</div>
                  <div className="text-base font-bold text-blue-800">{formatCurrency(basicInfo.previousClose)}</div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl shadow-lg">
                  <div className="text-sm font-medium text-blue-100 mb-2">52-Week High</div>
                  <div className="text-xl font-bold">{formatCurrency(basicInfo.fiftyTwoWeekHigh)}</div>
                  <div className="text-xs text-blue-200 mt-1">Peak Performance</div>
                </div>
                <div className="text-center p-6 bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl shadow-lg">
                  <div className="text-sm font-medium text-purple-100 mb-2">52-Week Low</div>
                  <div className="text-xl font-bold">{formatCurrency(basicInfo.fiftyTwoWeekLow)}</div>
                  <div className="text-xs text-purple-200 mt-1">Lowest Point</div>
                </div>
                <div className="text-center p-6 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-xl shadow-lg">
                  <div className="text-sm font-medium text-emerald-100 mb-2">Average Price</div>
                  <div className="text-xl font-bold">{formatCurrency(basicInfo.averageTradedPrice)}</div>
                  <div className="text-xs text-emerald-200 mt-1">Trading Average</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Trading Activity */}
          <Card className="bg-white shadow-lg border border-gray-100">
            <CardHeader className="pb-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                <CardTitle className="text-lg font-bold text-gray-900">Today's Trading Activity</CardTitle>
              </div>
              <p className="text-sm text-gray-600 mt-1">Live trading volume and transaction metrics</p>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl shadow-lg">
                  <div className="text-2xl font-bold mb-2">{basicInfo.totalTrades.toLocaleString()}</div>
                  <div className="text-sm text-blue-100 font-medium">Total Trades</div>
                  <div className="text-xs text-blue-200 mt-1">Transaction Count</div>
                </div>
                <div className="text-center p-6 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-xl shadow-lg">
                  <div className="text-2xl font-bold mb-2">{formatNumber(basicInfo.totalTradeQuantity)}</div>
                  <div className="text-sm text-green-100 font-medium">Volume Traded</div>
                  <div className="text-xs text-green-200 mt-1">Shares Exchanged</div>
                </div>
                <div className="text-center p-6 bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl shadow-lg">
                  <div className="text-2xl font-bold mb-2">{formatNumber(basicInfo.totalTradeValue)}</div>
                  <div className="text-sm text-purple-100 font-medium">Total Turnover</div>
                  <div className="text-xs text-purple-200 mt-1">Value Traded</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Financial Ratios Comparison */}
          <Card className="bg-white shadow-lg border border-gray-100">
            <CardHeader className="pb-4 bg-gradient-to-r from-violet-50 to-purple-50 border-b border-gray-100">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-violet-500 rounded-full mr-2"></div>
                <CardTitle className="text-lg font-bold text-gray-900">Financial Ratios vs Industry</CardTitle>
              </div>
              <p className="text-sm text-gray-600 mt-1">Comparative analysis of key financial metrics</p>
            </CardHeader>
            <CardContent className="p-6">
              <ChartContainer config={ratioConfig}>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={ratioComparisonData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                    <XAxis 
                      dataKey="name" 
                      textAnchor="end"
                      height={80}
                      fontWeight="bold"
                      className='mt-2'
                      fontSize={11}
                      tick={{ fill: '#6b7280' }}
                    />
                    <YAxis fontSize={11} tick={{ fill: '#6b7280' }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="company" fill="#10b981" name="Company" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="industry" fill="#8b5cf6" name="Industry Avg" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Right Sidebar */}
        <div className="space-y-8">
          {/* Enhanced Share Holding Pattern */}
          <Card className="bg-white shadow-lg border border-gray-100">
            <CardHeader className="pb-4 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-gray-100">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-orange-500 rounded-full mr-2"></div>
                <CardTitle className="text-lg font-bold text-gray-900">Share Holding Pattern</CardTitle>
              </div>
              <p className="text-sm text-gray-600 mt-1">Ownership distribution analysis</p>
            </CardHeader>
            <CardContent className="p-6">
              <ChartContainer config={shareHoldingConfig}>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={shareHoldingData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={120}
                      dataKey="value"
                      strokeWidth={2}
                      stroke="#ffffff"
                    >
                      {shareHoldingData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartTooltip 
                      content={<ChartTooltipContent />}
                      formatter={(value, name) => [formatNumber(Number(value)), '  ', name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
              
              <div className="mt-6 space-y-4">
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                    <span className="font-medium text-blue-900">Public Shares</span>
                  </div>
                  <span className="font-bold text-blue-800">{formatNumber(parseInt(basicInfo.public))}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full bg-amber-500"></div>
                    <span className="font-medium text-amber-900">Promoter Shares</span>
                  </div>
                  <span className="font-bold text-amber-800">{formatNumber(parseInt(basicInfo.promoter))}</span>
                </div>
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex justify-between items-center p-3 bg-gray-100 rounded-lg">
                    <span className="font-bold text-gray-900">Total Outstanding</span>
                    <span className="font-bold text-gray-900">{formatNumber(parseInt(basicInfo.public) + parseInt(basicInfo.promoter))}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Key Metrics */}
          <Card className="bg-white shadow-lg border border-gray-100">
            <CardHeader className="pb-4 bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-gray-100">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-indigo-500 rounded-full mr-2"></div>
                <CardTitle className="text-lg font-bold text-gray-900">Key Financial Metrics</CardTitle>
              </div>
              <p className="text-sm text-gray-600 mt-1">Performance indicators vs industry benchmarks</p>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                {reportInfo.map((metric, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-bold text-gray-900">{metric.name}</span>
                      <div className="text-right">
                        <div className="text-base font-bold text-gray-900">{metric.ratio_value.toFixed(2)}</div>
                        <div className="text-xs text-gray-600">vs {metric.avg.toFixed(2)} industry avg</div>
                      </div>
                    </div>
                    <div className="w-full bg-gray-300 rounded-full h-3 overflow-hidden">
                      <div 
                        className={`h-3 rounded-full transition-all duration-500 ${
                          metric.ratio_value > metric.avg 
                            ? 'bg-gradient-to-r from-green-500 to-emerald-600' 
                            : 'bg-gradient-to-r from-red-500 to-rose-600'
                        }`}
                        style={{
                          width: `${Math.min(Math.max((metric.ratio_value / (metric.avg * 2)) * 100, 10), 100)}%`
                        }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-2">
                      <span>Below Average</span>
                      <span>Above Average</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>
    </div>
  )
}
