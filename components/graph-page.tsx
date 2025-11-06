"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter
} from "@/components/ui/table"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { useState, useEffect, useMemo, useCallback } from "react"
import { getUsers, getComprehensivePortfolio, getInvestmentHighlights } from "@/app/api/dashboardAPICalls/actions"
import { 
  getSectorAllocation, 
  getDividendInfo,
  getPortfolioGainersLosers, 
  getAllIndex,
  getProfitLossToday
} from "@/app/api/graphsPageAPICalls/actions"
import {
  getSectorAllocationFiscal,
  getDividendInfoFiscal,
  getPortfolioGainersLosersFiscal,
  getInvestmentHighlightsFiscal,
  getComprehensivePortfolioFiscal,
  getFiscalID,
  getProfitLossTodayFiscal
} from "@/app/api/graphsPageFiscalAPI/actions"
import { 
  getCurrentFiscalYear,
  getAllFiscalYears
} from "@/app/api/fiscalYearDashboardAPI/actions"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"

import { 
  TrendingUp, 
  TrendingDown, 
  PieChart, 
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Activity,
  BarChart3,
  Calculator
} from "lucide-react"

import Link from "next/link"


import { CardSkeleton, TableSkeleton } from "@/components/ui/skeleton"
import { Pagination } from "@/components/ui/pagination"

