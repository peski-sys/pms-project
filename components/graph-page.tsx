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

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Search, X, Settings } from "lucide-react"

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
  
  // Pagination and sorting state for comprehensive portfolio
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Pagination and sorting state for dividend info
  const [dividendPage, setDividendPage] = useState(1)
  const [dividendItemsPerPage, setDividendItemsPerPage] = useState(10)
  const [dividendSortField, setDividendSortField] = useState<string | null>(null)
  const [dividendSortOrder, setDividendSortOrder] = useState<'asc' | 'desc'>('asc')

  // Search and column visibility state for Comprehensive Portfolio Analysis
  const [portfolioSearchTerm, setPortfolioSearchTerm] = useState<string>("")
  const [portfolioColumnVisibility, setPortfolioColumnVisibility] = useState({
    companyName: true,
    code: true,
    sector: true,
    quantity: true,
    bookValue: true,
    pricePerShare: true,
    marketValue: true,
    unrealizedGain: true,
    unrealizedGainPercent: true,
    weightage: true
  })

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
              getProfitLossTodayFiscal(selectValue, selectedFiscalYear)
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

  // Helper function to render sort indicator
  const SortIndicator = ({ field, tableSortField, tableSortOrder }: { field: string, tableSortField: string | null, tableSortOrder: 'asc' | 'desc' }) => {
    if (tableSortField !== field) return <span className="text-gray-400 text-xs ml-1">⇅</span>;
    return tableSortOrder === 'asc' ? <span className="text-blue-600 ml-1">↑</span> : <span className="text-blue-600 ml-1">↓</span>;
  };

  // Handle column header click for sorting - Comprehensive Portfolio
  const handlePortfolioHeaderClick = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  // Handle column header click for sorting - Dividend Info
  const handleDividendHeaderClick = (field: string) => {
    if (dividendSortField === field) {
      setDividendSortOrder(dividendSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setDividendSortField(field);
      setDividendSortOrder('asc');
    }
    setDividendPage(1);
  };

  // Process, filter and sort Comprehensive Portfolio data
  const processedPortfolioData = useMemo(() => {
    if (!comprehensivePortfolio) return [];
    let data = [...comprehensivePortfolio];
    
    // Apply search filtering
    if (portfolioSearchTerm.trim()) {
      data = data.filter((item) =>
        item.companyName.toLowerCase().includes(portfolioSearchTerm.toLowerCase()) ||
        item.code.toLowerCase().includes(portfolioSearchTerm.toLowerCase()) ||
        item.sector.toLowerCase().includes(portfolioSearchTerm.toLowerCase())
      );
    }
    
    // Apply sorting
    if (sortField) {
      data.sort((a, b) => {
        const aValue = a[sortField as keyof ComprehensivePortfolioType[0]];
        const bValue = b[sortField as keyof ComprehensivePortfolioType[0]];
        
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return sortOrder === 'asc' ? 1 : -1;
        if (bValue == null) return sortOrder === 'asc' ? -1 : 1;
        
        if (typeof aValue === 'string') {
          return sortOrder === 'asc' 
            ? aValue.localeCompare(bValue as string)
            : (bValue as string).localeCompare(aValue);
        }
        
        if (typeof aValue === 'number') {
          return sortOrder === 'asc' 
            ? (aValue as number) - (bValue as number)
            : (bValue as number) - (aValue as number);
        }
        
        return 0;
      });
    }
    
    return data;
  }, [comprehensivePortfolio, sortField, sortOrder, portfolioSearchTerm]);

  // Memoized pagination calculations for comprehensive portfolio
  const paginatedPortfolioData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return processedPortfolioData.slice(startIndex, startIndex + itemsPerPage);
  }, [processedPortfolioData, currentPage, itemsPerPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(processedPortfolioData.length / itemsPerPage);
  }, [processedPortfolioData, itemsPerPage]);

  const totalPortfolioItems = processedPortfolioData.length;

  // Process and sort Dividend Info data
  const processedDividendData = useMemo(() => {
    if (!dividendInfo) return [];
    let data = [...dividendInfo];
    
    if (dividendSortField) {
      data.sort((a, b) => {
        const aValue = a[dividendSortField as keyof DividendInfoType[0]];
        const bValue = b[dividendSortField as keyof DividendInfoType[0]];
        
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return dividendSortOrder === 'asc' ? 1 : -1;
        if (bValue == null) return dividendSortOrder === 'asc' ? -1 : 1;
        
        if (typeof aValue === 'string') {
          return dividendSortOrder === 'asc' 
            ? aValue.localeCompare(bValue as string)
            : (bValue as string).localeCompare(aValue);
        }
        
        if (typeof aValue === 'number') {
          return dividendSortOrder === 'asc' 
            ? (aValue as number) - (bValue as number)
            : (bValue as number) - (aValue as number);
        }
        
        return 0;
      });
    }
    
    return data;
  }, [dividendInfo, dividendSortField, dividendSortOrder]);

  // Paginated Dividend Info data
  const paginatedDividendData = useMemo(() => {
    const startIndex = (dividendPage - 1) * dividendItemsPerPage;
    return processedDividendData.slice(startIndex, startIndex + dividendItemsPerPage);
  }, [processedDividendData, dividendPage, dividendItemsPerPage]);

  const dividendTotalPages = Math.ceil(processedDividendData.length / dividendItemsPerPage);
  const dividendTotalItems = processedDividendData.length;

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
            {/* Enhanced Fund Selection Section */}
            <div className="bg-white shadow-lg border border-gray-100 overflow-hidden rounded-lg mb-8">
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center">
                        <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <h2 className="text-xl font-bold text-gray-900">Portfolio Selection & Data Controls</h2>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">Configure your portfolio view and data analysis parameters</p>
                </div>
                <div className="p-6">
                    <div className="grid gap-6 lg:grid-cols-4">
                        <div className="space-y-3">
                            <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                <p className="text-sm font-semibold text-gray-700">Portfolio Selection</p>
                            </div>
                            <Select value={selectValue} onValueChange={handleSelectValueChange}>
                                <SelectTrigger className="bg-white border-gray-200 hover:border-blue-300 transition-colors">
                                    <SelectValue placeholder="Choose Portfolio" />
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

                        <div className="space-y-3">
                            <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <p className="text-sm font-semibold text-gray-700">Data View</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                                        !useFiscalYearData 
                                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm' 
                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    }`}
                                    onClick={() => setUseFiscalYearData(false)}
                                >
                                    Current
                                </button>
                                <button 
                                    className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                                        useFiscalYearData 
                                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm' 
                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    }`}
                                    onClick={() => setUseFiscalYearData(true)}
                                >
                                    Fiscal Year
                                </button>
                            </div>
                        </div>
                        
                        {useFiscalYearData && (
                            <div className="space-y-3">
                                <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                    <p className="text-sm font-semibold text-gray-700">Fiscal Year</p>
                                </div>
                                <Select 
                                    value={selectedFiscalYear?.toString() || ""} 
                                    onValueChange={handleFiscalYearChange}
                                >
                                    <SelectTrigger className="bg-white border-gray-200 hover:border-purple-300 transition-colors">
                                        <SelectValue placeholder="Select Fiscal Year" />
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

                        {selectValue && (
                            <div className="space-y-3">
                                <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                                    <p className="text-sm font-semibold text-gray-700">Current Selection</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-3">
                                    <p className="text-sm text-gray-500">Portfolio</p>
                                    <p className="font-semibold text-gray-900">{selectValue}</p>
                                    {useFiscalYearData && selectedFiscalYear && (
                                        <p className="text-xs text-indigo-600 mt-1">
                                            {fiscalYears.find(f => f.fiscal_year_id === selectedFiscalYear)?.year_label || 'Fiscal Year'}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
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
            <Card className="bg-white shadow-lg border border-gray-100 h-fit w-full mt-6">
                <CardHeader className="pb-4">
                    <div className="flex justify-between items-center mb-4">
                        <CardTitle className="text-xl font-bold text-gray-900 flex items-center">
                            <div className="w-3 h-3 bg-indigo-500 rounded-full mr-2"></div>
                            Comprehensive Portfolio Analysis
                            {totalPortfolioItems > 0 && (
                                <span className="ml-2 text-sm font-normal text-gray-500">
                                    ({totalPortfolioItems} stocks)
                                </span>
                            )}
                        </CardTitle>
                    </div>
                    
                    {/* Search and Column Controls for Portfolio */}
                    <div className="flex items-center gap-3 mb-4">
                        {/* Search Input */}
                        <div className="relative flex-1 max-w-lg">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                            <Input
                                placeholder="Search by company, code, or sector..."
                                value={portfolioSearchTerm}
                                onChange={(e) => setPortfolioSearchTerm(e.target.value)}
                                className="pl-10 pr-10 border-gray-200 focus:border-indigo-300"
                            />
                            {portfolioSearchTerm && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setPortfolioSearchTerm("")}
                                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-100"
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            )}
                        </div>
                        
                        {/* Column Visibility Dropdown */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="flex items-center gap-2 border-gray-200 hover:border-indigo-300">
                                    <Settings className="h-4 w-4" />
                                    Columns
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 max-h-96 overflow-y-auto">
                                <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuCheckboxItem
                                    checked={portfolioColumnVisibility.companyName}
                                    onCheckedChange={(checked) => 
                                        setPortfolioColumnVisibility(prev => ({ ...prev, companyName: checked }))
                                    }
                                >
                                    Company Name
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem
                                    checked={portfolioColumnVisibility.code}
                                    onCheckedChange={(checked) => 
                                        setPortfolioColumnVisibility(prev => ({ ...prev, code: checked }))
                                    }
                                >
                                    Code
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem
                                    checked={portfolioColumnVisibility.sector}
                                    onCheckedChange={(checked) => 
                                        setPortfolioColumnVisibility(prev => ({ ...prev, sector: checked }))
                                    }
                                >
                                    Sector
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuCheckboxItem
                                    checked={portfolioColumnVisibility.quantity}
                                    onCheckedChange={(checked) => 
                                        setPortfolioColumnVisibility(prev => ({ ...prev, quantity: checked }))
                                    }
                                >
                                    Quantity
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem
                                    checked={portfolioColumnVisibility.bookValue}
                                    onCheckedChange={(checked) => 
                                        setPortfolioColumnVisibility(prev => ({ ...prev, bookValue: checked }))
                                    }
                                >
                                    Book Value
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem
                                    checked={portfolioColumnVisibility.pricePerShare}
                                    onCheckedChange={(checked) => 
                                        setPortfolioColumnVisibility(prev => ({ ...prev, pricePerShare: checked }))
                                    }
                                >
                                    Price Per Share
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem
                                    checked={portfolioColumnVisibility.marketValue}
                                    onCheckedChange={(checked) => 
                                        setPortfolioColumnVisibility(prev => ({ ...prev, marketValue: checked }))
                                    }
                                >
                                    Market Value
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem
                                    checked={portfolioColumnVisibility.unrealizedGain}
                                    onCheckedChange={(checked) => 
                                        setPortfolioColumnVisibility(prev => ({ ...prev, unrealizedGain: checked }))
                                    }
                                >
                                    Unrealized P&L
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem
                                    checked={portfolioColumnVisibility.unrealizedGainPercent}
                                    onCheckedChange={(checked) => 
                                        setPortfolioColumnVisibility(prev => ({ ...prev, unrealizedGainPercent: checked }))
                                    }
                                >
                                    Unrealized P&L %
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem
                                    checked={portfolioColumnVisibility.weightage}
                                    onCheckedChange={(checked) => 
                                        setPortfolioColumnVisibility(prev => ({ ...prev, weightage: checked }))
                                    }
                                >
                                    Weightage
                                </DropdownMenuCheckboxItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="w-full overflow-x-auto">
                        <Table className="min-w-full">
                            <TableHeader>
                                <TableRow className="bg-gray-50">
                                    {portfolioColumnVisibility.companyName && (
                                        <TableHead className="font-semibold text-gray-900 py-3 px-4 cursor-pointer hover:bg-gray-100" onClick={() => handlePortfolioHeaderClick('companyName')}>
                                            <div className="flex items-center justify-between">
                                                Company Name
                                                <SortIndicator field="companyName" tableSortField={sortField} tableSortOrder={sortOrder} />
                                            </div>
                                        </TableHead>
                                    )}
                                    {portfolioColumnVisibility.code && (
                                        <TableHead className="font-semibold text-gray-900 py-3 px-4 cursor-pointer hover:bg-gray-100" onClick={() => handlePortfolioHeaderClick('code')}>
                                            <div className="flex items-center justify-between">
                                                Code
                                                <SortIndicator field="code" tableSortField={sortField} tableSortOrder={sortOrder} />
                                            </div>
                                        </TableHead>
                                    )}
                                    {portfolioColumnVisibility.sector && (
                                        <TableHead className="font-semibold text-gray-900 py-3 px-4 cursor-pointer hover:bg-gray-100" onClick={() => handlePortfolioHeaderClick('sector')}>
                                            <div className="flex items-center justify-between">
                                                Sector
                                                <SortIndicator field="sector" tableSortField={sortField} tableSortOrder={sortOrder} />
                                            </div>
                                        </TableHead>
                                    )}
                                    {portfolioColumnVisibility.quantity && (
                                        <TableHead className="font-semibold text-gray-900 py-3 px-4 text-right cursor-pointer hover:bg-gray-100" onClick={() => handlePortfolioHeaderClick('quantity')}>
                                            <div className="flex items-center justify-end">
                                                Quantity
                                                <SortIndicator field="quantity" tableSortField={sortField} tableSortOrder={sortOrder} />
                                            </div>
                                        </TableHead>
                                    )}
                                    {portfolioColumnVisibility.bookValue && (
                                        <TableHead className="font-semibold text-gray-900 py-3 px-4 text-right cursor-pointer hover:bg-gray-100" onClick={() => handlePortfolioHeaderClick('bookValue')}>
                                            <div className="flex items-center justify-end">
                                                Book Value
                                                <SortIndicator field="bookValue" tableSortField={sortField} tableSortOrder={sortOrder} />
                                            </div>
                                        </TableHead>
                                    )}
                                    {portfolioColumnVisibility.pricePerShare && (
                                        <TableHead className="font-semibold text-gray-900 py-3 px-4 text-right cursor-pointer hover:bg-gray-100" onClick={() => handlePortfolioHeaderClick('pricePerShare')}>
                                            <div className="flex items-center justify-end">
                                                Price Per Share
                                                <SortIndicator field="pricePerShare" tableSortField={sortField} tableSortOrder={sortOrder} />
                                            </div>
                                        </TableHead>
                                    )}
                                    {portfolioColumnVisibility.marketValue && (
                                        <TableHead className="font-semibold text-gray-900 py-3 px-4 text-right cursor-pointer hover:bg-gray-100" onClick={() => handlePortfolioHeaderClick('marketRate')}>
                                            <div className="flex items-center justify-end">
                                                Market Rate
                                                <SortIndicator field="marketRate" tableSortField={sortField} tableSortOrder={sortOrder} />
                                            </div>
                                        </TableHead>
                                    )}
                                    {portfolioColumnVisibility.unrealizedGain && (
                                        <TableHead className="font-semibold text-gray-900 py-3 px-4 text-right cursor-pointer hover:bg-gray-100" onClick={() => handlePortfolioHeaderClick('unrealisedPnL')}>
                                            <div className="flex items-center justify-end">
                                                Unrealised P&L
                                                <SortIndicator field="unrealisedPnL" tableSortField={sortField} tableSortOrder={sortOrder} />
                                            </div>
                                        </TableHead>
                                    )}
                                    {portfolioColumnVisibility.unrealizedGainPercent && (
                                        <TableHead className="font-semibold text-gray-900 py-3 px-4 text-right cursor-pointer hover:bg-gray-100" onClick={() => handlePortfolioHeaderClick('pnlPercent')}>
                                            <div className="flex items-center justify-end">
                                                P&L %
                                                <SortIndicator field="pnlPercent" tableSortField={sortField} tableSortOrder={sortOrder} />
                                            </div>
                                        </TableHead>
                                    )}
                                    {portfolioColumnVisibility.weightage && (
                                        <TableHead className="font-semibold text-gray-900 py-3 px-4 text-right cursor-pointer hover:bg-gray-100" onClick={() => handlePortfolioHeaderClick('realisedPnL')}>
                                            <div className="flex items-center justify-end">
                                                Realised P&L
                                                <SortIndicator field="realisedPnL" tableSortField={sortField} tableSortOrder={sortOrder} />
                                            </div>
                                        </TableHead>
                                    )}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedPortfolioData.map((stock, index) => (
                                    <TableRow key={`${stock.code}-${index}`} className="hover:bg-gray-50">
                                        {portfolioColumnVisibility.companyName && (
                                            <TableCell className="font-medium py-3 px-4"><Link href={`/dashboard/stock/${stock.code}`} target="_blank">{stock.companyName}</Link></TableCell>
                                        )}
                                        {portfolioColumnVisibility.code && (
                                            <TableCell className="font-mono font-semibold text-blue-600 py-3 px-4"><Link href={`/dashboard/stock/${stock.code}`} target="_blank">{stock.code}</Link></TableCell>
                                        )}
                                        {portfolioColumnVisibility.sector && (
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
                                        )}
                                        {portfolioColumnVisibility.quantity && (
                                            <TableCell className="text-right font-medium py-3 px-4">{stock.quantity.toLocaleString()}</TableCell>
                                        )}
                                        {portfolioColumnVisibility.bookValue && (
                                            <TableCell className="text-right py-3 px-4">Rs. {stock.bookValue.toLocaleString()}</TableCell>
                                        )}
                                        {portfolioColumnVisibility.pricePerShare && (
                                            <TableCell className="text-right py-3 px-4">Rs. {stock.pricePerShare.toLocaleString()}</TableCell>
                                        )}
                                        {portfolioColumnVisibility.marketValue && (
                                            <TableCell className="text-right py-3 px-4">Rs. {stock.marketRate.toLocaleString()}</TableCell>
                                        )}
                                        {portfolioColumnVisibility.unrealizedGain && (
                                            <TableCell className={`text-right font-semibold py-3 px-4 ${
                                                stock.unrealisedPnL >= 0 ? 'text-green-600' : 'text-red-600'
                                            }`}>
                                                {stock.unrealisedPnL >= 0 ? '+' : ''}Rs. {stock.unrealisedPnL.toLocaleString()}
                                            </TableCell>
                                        )}
                                        {portfolioColumnVisibility.unrealizedGainPercent && (
                                            <TableCell className={`text-right font-semibold py-3 px-4 ${
                                                stock.pnlPercent >= 0 ? 'text-green-600' : 'text-red-600'
                                            }`}>
                                                {stock.pnlPercent >= 0 ? '+' : ''}{stock.pnlPercent.toFixed(2)}%
                                            </TableCell>
                                        )}
                                        {portfolioColumnVisibility.weightage && (
                                            <TableCell className={`text-right font-semibold py-3 px-4 ${
                                                stock.realisedPnL >= 0 ? 'text-green-600' : 'text-red-600'
                                            }`}>
                                                {stock.realisedPnL >= 0 ? '+' : ''}Rs. {stock.realisedPnL.toLocaleString()}
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter>
                                <TableRow className="bg-gray-100">
                                    {portfolioColumnVisibility.companyName && (
                                        <TableCell className="font-semibold py-3 px-4">Portfolio Totals</TableCell>
                                    )}
                                    {portfolioColumnVisibility.code && (
                                        <TableCell className="text-center py-3 px-4">--</TableCell>
                                    )}
                                    {portfolioColumnVisibility.sector && (
                                        <TableCell className="text-center py-3 px-4">--</TableCell>
                                    )}
                                    {portfolioColumnVisibility.quantity && (
                                        <TableCell className="text-right font-bold py-3 px-4">
                                            {(comprehensivePortfolio || []).reduce((sum, stock) => sum + stock.quantity, 0).toLocaleString()}
                                        </TableCell>
                                    )}
                                    {portfolioColumnVisibility.bookValue && (
                                        <TableCell className="text-right font-bold py-3 px-4">
                                            Rs. {(comprehensivePortfolio || []).reduce((sum, stock) => sum + stock.bookValue, 0).toLocaleString()}
                                        </TableCell>
                                    )}
                                    {portfolioColumnVisibility.pricePerShare && (
                                        <TableCell className="text-right font-bold py-3 px-4">--</TableCell>
                                    )}
                                    {portfolioColumnVisibility.marketValue && (
                                        <TableCell className="text-right font-bold py-3 px-4">--</TableCell>
                                    )}
                                    {portfolioColumnVisibility.unrealizedGain && (
                                        <TableCell className={`text-right font-bold py-3 px-4 ${
                                            (comprehensivePortfolio || []).reduce((sum, stock) => sum + stock.unrealisedPnL, 0) >= 0 
                                                ? 'text-green-600' 
                                                : 'text-red-600'
                                        }`}>
                                            {(comprehensivePortfolio || []).reduce((sum, stock) => sum + stock.unrealisedPnL, 0) >= 0 ? '+' : ''}Rs. {(comprehensivePortfolio || []).reduce((sum, stock) => sum + stock.unrealisedPnL, 0).toLocaleString()}
                                        </TableCell>
                                    )}
                                    {portfolioColumnVisibility.unrealizedGainPercent && (
                                        <TableCell className="text-right font-bold py-3 px-4">--</TableCell>
                                    )}
                                    {portfolioColumnVisibility.weightage && (
                                        <TableCell className={`text-right font-bold py-3 px-4 ${
                                            (comprehensivePortfolio || []).reduce((sum, stock) => sum + stock.realisedPnL, 0) >= 0 
                                                ? 'text-green-600' 
                                                : 'text-red-600'
                                        }`}>
                                            {(comprehensivePortfolio || []).reduce((sum, stock) => sum + stock.realisedPnL, 0) >= 0 ? '+' : ''}Rs. {(comprehensivePortfolio || []).reduce((sum, stock) => sum + stock.realisedPnL, 0).toLocaleString()}
                                        </TableCell>
                                    )}
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>
                    
                    {/* Pagination */}
                    {totalPortfolioItems > 0 && (
                        <div className="px-6 py-4 bg-white border-t border-gray-200 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-gray-700">Items per page:</span>
                                <Select value={itemsPerPage.toString()} onValueChange={(value) => {
                                    setItemsPerPage(parseInt(value));
                                    setCurrentPage(1);
                                }}>
                                    <SelectTrigger className="w-20">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            <SelectItem value="5">5</SelectItem>
                                            <SelectItem value="10">10</SelectItem>
                                            <SelectItem value="15">15</SelectItem>
                                            <SelectItem value="20">20</SelectItem>
                                            <SelectItem value="25">25</SelectItem>
                                            <SelectItem value="50">50</SelectItem>
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                            </div>
                            {totalPortfolioItems > itemsPerPage && (
                                <Pagination
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    onPageChange={setCurrentPage}
                                    itemsPerPage={itemsPerPage}
                                    totalItems={totalPortfolioItems}
                                />
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Dividend Information Section */}
            <Card className="bg-white shadow-sm border border-gray-200 h-fit w-full mt-6">
                <CardHeader className="pb-4">
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-lg font-semibold text-gray-900">Dividend Information</CardTitle>
                        {dividendTotalItems > 0 && (
                            <span className="text-sm text-gray-500">({dividendTotalItems} stocks)</span>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="w-full overflow-x-auto">
                        <Table className="min-w-full">
                            <TableHeader>
                                <TableRow className="bg-gray-50">
                                    <TableHead className="font-semibold text-gray-900 py-3 px-4 cursor-pointer hover:bg-gray-100" onClick={() => handleDividendHeaderClick('symbol')}>
                                        <div className="flex items-center justify-between">
                                            Symbol
                                            <SortIndicator field="symbol" tableSortField={dividendSortField} tableSortOrder={dividendSortOrder} />
                                        </div>
                                    </TableHead>
                                    <TableHead className="font-semibold text-gray-900 py-3 px-4 cursor-pointer hover:bg-gray-100" onClick={() => handleDividendHeaderClick('sector')}>
                                        <div className="flex items-center justify-between">
                                            Sector
                                            <SortIndicator field="sector" tableSortField={dividendSortField} tableSortOrder={dividendSortOrder} />
                                        </div>
                                    </TableHead>
                                    <TableHead className="font-semibold text-gray-900 py-3 px-4 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleDividendHeaderClick('dividendAmount')}>
                                        <div className="flex items-center justify-end">
                                            Dividend Amount (Rs.)
                                            <SortIndicator field="dividendAmount" tableSortField={dividendSortField} tableSortOrder={dividendSortOrder} />
                                        </div>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedDividendData.map((stock) => (
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
                                        Rs. {processedDividendData.reduce((sum, stock) => sum + stock.dividendAmount, 0).toFixed(2)}
                                    </TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>
                    
                    {/* Pagination */}
                    {dividendTotalItems > 0 && (
                        <div className="px-6 py-4 bg-white border-t border-gray-200 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-gray-700">Items per page:</span>
                                <Select value={dividendItemsPerPage.toString()} onValueChange={(value) => {
                                    setDividendItemsPerPage(parseInt(value));
                                    setDividendPage(1);
                                }}>
                                    <SelectTrigger className="w-20">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            <SelectItem value="5">5</SelectItem>
                                            <SelectItem value="10">10</SelectItem>
                                            <SelectItem value="15">15</SelectItem>
                                            <SelectItem value="20">20</SelectItem>
                                            <SelectItem value="25">25</SelectItem>
                                            <SelectItem value="50">50</SelectItem>
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                            </div>
                            {dividendTotalItems > dividendItemsPerPage && (
                                <Pagination
                                    currentPage={dividendPage}
                                    totalPages={dividendTotalPages}
                                    onPageChange={setDividendPage}
                                    itemsPerPage={dividendItemsPerPage}
                                    totalItems={dividendTotalItems}
                                />
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
        )
    )
}
