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

      const info: any = await fetchStockInformation(slug)
      
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
    <div className="min-h-screen bg-gray-50 p-4 space-y-6">
      {/* Header Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">{basicInfo.symbol}</h1>
              <Badge variant="secondary" className="text-sm">
                {basicInfo.instrumentType}
              </Badge>
            </div>
            <h2 className="text-lg text-gray-600 mb-2">{basicInfo.companyName}</h2>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <Building2 className="w-4 h-4" />
                {basicInfo.sectorName}
              </div>
              <div className="flex items-center gap-1">
                <Mail className="w-4 h-4" />
                {basicInfo.companyEmail}
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-4xl font-bold text-gray-900 mb-1">
              {formatCurrency(basicInfo.lastTradedPrice)}
            </div>
            <div className={`flex items-center justify-end gap-1 text-lg font-semibold ${
              isPositiveChange ? 'text-green-600' : 'text-red-600'
            }`}>
              {isPositiveChange ? <ArrowUp className="w-5 h-5" /> : <ArrowDown className="w-5 h-5" />}
              {basicInfo.schange} ({basicInfo.perChange.toFixed(2)}%)
            </div>
            <div className="text-sm text-gray-500">
              Last updated: {new Date(basicInfo.lastUpdatedDateTime).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Price Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Market Data */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Market Data
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-500 mb-1">Open</div>
                  <div className="font-semibold">{formatCurrency(basicInfo.openPrice)}</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-500 mb-1">High</div>
                  <div className="font-semibold text-green-600">{formatCurrency(basicInfo.highPrice)}</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-500 mb-1">Low</div>
                  <div className="font-semibold text-red-600">{formatCurrency(basicInfo.lowPrice)}</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-500 mb-1">Prev Close</div>
                  <div className="font-semibold">{formatCurrency(basicInfo.previousClose)}</div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-sm text-blue-600 mb-1">52W High</div>
                  <div className="text-lg font-bold text-blue-700">{formatCurrency(basicInfo.fiftyTwoWeekHigh)}</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-sm text-purple-600 mb-1">52W Low</div>
                  <div className="text-lg font-bold text-purple-700">{formatCurrency(basicInfo.fiftyTwoWeekLow)}</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Avg Price</div>
                  <div className="text-lg font-bold text-gray-700">{formatCurrency(basicInfo.averageTradedPrice)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Trading Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Today's Trading Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{basicInfo.totalTrades.toLocaleString()}</div>
                  <div className="text-sm text-gray-500">Total Trades</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{formatNumber(basicInfo.totalTradeQuantity)}</div>
                  <div className="text-sm text-gray-500">Volume</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{formatNumber(basicInfo.totalTradeValue)}</div>
                  <div className="text-sm text-gray-500">Turnover</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Financial Ratios Comparison */}
          <Card>
            <CardHeader>
              <CardTitle>Financial Ratios vs Industry</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={ratioConfig}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={ratioComparisonData}>
                    <XAxis 
                      dataKey="name" 
                      textAnchor="end"
                      height={80}
                      fontWeight="bold"
                      className='mt-2'
                      fontSize={12}
                    />
                    <YAxis fontSize={12} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="company" fill="#10b981" name="Company" />
                    <Bar dataKey="industry" fill="#8b5cf6" name="Industry Avg" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Share Holding Pattern */}
          <Card>
            <CardHeader>
              <CardTitle>Share Holding Pattern</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={shareHoldingConfig}>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={shareHoldingData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      dataKey="value"
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
              
              <div className="mt-4 space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{backgroundColor: '#3b82f6'}}></div>
                    <span className="text-sm">Public</span>
                  </div>
                  <span className="font-semibold">{formatNumber(parseInt(basicInfo.public))}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{backgroundColor: '#f59e0b'}}></div>
                    <span className="text-sm">Promoter</span>
                  </div>
                  <span className="font-semibold">{formatNumber(parseInt(basicInfo.promoter))}</span>
                </div>
                <div className="pt-2 border-t">
                  <div className="flex justify-between items-center font-bold">
                    <span>Total Shares</span>
                    <span>{formatNumber(parseInt(basicInfo.public) + parseInt(basicInfo.promoter))}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Key Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Key Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reportInfo.map((metric, index) => (
                  <div key={index} className="">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">{metric.name}</span>
                      <div className="text-right">
                        <div className="font-bold">{metric.ratio_value.toFixed(2)}</div>
                        <div className="text-xs text-gray-500">vs {metric.avg.toFixed(2)} avg</div>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          metric.ratio_value > metric.avg ? 'bg-green-500' : 'bg-red-500'
                        }`}
                        style={{
                          width: `${Math.min((metric.ratio_value / (metric.avg * 2)) * 100, 100)}%`
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