import {
  Cell,
  Pie,
  PieChart as RechartsPieChart,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"

// Type definitions
type userList = {
  client_id: string,
  client_name: string,
  client_broker: number,
  recorded_at: Date | null,
}

type InvestmentHighlightsType = {
  tradingSecurities: number;
  listedEquityShares: number;
  maturitySecurities: number;
  totalInvestment: number;
  realizedGain: number;
  unrealizedGain: number;
  dividendIncome: number;
  netGain: number;
  realizedGainPercent: number;
  unrealizedGainPercent: number;
  netGainPercent: number;
}

type SectorAllocationType = {
  sector: string;
  value: number;
  percentage: number;
  fill: string;
}[]

type ComprehensivePortfolioType = {
  companyName: string;
  code: string;
  sector: string;
  quantity: number;
  bookValue: number;
  pricePerShare: number;
  marketRate: number;
  unrealisedPnL: number;
  pnlPercent: number;
  realisedPnL: number;
}[]

type DividendInfoType = {
  symbol: string;
  sector: string;
  dividendAmount: number;
}[]

type PortfolioGainersLosersType = {
  topGainers: {
    symbol: string;
    name: string;
    change: number;
    price: number;
    volume: number;
  }[];
  topLosers: {
    symbol: string;
    name: string;
    change: number;
    price: number;
    volume: number;
  }[];
}

type indexes = {
  sensitiveFloatIndex: number,
  sensitiveFloatChange: number,
  sensitiveFloatChangePercent: number,
  floatIndex: number,
  floatChange: number,
  floatChangePercent: number,
  sensitiveIndex: number,
  sensitiveChange: number,
  sensitiveChangePercent: number,
  nepseIndex: number,
  nepseChange: number,
  nepseChangePercent: number
}

const sectorChartConfig = {
  banking: {
    label: "Banking",
    color: "hsl(var(--chart-1))",
  },
  technology: {
    label: "Technology",
    color: "hsl(var(--chart-2))",
  },
  insurance: {
    label: "Insurance",
    color: "hsl(var(--chart-3))",
  },
  manufacturing: {
    label: "Manufacturing",
    color: "hsl(var(--chart-4))",
  },
  tourism: {
    label: "Hotel & Tourism",
    color: "hsl(var(--chart-5))",
  },
  hydropower: {
    label: "Hydropower",
    color: "hsl(var(--chart-6))",
  },
  others: {
    label: "Others",
    color: "hsl(var(--muted-foreground))",
  },
} satisfies ChartConfig

// Fiscal year types
type FiscalYearType = {
  fiscal_year_id: number;
  year_label: string;
  start_date: Date;
  end_date: Date;
}

export default function GraphPageComponent() {
  // State variables
  const [selectValue, setselectValue] = useState<string>("")
  const [listUsersValue, setlistUsersValue] = useState<userList[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [investmentHighlights, setInvestmentHighlights] = useState<InvestmentHighlightsType | null>(null)
  const [sectorAllocation, setSectorAllocation] = useState<SectorAllocationType | null>(null)
  const [comprehensivePortfolio, setComprehensivePortfolio] = useState<ComprehensivePortfolioType | null>(null)
  const [dividendInfo, setDividendInfo] = useState<DividendInfoType | null>(null)
  const [portfolioGainersLosers, setPortfolioGainersLosers] = useState<PortfolioGainersLosersType | null>(null)
  const [allIndexes, setallIndexes] = useState<indexes>()
  const [profitLossToday, setProfitLossToday] = useState<ComprehensivePortfolioType | null>(null)
  
  // Fiscal year states
  const [fiscalYears, setFiscalYears] = useState<FiscalYearType[]>([])

  

  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number>(0)
  const [useFiscalYearData, setUseFiscalYearData] = useState<boolean>(false)
  
  // Pagination state for comprehensive portfolio
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Handle select value change
  async function handleSelectValueChange(value: string) {
    setselectValue(value)
  }

  // Handle fiscal year change
  function handleFiscalYearChange(fiscalYearId: string) {
    setSelectedFiscalYear(parseInt(fiscalYearId));
    setUseFiscalYearData(true);
  }

  // Fetch user/fund list and set initial value
  const fetchSelect = async () => {
    setIsLoading(true)
    try {
      const getIndexes: indexes = await getAllIndex();
      setallIndexes(getIndexes)
      const listUsers: userList[] = await getUsers();
      setlistUsersValue(listUsers);
      if (listUsers.length > 0) {
        setselectValue(listUsers[0].client_name);
      }
      
      // Fetch fiscal years and set current fiscal year
      const [allFiscalYears, currentFiscalYear] = await Promise.all([
        getAllFiscalYears(),
        getCurrentFiscalYear()
      ]);
      
      setFiscalYears(allFiscalYears);
      if (currentFiscalYear) {
        setSelectedFiscalYear(currentFiscalYear.fiscal_year_id);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false)
    }
  };

  // Initial fetch on component mount
  useEffect(() => {
    fetchSelect();
  }, []);

  // Optimized data fetching with staggered loading
  const changeFetches = useCallback(async () => {
    if (!selectValue) return;
    
    setIsLoading(true);
    try {
      
      if (useFiscalYearData && selectedFiscalYear !== null) {
        // Fetch fiscal year-based data
        const highlights = await getInvestmentHighlightsFiscal(selectValue, selectedFiscalYear);
        setInvestmentHighlights(highlights);
        
        // Show initial data, then load the rest
        setIsLoading(false);
        
        // Fetch remaining data in background with slight delays for better UX
        setTimeout(async () => {
          try {
            const [sectors, gainersLosers] = await Promise.all([
              getSectorAllocationFiscal(selectValue, selectedFiscalYear),
              getPortfolioGainersLosersFiscal(selectValue, selectedFiscalYear)
            ]);
            setSectorAllocation(sectors);
            setPortfolioGainersLosers(gainersLosers);
          } catch (error) {
            console.error('Error fetching fiscal secondary data:', error);
          }
        }, 100);
        
        // Fetch heavy data last
        setTimeout(async () => {
          try {
            const [portfolio, dividends, profitLoss] = await Promise.all([
              getComprehensivePortfolioFiscal(selectValue, selectedFiscalYear),
              getDividendInfoFiscal(selectValue, selectedFiscalYear),
              getProfitLossTodayFiscal(selectValue, selectedFiscalYear)
            ]);
            setComprehensivePortfolio(portfolio);
            setDividendInfo(dividends);
            setProfitLossToday(profitLoss);
            setCurrentPage(1); // Reset pagination when new data is loaded
          } catch (error) {
            console.error('Error fetching fiscal tertiary data:', error);
          }
        }, 200);
      } else {
        // Fetch current data (original logic)
        const currentID = await getFiscalID()
        setSelectedFiscalYear(currentID)

        const highlights = await getInvestmentHighlightsFiscal(selectValue, selectedFiscalYear);
        setInvestmentHighlights(highlights);
        
        // Show initial data, then load the rest
        setIsLoading(false);
        
        // Fetch remaining data in background with slight delays for better UX
        setTimeout(async () => {
          try {
            const [sectors, gainersLosers] = await Promise.all([
              getSectorAllocation(selectValue),
              getPortfolioGainersLosers(selectValue)
            ]);
            setSectorAllocation(sectors);
            setPortfolioGainersLosers(gainersLosers);
          } catch (error) {
            console.error('Error fetching secondary data:', error);
          }
        }, 100);
        
        // Fetch heavy data last
        setTimeout(async () => {
          try {
            const [portfolio, dividends, profitLoss] = await Promise.all([
              getComprehensivePortfolio(selectValue),
              getDividendInfo(selectValue),
              getProfitLossToday(selectValue)
            ]);
            setComprehensivePortfolio(portfolio);
            setDividendInfo(dividends);
            setProfitLossToday(profitLoss);
            setCurrentPage(1); // Reset pagination when new data is loaded
          } catch (error) {
            console.error('Error fetching tertiary data:', error);
          }
        }, 200);
      }
      
    } catch (error) {
      console.error('Error fetching primary data:', error);
      setIsLoading(false);
    }
  }, [selectValue, useFiscalYearData, selectedFiscalYear]);

  const marketIndices = [
  { name: "NEPSE Index", value: allIndexes?.nepseIndex, change: allIndexes?.nepseChangePercent, changeValue: allIndexes?.nepseChange },
  { name: "Float Index", value: allIndexes?.floatIndex, change: allIndexes?.floatChangePercent, changeValue: allIndexes?.floatChange },
  { name: "Sensitive Index", value: allIndexes?.sensitiveIndex, change: allIndexes?.sensitiveChangePercent, changeValue: allIndexes?.sensitiveChange },
  { name: "Sensitive Float Index", value: allIndexes?.sensitiveFloatIndex, change: allIndexes?.sensitiveFloatChangePercent, changeValue: allIndexes?.sensitiveFloatChange }
]

  // Memoize expensive calculations
  const memoizedSectorData = useMemo(() => {
    return sectorAllocation?.map((sector, index) => {
      const colors = [
        '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b',
        '#ef4444', '#06b6d4', '#84cc16', '#6b7280'
      ];
      return {
        ...sector,
        fill: colors[index % colors.length]
      };
    }) || [];
  }, [sectorAllocation]);

  // Memoize unrealized gain chart data - use profitLossToday data from fiscal_year_balance
  const memoizedUnrealizedGainData = useMemo(() => {
    return (profitLossToday || []).map(stock => ({
      symbol: stock.code, // Chart uses 'symbol' as dataKey
      code: stock.code, // Keep for compatibility
      companyName: stock.companyName,
      pnlPercent: stock.pnlPercent,
      // For proper display - use actual percentage values
      gainPercent: stock.pnlPercent,
    })).sort((a, b) => b.pnlPercent - a.pnlPercent); // Sort by gain percentage descending
  }, [profitLossToday]);

  // Memoized pagination calculations for comprehensive portfolio
  const paginatedPortfolioData = useMemo(() => {
    const portfolioData = comprehensivePortfolio || []
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return portfolioData.slice(startIndex, endIndex)
  }, [comprehensivePortfolio, currentPage, itemsPerPage])

  const totalPages = useMemo(() => {
    return Math.ceil((comprehensivePortfolio || []).length / itemsPerPage)
  }, [comprehensivePortfolio, itemsPerPage])

  // Effect to run when selectValue, selectedFiscalYear, or useFiscalYearData changes
  useEffect(() => {
    if (selectValue && selectedFiscalYear !== null) {
      changeFetches()
    }
  }, [selectValue, selectedFiscalYear, useFiscalYearData, changeFetches]);

    return (
        isLoading ? (
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            {/* Title Skeleton */}
            <div className="text-center">
              <div className="h-10 bg-gray-200 rounded-lg w-48 mx-auto animate-pulse mb-6"></div>
            </div>
            
            {/* Fund Selection Skeleton */}
            <div className="flex justify-between items-center mb-6">
              <div className="w-64 h-10 bg-gray-200 rounded-lg animate-pulse"></div>
            </div>
            
            {/* Market Overview Cards Skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {Array.from({ length: 4 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
            
            {/* Two Column Layout Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Investment Highlights Skeleton */}
              <div className="border rounded-lg p-4">
                <div className="h-6 w-40 bg-gray-200 rounded animate-pulse mb-4"></div>
                <TableSkeleton rows={10} />
              </div>
              
              {/* Sector Chart Skeleton */}
              <div className="border rounded-lg p-4">
                <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-4"></div>
                <div className="aspect-square max-h-[350px] bg-gray-100 rounded-lg animate-pulse"></div>
              </div>
            </div>
            
            {/* Top Gainers/Losers Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="border rounded-lg p-4">
                <div className="h-6 w-24 bg-gray-200 rounded animate-pulse mb-4"></div>
                <TableSkeleton rows={5} />
              </div>
              <div className="border rounded-lg p-4">
                <div className="h-6 w-24 bg-gray-200 rounded animate-pulse mb-4"></div>
                <TableSkeleton rows={5} />
              </div>
            </div>
            
            {/* Comprehensive Portfolio Skeleton */}
            <div className="border rounded-lg p-4">
              <div className="h-6 w-56 bg-gray-200 rounded animate-pulse mb-4"></div>
              <TableSkeleton rows={9} />
            </div>
          </div>
        ) : (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
            
            {/* Summary Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <DollarSign className="h-8 w-8 text-blue-600" />
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-500">Total Investment</p>
                            <p className="text-2xl font-bold text-gray-900">
                                Rs. {((investmentHighlights?.totalInvestment || 0) / 1000000).toFixed(1)}M
                            </p>
                        </div>
                    </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <Activity className={`h-8 w-8 ${(investmentHighlights?.netGain || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-500">Net Gain/Loss</p>
                            <p className={`text-2xl font-bold ${(investmentHighlights?.netGain || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {(investmentHighlights?.netGain || 0) >= 0 ? '+' : ''}Rs. {((investmentHighlights?.netGain || 0) / 1000000).toFixed(1)}M
                            </p>
                        </div>
                    </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <BarChart3 className="h-8 w-8 text-purple-600" />
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-500">Unrealized Gain</p>
                            <p className={`text-2xl font-bold ${(investmentHighlights?.unrealizedGain || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {(investmentHighlights?.unrealizedGain || 0) >= 0 ? '+' : ''}Rs. {((investmentHighlights?.unrealizedGain || 0) / 1000000).toFixed(1)}M
                            </p>
                        </div>
                    </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <Calculator className={`h-8 w-8 ${(investmentHighlights?.netGainPercent || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-500">Net Gain %</p>
                            <p className={`text-2xl font-bold ${(investmentHighlights?.netGainPercent || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {(investmentHighlights?.netGainPercent || 0) >= 0 ? '+' : ''}{(investmentHighlights?.netGainPercent || 0).toFixed(2)}%
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            {/* Fund Selection Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div className="mb-4 sm:mb-0">
                        <h2 className="text-lg font-semibold text-gray-900 mb-1">Portfolio Selection</h2>
                        <p className="text-sm text-gray-600">Choose a portfolio and data view for detailed analytics and insights</p>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Data View Toggle */}
                        <div className="flex flex-col">
                            <label className="text-sm font-medium text-gray-700 mb-1">Data View</label>
                            <div className="flex items-center gap-2">
                                <button 
                                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                        !useFiscalYearData 
                                            ? 'bg-blue-500 text-white' 
                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    }`}
                                    onClick={() => setUseFiscalYearData(false)}
                                >
                                    Current
                                </button>
                                <button 
                                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                        useFiscalYearData 
                                            ? 'bg-blue-500 text-white' 
                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    }`}
                                    onClick={() => setUseFiscalYearData(true)}
                                >
                                    Fiscal Year
                                </button>
                            </div>
                        </div>
                        
                        {/* Fiscal Year Selector */}
                        {useFiscalYearData && (
                            <div className="flex flex-col">
                                <label className="text-sm font-medium text-gray-700 mb-1">Fiscal Year</label>
                                <Select 
                                    value={selectedFiscalYear?.toString() || ""} 
                                    onValueChange={handleFiscalYearChange}
                                >
                                    <SelectTrigger className="w-48">
                                        <SelectValue placeholder="Select fiscal year" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            <SelectLabel>Fiscal Years</SelectLabel>
                                            {fiscalYears.map((year) => (
                                                <SelectItem 
                                                    key={year.fiscal_year_id} 
                                                    value={year.fiscal_year_id.toString()}
                                                >
                                                    {year.year_label}
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        
                        {/* Fund Selector */}
                        {selectValue && (
                            <div className="text-right">
                                <p className="text-sm text-gray-500">Selected Portfolio</p>
                                <p className="font-semibold text-gray-900">{selectValue}</p>
                                {useFiscalYearData && selectedFiscalYear && (
                                    <p className="text-xs text-blue-600">
                                        {fiscalYears.find(f => f.fiscal_year_id === selectedFiscalYear)?.year_label || 'Fiscal Year'}
                                    </p>
                                )}
                            </div>
                        )}
                        <Select value={selectValue} onValueChange={handleSelectValueChange}>
                            <SelectTrigger className="w-[280px]">
                                <SelectValue placeholder="Select Fund" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel>Available Portfolios</SelectLabel>
                                    {listUsersValue.map((option) => (
                                        <SelectItem key={option.client_id} value={String(option.client_name)}>
                                            {option.client_name}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Market Overview Section */}
            <div className="mb-8">
                <div className="mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Market Overview</h2>
                    <p className="text-sm text-gray-600">Current market indices and their performance</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {marketIndices.map((index) => (
                        <Card key={index.name} className="bg-white shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-semibold text-gray-900">{index.name}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-2xl font-bold text-gray-900 mb-2">{(index.value || 0).toLocaleString()}</p>
                                <div className={`flex items-center text-sm ${(index.change || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {(index.change || 0) >= 0 ? (
                                        <ArrowUpRight className="w-4 h-4 mr-1" />
                                    ) : (
                                        <ArrowDownRight className="w-4 h-4 mr-1" />
                                    )}
                                    <span className="font-medium">{Math.abs((index.change || 0)).toFixed(2)}%</span>
                                    <span className="ml-1 text-gray-600">({(index.changeValue || 0) >= 0 ? '+' : ''}{(index.changeValue || 0).toFixed(2)})</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Investment Highlights Table */}
            <Card className="bg-white shadow-sm border border-gray-200 h-fit">
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-semibold text-gray-900">Investment Highlights</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="w-full">
                        <Table className="w-full">
                            <TableBody>
                                <TableRow className="bg-gray-50">
                                    <TableCell className="font-semibold border-r py-3 px-4">Total Held for Trading Securities</TableCell>
                                    <TableCell className="text-right font-bold py-3 px-4">Rs. {(investmentHighlights?.tradingSecurities || 0).toLocaleString()}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="border-r pl-6 py-3 px-4">1. Listed Equity Shares</TableCell>
                                    <TableCell className="text-right py-3 px-4">Rs. {(investmentHighlights?.listedEquityShares || 0).toLocaleString()}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="border-r font-semibold py-3 px-4">2. Held for Maturity</TableCell>
                                    <TableCell className="text-right font-bold py-3 px-4">Rs. {(investmentHighlights?.maturitySecurities || 0).toLocaleString()}</TableCell>
                                </TableRow>
                                <TableRow className="bg-blue-50">
                                    <TableCell className="font-bold border-r py-3 px-4">Total Investment</TableCell>
                                    <TableCell className="text-right font-bold py-3 px-4">Rs. {(investmentHighlights?.totalInvestment || 0).toLocaleString()}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="border-r py-3 px-4">Realised Gain/Loss</TableCell>
                                    <TableCell className={`text-right py-3 px-4 ${investmentHighlights?.realizedGain && investmentHighlights.realizedGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        Rs. {(investmentHighlights?.realizedGain || 0).toLocaleString()}
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="border-r py-3 px-4">Unrealised Gain/Loss</TableCell>
                                    <TableCell className={`text-right font-semibold py-3 px-4 ${investmentHighlights?.unrealizedGain && investmentHighlights.unrealizedGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        Rs. {(investmentHighlights?.unrealizedGain || 0).toLocaleString()}
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="border-r py-3 px-4">Dividend Income</TableCell>
                                    <TableCell className="text-right py-3 px-4">Rs. {(investmentHighlights?.dividendIncome || 0).toLocaleString()}</TableCell>
                                </TableRow>
                                <TableRow className="bg-gray-100">
                                    <TableCell className="font-bold border-r py-3 px-4">Net Gain/Loss</TableCell>
                                    <TableCell className={`text-right font-bold py-3 px-4 ${investmentHighlights?.netGain && investmentHighlights.netGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        Rs. {(investmentHighlights?.netGain || 0).toLocaleString()}
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="border-r py-3 px-4">Realised Gain/Loss%</TableCell>
                                    <TableCell className={`text-right py-3 px-4 ${investmentHighlights?.realizedGainPercent && investmentHighlights.realizedGainPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {(investmentHighlights?.realizedGainPercent || 0).toFixed(2)}%
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="border-r py-3 px-4">Unrealised Gain/Loss%</TableCell>
                                    <TableCell className={`text-right py-3 px-4 ${investmentHighlights?.unrealizedGainPercent && investmentHighlights.unrealizedGainPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {(investmentHighlights?.unrealizedGainPercent || 0).toFixed(2)}%
                                    </TableCell>
                                </TableRow>
                                <TableRow className="bg-gray-100">
                                    <TableCell className="font-bold border-r py-3 px-4">Net Gain/loss % HFT</TableCell>
                                    <TableCell className={`text-right font-bold py-3 px-4 ${investmentHighlights?.netGainPercent && investmentHighlights.netGainPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {(investmentHighlights?.netGainPercent || 0).toFixed(2)}%
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Single Chart Section - Sector Allocation */}
                {/* Sector Allocation */}

                {/* Sector Allocation */}
                <Card className="bg-white shadow-sm border border-gray-200 h-fit">
                    <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                            <PieChart className="w-5 h-5" />
                            Sector Allocation
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <ChartContainer
                            config={sectorChartConfig}
                            className="mx-auto aspect-square max-h-[350px]"
                        >
                            <RechartsPieChart>
                                <ChartTooltip
                                    cursor={false}
                                    content={<ChartTooltipContent hideLabel />}
                                    formatter={(value, name) => [
                                        `${Number(value).toFixed(2)}%  `,
                                        sectorChartConfig[name as keyof typeof sectorChartConfig]?.label || name,
                                    ]}
                                />
                                <Pie
                                    data={memoizedSectorData}
                                    dataKey="percentage"
                                    nameKey="sector"
                                    innerRadius={60}
                                    strokeWidth={5}
                                >
                                    {memoizedSectorData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <ChartLegend
                                    content={<ChartLegendContent className="flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center" />}
                                />
                            </RechartsPieChart>
                        </ChartContainer>
                        
                        {/* Additional sector details */}
                        <div className="mt-6 space-y-2">
                            {(sectorAllocation || []).map((sector, index) => {
                                const colors = [
                                    '#3b82f6', // blue
                                    '#10b981', // emerald
                                    '#8b5cf6', // violet
                                    '#f59e0b', // amber
                                    '#ef4444', // red
                                    '#06b6d4', // cyan
                                    '#84cc16', // lime
                                    '#6b7280', // gray
                                ];
                                return (
                                    <div key={sector.sector} className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2">
                                            <div 
                                                className="w-3 h-3 rounded-sm" 
                                                style={{ backgroundColor: colors[index % colors.length] }}
                                            ></div>
                                            <span>{sector.sector}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-medium">{sector.percentage.toFixed(1)}%</span>
                                            <div className="text-xs text-muted-foreground">Rs. {(sector.value / 100000).toFixed(1)}L</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
                
            </div>

            {/* Market Data Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Top Performers */}
                <Card className="bg-white shadow-sm border border-gray-200 h-fit">
                    <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                            <TrendingUp className="w-5 h-5 text-green-600" />
                            Top Gainers
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50">
                                    <TableHead className="font-semibold text-gray-900 py-3 px-4">Symbol</TableHead>
                                    <TableHead className="font-semibold text-gray-900 py-3 px-4 text-right">LTP</TableHead>
                                    <TableHead className="font-semibold text-gray-900 py-3 px-4 text-right">Change</TableHead>
                                    <TableHead className="font-semibold text-gray-900 py-3 px-4 text-right">Volume</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(portfolioGainersLosers?.topGainers || []).map((stock, index) => (
                                    <TableRow key={`gainer-${stock.symbol}-${index}`} className="hover:bg-gray-50">
                                        <TableCell className="py-3 px-4">
                                            <div>
                                                <div className="font-medium"><Link href={`/dashboard/stock/${stock.symbol}`} target="_blank">{stock.symbol}</Link></div>
                                                <div className="text-xs text-gray-500 truncate"><Link href={`/dashboard/stock/${stock.symbol}`} target="_blank">{stock.name}</Link></div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right py-3 px-4">Rs. {stock.price.toLocaleString()}</TableCell>
                                        <TableCell className="text-right text-green-600 font-medium py-3 px-4">+{stock.change.toFixed(2)}%</TableCell>
                                        <TableCell className="text-right text-sm py-3 px-4">{stock.volume.toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Top Losers */}
                <Card className="bg-white shadow-sm border border-gray-200 h-fit">
                    <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                            <TrendingDown className="w-5 h-5 text-red-600" />
                            Top Losers
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50">
                                    <TableHead className="font-semibold text-gray-900 py-3 px-4">Symbol</TableHead>
                                    <TableHead className="font-semibold text-gray-900 py-3 px-4 text-right">LTP</TableHead>
                                    <TableHead className="font-semibold text-gray-900 py-3 px-4 text-right">Change</TableHead>
                                    <TableHead className="font-semibold text-gray-900 py-3 px-4 text-right">Volume</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(portfolioGainersLosers?.topLosers || []).map((stock, index) => (
                                    <TableRow key={`loser-${stock.symbol}-${index}`} className="hover:bg-gray-50">
                                        <TableCell className="py-3 px-4">
                                            <div>
                                                <div className="font-medium"><Link href={`/dashboard/stock/${stock.symbol}`} target="_blank">{stock.symbol}</Link></div>
                                                <div className="text-xs text-gray-500 truncate"><Link href={`/dashboard/stock/${stock.symbol}`} target="_blank">{stock.name}</Link></div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right py-3 px-4">Rs. {stock.price.toLocaleString()}</TableCell>
                                        <TableCell className="text-right text-red-600 font-medium py-3 px-4">{stock.change.toFixed(2)}%</TableCell>
                                        <TableCell className="text-right text-sm py-3 px-4">{stock.volume.toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            {/* Unrealized Gain Percentage Chart */}
            <Card className="bg-white shadow-sm border border-gray-200 h-fit w-full mt-6">
                <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                        <BarChart3 className="w-5 h-5 text-blue-600" />
                        Profit/Loss as of Today (Script Wise)
                    </CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                        Unrealised Gain/Loss %
                    </p>
                </CardHeader>
                <CardContent>
                    <div className="h-96">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={memoizedUnrealizedGainData}
                                margin={{
                                    top: 20,
                                    right: 30,
                                    left: 20,
                                    bottom: 60,
                                }}
                                barCategoryGap={"10%"}
                            >
                                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                <XAxis 
                                    dataKey="symbol" 
                                    angle={-45}
                                    textAnchor="end"
                                    height={80}
                                    interval={0}
                                    fontSize={12}
                                />
                                <YAxis 
                                    label={{ value: 'Gain/Loss %', angle: -90, position: 'insideLeft' }}
                                    tickFormatter={(value) => `${value}%`}
                                />
                                <ChartTooltip
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                                <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                                                    <p className="font-semibold text-gray-900">{data.symbol}</p>
                                                    <p className="text-sm text-gray-600">{data.companyName}</p>
                                                    <p className={`text-sm font-medium ${
                                                        data.pnlPercent >= 0 ? 'text-green-600' : 'text-red-600'
                                                    }`}>
                                                        {data.pnlPercent >= 0 ? '+' : ''}{data.pnlPercent.toFixed(2)}%
                                                    </p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                
                                {/* Reference line at 0% */}
                                <ReferenceLine y={0} stroke="#374151" strokeWidth={2} strokeDasharray="5 5" />
                                
                                {/* Single bar with conditional coloring */}
                                <Bar 
                                    dataKey="gainPercent" 
                                    radius={2}
                                >
                                    {memoizedUnrealizedGainData.map((entry, index) => (
                                        <Cell 
                                            key={`cell-${index}`} 
                                            fill={entry.pnlPercent >= 0 ? '#10b981' : '#ef4444'}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Comprehensive Portfolio Analysis */}
            <Card className="bg-white shadow-sm border border-gray-200 h-fit w-full mt-6">
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-semibold text-gray-900">Comprehensive Portfolio Analysis</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="w-full overflow-x-auto">
                        <Table className="min-w-full">
                            <TableHeader>
                                <TableRow className="bg-gray-50">
                                    <TableHead className="font-semibold text-gray-900 py-3 px-4">Company Name</TableHead>
                                    <TableHead className="font-semibold text-gray-900 py-3 px-4">Code</TableHead>
                                    <TableHead className="font-semibold text-gray-900 py-3 px-4">Sector</TableHead>
                                    <TableHead className="font-semibold text-gray-900 py-3 px-4 text-right">Quantity</TableHead>
                                    <TableHead className="font-semibold text-gray-900 py-3 px-4 text-right">Book Value</TableHead>
                                    <TableHead className="font-semibold text-gray-900 py-3 px-4 text-right">Price Per Share</TableHead>
                                    <TableHead className="font-semibold text-gray-900 py-3 px-4 text-right">Market Rate</TableHead>
                                    <TableHead className="font-semibold text-gray-900 py-3 px-4 text-right">Unrealised P&L</TableHead>
                                    <TableHead className="font-semibold text-gray-900 py-3 px-4 text-right">P&L %</TableHead>
                                    <TableHead className="font-semibold text-gray-900 py-3 px-4 text-right">Realised P&L</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedPortfolioData.map((stock, index) => (
                                    <TableRow key={`${stock.code}-${index}`} className="hover:bg-gray-50">
                                        <TableCell className="font-medium py-3 px-4"><Link href={`/dashboard/stock/${stock.code}`} target="_blank">{stock.companyName}</Link></TableCell>
                                        <TableCell className="font-mono font-semibold text-blue-600 py-3 px-4"><Link href={`/dashboard/stock/${stock.code}`} target="_blank">{stock.code}</Link></TableCell>
                                        <TableCell className="py-3 px-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                stock.sector === 'Banking' ? 'bg-blue-100 text-blue-800' :
                                                stock.sector === 'Hydropower' ? 'bg-cyan-100 text-cyan-800' :
                                                stock.sector === 'Insurance' ? 'bg-purple-100 text-purple-800' :
                                                stock.sector === 'Manufacturing' ? 'bg-orange-100 text-orange-800' :
                                                'bg-gray-100 text-gray-800'
                                            }`}>
                                                {stock.sector}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right font-medium py-3 px-4">{stock.quantity.toLocaleString()}</TableCell>
                                        <TableCell className="text-right py-3 px-4">Rs. {stock.bookValue.toLocaleString()}</TableCell>    
                                        <TableCell className="text-right py-3 px-4">Rs. {stock.pricePerShare.toLocaleString()}</TableCell>
                                        <TableCell className="text-right py-3 px-4">Rs. {stock.marketRate.toLocaleString()}</TableCell>
                                        <TableCell className={`text-right font-semibold py-3 px-4 ${
                                            stock.unrealisedPnL >= 0 ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                            {stock.unrealisedPnL >= 0 ? '+' : ''}Rs. {stock.unrealisedPnL.toLocaleString()}
                                        </TableCell>
                                        <TableCell className={`text-right font-semibold py-3 px-4 ${
                                            stock.pnlPercent >= 0 ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                            {stock.pnlPercent >= 0 ? '+' : ''}{stock.pnlPercent.toFixed(2)}%
                                        </TableCell>
                                        <TableCell className={`text-right font-semibold py-3 px-4 ${
                                            stock.realisedPnL >= 0 ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                            {stock.realisedPnL >= 0 ? '+' : ''}Rs. {stock.realisedPnL.toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter>
                                <TableRow className="bg-gray-100">
                                    <TableCell colSpan={3} className="font-semibold py-3 px-4">Portfolio Totals</TableCell>
                                    <TableCell className="text-right font-bold py-3 px-4">
                                        {(comprehensivePortfolio || []).reduce((sum, stock) => sum + stock.quantity, 0).toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right font-bold py-3 px-4">
                                        Rs. {(comprehensivePortfolio || []).reduce((sum, stock) => sum + stock.bookValue, 0).toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right font-bold py-3 px-4">--</TableCell>
                                    <TableCell className="text-right font-bold py-3 px-4">--</TableCell>
                                    <TableCell className={`text-right font-bold py-3 px-4 ${
                                        (comprehensivePortfolio || []).reduce((sum, stock) => sum + stock.unrealisedPnL, 0) >= 0 
                                            ? 'text-green-600' 
                                            : 'text-red-600'
                                    }`}>
                                        {(comprehensivePortfolio || []).reduce((sum, stock) => sum + stock.unrealisedPnL, 0) >= 0 ? '+' : ''}Rs. {(comprehensivePortfolio || []).reduce((sum, stock) => sum + stock.unrealisedPnL, 0).toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right font-bold py-3 px-4">--</TableCell>
                                    <TableCell className={`text-right font-bold py-3 px-4 ${
                                        (comprehensivePortfolio || []).reduce((sum, stock) => sum + stock.realisedPnL, 0) >= 0 
                                            ? 'text-green-600' 
                                            : 'text-red-600'
                                    }`}>
                                        {(comprehensivePortfolio || []).reduce((sum, stock) => sum + stock.realisedPnL, 0) >= 0 ? '+' : ''}Rs. {(comprehensivePortfolio || []).reduce((sum, stock) => sum + stock.realisedPnL, 0).toLocaleString()}
                                    </TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>
                    
                    {/* Pagination */}
                    {(comprehensivePortfolio || []).length > itemsPerPage && (
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                            itemsPerPage={itemsPerPage}
                            totalItems={(comprehensivePortfolio || []).length}
                        />
                    )}
                </CardContent>
            </Card>

            {/* Dividend Information Section */}
            <Card className="bg-white shadow-sm border border-gray-200 h-fit w-full mt-6">
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-semibold text-gray-900">Dividend Information</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="w-full overflow-x-auto">
                        <Table className="min-w-full">
                            <TableHeader>
                                <TableRow className="bg-gray-50">
                                    <TableHead className="font-semibold text-gray-900 py-3 px-4">Symbol</TableHead>
                                    <TableHead className="font-semibold text-gray-900 py-3 px-4">Sector</TableHead>
                                    <TableHead className="font-semibold text-gray-900 py-3 px-4 text-right">Dividend Amount (Rs.)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(dividendInfo || []).map((stock) => (
                                    <TableRow key={stock.symbol} className="hover:bg-gray-50">
                                        <TableCell className="font-medium font-mono py-3 px-4"><Link href={`/dashboard/stock/${stock.symbol}`} target="_blank">{stock.symbol}</Link></TableCell>
                                        <TableCell className="py-3 px-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                stock.sector === 'Banking' ? 'bg-blue-100 text-blue-800' :
                                                stock.sector === 'Hydropower' ? 'bg-cyan-100 text-cyan-800' :
                                                stock.sector === 'Insurance' ? 'bg-purple-100 text-purple-800' :
                                                'bg-gray-100 text-gray-800'
                                            }`}>
                                                {stock.sector}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right font-semibold py-3 px-4">Rs. {stock.dividendAmount.toFixed(2)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter>
                                <TableRow className="bg-gray-100">
                                    <TableCell colSpan={2} className="font-semibold py-3 px-4">Total Expected Dividend</TableCell>
                                    <TableCell className="text-right font-bold text-green-600 py-3 px-4">
                                        Rs. {(dividendInfo || []).reduce((sum, stock) => sum + stock.dividendAmount, 0).toFixed(2)}
                                    </TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
        )
    )
}
