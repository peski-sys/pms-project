"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import Link from "next/link"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter
} from "@/components/ui/table"

type clientBroker = {
  client_name: string,
}

type stockFull = {
  full_form: string
}

type holdingsData = {
  client_id: string,
  fund_id?: number,
  symbol: string,
  price_per_share: number,
  quantity: number,
  total_value: string,
  client_broker_mapping: clientBroker,
  stock_fulls: stockFull
}


import { CardSkeleton, TableSkeleton } from "@/components/ui/skeleton"

type ivstData = {
  _sum: {
    total_value: number | null,
  },
}

type gainLoss = {
  _sum : {
    profit_loss: number | null,
  }
}

import { getUsers, getUnrealizedGains, getInvestmentBreakdown, getSectorPortfolioSummary, getStockInvestmentBreakdown, getLatestLTP, getCurrentSessionUser } from "@/app/api/dashboardAPICalls/actions";
import { 
  getCurrentFiscalYear,
  getAllFiscalYears,
  getTotalInvestmentFiscal,
  getUnrealizedGainsFiscal,
  getRealizedGainsFiscal,
  getInvestmentBreakdownFiscal,
  getSectorPortfolioSummaryFiscal,
  getStockInvestmentBreakdownFiscal,
  getScripCountFiscal
} from "@/app/api/fiscalYearDashboardAPI/actions";


type userList = {
  client_id: string,
  client_name: string,
  client_broker: number,
  recorded_at: Date | null,
}

type onlyIndividual = {
    rank: number,
    symbol: string,
    fullForm: string,
    ltp: number,
    change: number,
}[]

type gainLossType = {
    topGainers: onlyIndividual,
    topLosers: onlyIndividual,
}


import { UploadBook } from "./upload-dialog"

import { scripCount } from "@/app/api/dashboardAPICalls/actions"
import { getTotalInvestment } from "@/app/api/dashboardAPICalls/actions"
import { realisedProfitLoss } from "@/app/api/dashboardAPICalls/actions"
import { dashboardHoldings } from "@/app/api/dashboardAPICalls/actions"
import { useState, useEffect, useMemo, useCallback } from "react"
import { Pagination } from "./ui/pagination"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

import {
  Bar,
  BarChart,
  Cell,
  XAxis,
  YAxis,
} from "recharts"

// Types for dynamic data
type UnrealizedGainsType = {
  total_unrealized_gain: number;
  total_market_value: number;
  holdings: any[];
}

type InvestmentBreakdownType = {
  trading: {
    data: { sector: string; value: number; percentage: number }[];
    total: number;
    count: number;
  };
  maturity: {
    data: { sector: string; value: number; percentage: number }[];
    total: number;
    count: number;
  };
  allSectors: string[];
}

type StockInvestmentBreakdownType = {
  trading: {
    data: { symbol: string; value: number; percentage: number }[];
    total: number;
    count: number;
  };
  maturity: {
    data: { symbol: string; value: number; percentage: number }[];
    total: number;
    count: number;
  };
}

type SectorPortfolioSummaryType = {
  totalPortfolioValue: number;
  totalHeldForTrading: number;
  totalHeldForMaturity: number;
  totalRealizedGain: number;
  totalUnrealizedGain: number;
  sectors: {
    sector: string;
    heldForTrading: number;
    heldForMaturity: number;
    realizedGain: number;
    unrealizedGain: number;
    weightagePercent: number;
    sectorGainPercent: number;
  }[];
}

type FiscalYearType = {
  fiscal_year_id: number;
  year_label: string;
  start_date: Date;
  end_date: Date;
}

type FiscalYearDataType = {
  totalInvestment: number;
  realizedGain: number;
  unrealizedGain: number;
}


// Chart configurations
const tradingChartConfig = {
  value: {
    label: "Portfolio Value",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig

const maturityChartConfig = {
  value: {
    label: "Portfolio Value",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

export default function Dashcard() {

  const router = useRouter()

  const [selectValue, setselectValue] = useState<string>("")
  const [listUsersValue, setlistUsersValue] = useState<userList[]>([])
  const [listInvestmentData, setlistInvestmentData] = useState<ivstData>()
  const [listRealisedGain, setlistRealisedGain] = useState<gainLoss>()
  const [listScripCount, setlistScripCount] = useState(0)
  const [listOrderData, setlistOrderData] = useState<holdingsData[]>([])
  const [isLoading, setIsLoading] = useState(true);
  const [unrealizedGains, setUnrealizedGains] = useState<UnrealizedGainsType | null>(null)
  const [investmentBreakdown, setInvestmentBreakdown] = useState<InvestmentBreakdownType | null>(null)
  const [stockInvestmentBreakdown, setStockInvestmentBreakdown] = useState<StockInvestmentBreakdownType | null>(null)
  const [sectorPortfolioSummary, setSectorPortfolioSummary] = useState<SectorPortfolioSummaryType | null>(null)

  const [isAdmin, setIsAdmin] = useState<boolean | null>()
  
  // Fiscal year states
  const [fiscalYears, setFiscalYears] = useState<FiscalYearType[]>([])
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number | null>(null)
  const [useFiscalYearData, setUseFiscalYearData] = useState<boolean>(false)
  const [fiscalYearData, setFiscalYearData] = useState<FiscalYearDataType | null>(null)
  const [fiscalScripCount, setFiscalScripCount] = useState<number>(0)
  const [fiscalStockInvestmentBreakdown, setFiscalStockInvestmentBreakdown] = useState<StockInvestmentBreakdownType | null>(null)
  
  // Pagination state for Portfolio Summary table
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

async function handleSelectValueChange(value: string) {
    setselectValue(value)
}

function handleFiscalYearChange(fiscalYearId: string) {
    setSelectedFiscalYear(parseInt(fiscalYearId));
    setUseFiscalYearData(true);
    // Data will be refetched automatically due to useEffect dependency
}


const fetchSelect = async () => {
    setIsLoading(true)
    try {

        const userPermission = await getCurrentSessionUser()
        setIsAdmin(userPermission)

        const listUsers: userList[] = await getUsers();
        setlistUsersValue(listUsers);
        
        // Check if users array is not empty before accessing first element
        if (listUsers && listUsers.length > 0) {
            const initialClient = listUsers[0].client_name
            setselectValue(initialClient);
            
            // Only fetch fiscal years and LTP if we have users
            // Fetch fiscal years and set current fiscal year
            const [allFiscalYears, currentFiscalYear] = await Promise.all([
                getAllFiscalYears(),
                getCurrentFiscalYear()
            ]);
            
            setFiscalYears(allFiscalYears);
            if (currentFiscalYear) {
                setSelectedFiscalYear(currentFiscalYear.fiscal_year_id);
            }
            
            await getLatestLTP();
        } else {
            console.warn('No users found in the database');
            // Set a default empty value or handle the empty state
            setselectValue('');
            // Still fetch fiscal years for UI consistency
            const allFiscalYears = await getAllFiscalYears();
            setFiscalYears(allFiscalYears);
        }
    } catch (error) {
        console.error('Error fetching files:', error);
    } finally {
      setIsLoading(false)
    }
};
  
  useEffect(() => {
      fetchSelect();
  }, []); 

  function uploadDone() {
    router.refresh()
  }

  // Memoized data processing
  const processedHoldingsData = useMemo(() => {
    if (useFiscalYearData && unrealizedGains?.holdings) {
      // Use fiscal year data from unrealized gains holdings
      return unrealizedGains.holdings.map((holding) => ({
        client_id: holding.client_id || '',
        fund_id: holding.fund_id || 0,
        symbol: holding.symbol || '',
        price_per_share: Number(holding.effective_rate || 0),
        quantity: Number(holding.closing_quantity || 0),
        total_value: Number(((holding.closing_quantity || 0) * (holding.effective_rate || 0)).toFixed(0)),
        client_broker_mapping: { client_name: selectValue },
        stock_fulls: holding.stock_fulls || { full_form: '' },
        unrealizedGain: Number(holding.unrealized_gain || 0),
        unrealizedGainPercent: Number(holding.unrealized_gain_percent || 0)
      }));
    } else {
      // Use current data from symbol holdings
      return listOrderData.map((row) => {
        const unrealizedData = unrealizedGains?.holdings.find(h => h.symbol === row.symbol);
        return {
          ...row,
          fund_id: row.fund_id || 0,
          unrealizedGain: unrealizedData?.unrealized_gain || 0,
          unrealizedGainPercent: unrealizedData?.unrealized_gain_percent || 0
        };
      });
    }
  }, [listOrderData, unrealizedGains, useFiscalYearData, selectValue]);

  // Paginated holdings data
  const paginatedHoldingsData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return processedHoldingsData.slice(startIndex, startIndex + itemsPerPage);
  }, [processedHoldingsData, currentPage, itemsPerPage]);

  // Pagination calculations
  const totalPages = Math.ceil(processedHoldingsData.length / itemsPerPage);
  const totalItems = processedHoldingsData.length;

  // Calculate total value of all holdings (sum of individual total_value entries)
  // This is different from totalInvestment which comes from market value calculations
  const totalHoldingsValue = useMemo(() => {
    return processedHoldingsData.reduce((sum, row) => {
      return sum + Number(row.total_value || 0);
    }, 0);
  }, [processedHoldingsData]);

  // Reset pagination when user changes or data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectValue, useFiscalYearData, selectedFiscalYear]);

  // Optimize changeFetches with useCallback
  const changeFetches = useCallback(async () => {
    if (!selectValue) return;
    
    setIsLoading(true);
    try {
      if (useFiscalYearData && selectedFiscalYear !== null) {
        // Fetch fiscal year based data
        const [totalInvestmentFiscal, realizedGainsFiscal, unrealizedGainsFiscal, scripCountFiscal] = await Promise.all([
          getTotalInvestmentFiscal(selectValue, selectedFiscalYear),
          getRealizedGainsFiscal(selectValue, selectedFiscalYear),
          getUnrealizedGainsFiscal(selectValue, selectedFiscalYear),
          getScripCountFiscal(selectValue, selectedFiscalYear)
        ]);
        
        setFiscalYearData({
          totalInvestment: totalInvestmentFiscal.total_investment,
          realizedGain: realizedGainsFiscal.total_realized_gain,
          unrealizedGain: unrealizedGainsFiscal.total_unrealized_gain
        });
        
        setFiscalScripCount(scripCountFiscal);
        setUnrealizedGains(unrealizedGainsFiscal);
        
        // Fetch additional fiscal year data
        setTimeout(async () => {
          try {
            const [breakdownDataFiscal, sectorDataFiscal, stockBreakdownFiscal] = await Promise.all([
              getInvestmentBreakdownFiscal(selectValue, selectedFiscalYear),
              getSectorPortfolioSummaryFiscal(selectValue, selectedFiscalYear),
              getStockInvestmentBreakdownFiscal(selectValue, selectedFiscalYear)
            ]);
            
            setInvestmentBreakdown(breakdownDataFiscal);
            setSectorPortfolioSummary(sectorDataFiscal);
            setStockInvestmentBreakdown(stockBreakdownFiscal);
            setFiscalStockInvestmentBreakdown(stockBreakdownFiscal);
          } catch (error) {
            console.error('Error fetching fiscal year secondary data:', error);
          }
        }, 100);
      } else {
        // Fetch current data (original logic)
        const [investmentData, realisedGain, scrip_count] = await Promise.all([
          getTotalInvestment(selectValue),
          realisedProfitLoss(selectValue),
          scripCount(selectValue)
        ]);
        
        setlistInvestmentData(investmentData);
        setlistRealisedGain(realisedGain);
        setlistScripCount(scrip_count);
        
        // Fetch non-critical data after a slight delay to improve perceived performance
        setTimeout(async () => {
          try {
            const [order_data, unrealizedData, breakdownData, stockBreakdownData, sectorData] = await Promise.all([
              dashboardHoldings(selectValue),
              getUnrealizedGains(selectValue),
              getInvestmentBreakdown(selectValue),
              getStockInvestmentBreakdown(selectValue),
              getSectorPortfolioSummary(selectValue)
            ]);
            
            setlistOrderData(order_data);
            setUnrealizedGains(unrealizedData);
            setInvestmentBreakdown(breakdownData);
            setStockInvestmentBreakdown(stockBreakdownData);
            setSectorPortfolioSummary(sectorData);
          } catch (error) {
            console.error('Error fetching secondary data:', error);
          }
        }, 100);
      }
      
    } catch (error) {
      console.error('Error fetching primary data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectValue, useFiscalYearData, selectedFiscalYear]);

  // useEffect to call changeFetches when dependencies change
  useEffect(() => {
    // Only call changeFetches if we have a selectValue (user selected) and users exist
    if (selectValue && selectValue.trim() !== '' && selectedFiscalYear !== null && listUsersValue.length > 0) {
      changeFetches()
    }
  }, [selectValue, selectedFiscalYear, useFiscalYearData, changeFetches, listUsersValue.length]);

    // Check if we have no users and we're not loading
    if (!isLoading && listUsersValue.length === 0) {
      return (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center py-20">
            <div className="mx-auto max-w-md">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No Users Found</h3>
              <p className="mt-1 text-sm text-gray-500">
                No users are configured in the system. Please add users to the client_broker_mapping table to view portfolio data.
              </p>
              <div className="mt-6">
                <button
                  onClick={fetchSelect}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
    isLoading ? (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Title Skeleton */}
        <div className="text-center">
          <div className="h-10 bg-gray-200 rounded-lg w-64 mx-auto animate-pulse mb-6"></div>
        </div>
        
        {/* Upload Button Skeleton */}
        <div className="flex justify-end mb-6">
          <div className="h-10 w-36 bg-gray-200 rounded-lg animate-pulse"></div>
        </div>
        
        {/* Cards Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        
        {/* Portfolio Summary Skeleton */}
        <div className="mt-12 mb-6 flex justify-between items-center">
          <div className="h-7 w-40 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-10 w-64 bg-gray-200 rounded-lg animate-pulse"></div>
        </div>
        
        {/* Table Skeleton */}
        <div className="border rounded-lg p-4">
          <TableSkeleton rows={8} />
        </div>
        
        {/* Sector Summary Skeleton */}
        <div className="border rounded-lg p-4 mt-6">
          <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mb-4"></div>
          <TableSkeleton rows={10} />
        </div>
      </div>
    ) : (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <h1 className=" text-center font-bold text-4xl">{selectValue}</h1>
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-1">Data View</label>
              <div className="flex items-center gap-2">
                <button 
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    !useFiscalYearData 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  onClick={() => {
                    setUseFiscalYearData(false);
                    // Data will be refetched automatically due to useEffect dependency
                  }}
                >
                  Current
                </button>
                <button 
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    useFiscalYearData 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  onClick={() => {
                    setUseFiscalYearData(true);
                    // Data will be refetched automatically due to useEffect dependency
                  }}
                >
                  Fiscal Year
                </button>
              </div>
            </div>
            
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
          </div>
          {isAdmin && 
          <UploadBook onUpload={uploadDone} />
}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
<Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg">
  <CardContent className="p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-blue-100 text-sm font-medium">Total Investment</p>
        <p className="text-3xl font-bold mt-2">
          Rs. {(
            useFiscalYearData && fiscalYearData 
              ? fiscalYearData.totalInvestment 
              : listInvestmentData?._sum.total_value
          )?.toLocaleString() || '0'}
        </p>
      </div>
      <div className="bg-blue-400 bg-opacity-30 rounded-full p-3">
      <svg className="w-6 h-6 text-white-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" strokeLinecap="round" strokeWidth="2" d="M8 7V6a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-1M3 18v-7a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Zm8-3.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"/>
      </svg>

      </div>
    </div>
  </CardContent>
</Card>

<Card className={`${(
  useFiscalYearData && fiscalYearData 
    ? fiscalYearData.realizedGain 
    : listRealisedGain?._sum.profit_loss || 0
) >= 0 ? 'bg-gradient-to-br from-green-500 to-green-600' : 'bg-gradient-to-br from-red-500 to-red-600'} text-white border-0 shadow-lg`}>
  <CardContent className="p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className={`${(
          useFiscalYearData && fiscalYearData 
            ? fiscalYearData.realizedGain 
            : listRealisedGain?._sum.profit_loss || 0
        ) >= 0 ? 'text-green-100' : 'text-red-100'} text-sm font-medium`}>Realised P&L</p>
        <p className="text-3xl font-bold mt-2">
          Rs. {(
            useFiscalYearData && fiscalYearData 
              ? fiscalYearData.realizedGain 
              : listRealisedGain?._sum.profit_loss
          )?.toLocaleString() || '0'}
        </p>
      </div>
      <div className={`${(
        useFiscalYearData && fiscalYearData 
          ? fiscalYearData.realizedGain 
          : listRealisedGain?._sum.profit_loss || 0
      ) >= 0 ? 'bg-green-400' : 'bg-red-400'} bg-opacity-30 rounded-full p-3`}>
        {(
          useFiscalYearData && fiscalYearData 
            ? fiscalYearData.realizedGain 
            : listRealisedGain?._sum.profit_loss || 0
        ) >= 0 ? (
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        ) : (
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
          </svg>
        )}
      </div>
    </div>
  </CardContent>
</Card>

<Card className={`${(
  useFiscalYearData && fiscalYearData 
    ? fiscalYearData.unrealizedGain 
    : unrealizedGains?.total_unrealized_gain || 0
) >= 0 ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' : 'bg-gradient-to-br from-orange-500 to-orange-600'} text-white border-0 shadow-lg`}>
  <CardContent className="p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className={`${(
          useFiscalYearData && fiscalYearData 
            ? fiscalYearData.unrealizedGain 
            : unrealizedGains?.total_unrealized_gain || 0
        ) >= 0 ? 'text-emerald-100' : 'text-orange-100'} text-sm font-medium`}>Unrealised P&L</p>
        <p className="text-3xl font-bold mt-2">
          Rs. {(
            useFiscalYearData && fiscalYearData 
              ? fiscalYearData.unrealizedGain 
              : unrealizedGains?.total_unrealized_gain
          )?.toLocaleString() || '0'}
        </p>
      </div>
      <div className={`${(
        useFiscalYearData && fiscalYearData 
          ? fiscalYearData.unrealizedGain 
          : unrealizedGains?.total_unrealized_gain || 0
      ) >= 0 ? 'bg-emerald-400' : 'bg-orange-400'} bg-opacity-30 rounded-full p-3`}>
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </div>
    </div>
  </CardContent>
</Card>

<Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 shadow-lg">
  <CardContent className="p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-purple-100 text-sm font-medium">Held for Trading</p>
        <p className="text-3xl font-bold mt-2">
          Rs. {(useFiscalYearData && fiscalStockInvestmentBreakdown ? fiscalStockInvestmentBreakdown.trading.total : investmentBreakdown?.trading.total)?.toLocaleString() || '0'}
        </p>
      </div>
      <div className="bg-purple-400 bg-opacity-30 rounded-full p-3">
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      </div>
    </div>
  </CardContent>
</Card>

<Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-0 shadow-lg">
  <CardContent className="p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-indigo-100 text-sm font-medium">Held till Maturity</p>
        <p className="text-3xl font-bold mt-2">
          Rs. {(useFiscalYearData && fiscalStockInvestmentBreakdown ? fiscalStockInvestmentBreakdown.maturity.total : investmentBreakdown?.maturity.total)?.toLocaleString() || '0'}
        </p>
      </div>
      <div className="bg-indigo-400 bg-opacity-30 rounded-full p-3">
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    </div>
  </CardContent>
</Card>

<Card className="bg-gradient-to-br from-teal-500 to-teal-600 text-white border-0 shadow-lg">
  <CardContent className="p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-teal-100 text-sm font-medium">No. of Scrips</p>
        <p className="text-3xl font-bold mt-2">
          {useFiscalYearData ? (fiscalScripCount || 0) : (listScripCount || 0)}
        </p>
      </div>
      <div className="bg-teal-400 bg-opacity-30 rounded-full p-3">
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
    </div>
  </CardContent>
</Card>

</div>

<div className="mt-12 mb-6">
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-4">
        <span className="text-xl font-bold">Trading Portfolio Summary</span>
        {totalItems > 0 && (
          <span className="text-sm text-gray-500">
            ({totalItems} holdings{totalItems > itemsPerPage ? `, showing page ${currentPage} of ${totalPages}` : ''})
          </span>
        )}
      </div>
      <div>
        <Select defaultValue={selectValue} onValueChange={handleSelectValueChange}>
      <SelectTrigger className="w-[250px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Fund Category</SelectLabel>
          {listUsersValue.length > 0 ? (
            listUsersValue.map((option) => (
              <SelectItem key={option.client_id} value={String(option.client_name)}>
                {option.client_name}
              </SelectItem>
            ))
          ) : (
            <SelectItem value="" disabled>
              No users found
            </SelectItem>
          )}
        </SelectGroup>
      </SelectContent>
    </Select>
      </div>
    </div>
</div>


<Card className="h-fit">
    <div className="w-full overflow-x-auto pl-3 pr-3">
    <Table className="min-w-full">
  <TableHeader>
    <TableRow>
      <TableHead className="font-medium">Stock</TableHead>
      <TableHead className="text-center">Price Per Share</TableHead>
      <TableHead className="text-center">Quantity</TableHead>
      <TableHead className="text-right">Value</TableHead>
      <TableHead className="text-right">Unrealised P&L</TableHead>
      <TableHead className="text-right">(Unrealised P&L)%</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {paginatedHoldingsData.length === 0 ? (
      <TableRow>
        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
          {processedHoldingsData.length === 0 ? (
            <div>
              <p className="text-lg font-medium">No portfolio data available</p>
              <p className="text-sm">No holdings found for the selected user and period.</p>
            </div>
          ) : (
            <p>No data for current page</p>
          )}
        </TableCell>
      </TableRow>
    ) : (
      paginatedHoldingsData.map((row) => (
      <TableRow key={`${row.fund_id}-${row.symbol}`}>
      <TableCell className="font-medium">
      <Tooltip>
        <TooltipTrigger>
      <Link href={`/dashboard/stock/${row.symbol}`} target="_blank">{row.symbol}</Link>
      </TooltipTrigger>
      <TooltipContent>
        <Link href={`/dashboard/stock/${row.symbol}`} target="_blank">{row.stock_fulls.full_form}</Link>
      </TooltipContent>
      </Tooltip>
      </TableCell>
      <TableCell className="text-center">Rs. {(row.price_per_share || 0).toLocaleString()}</TableCell>
      <TableCell className="text-center">{(row.quantity || 0).toLocaleString()}</TableCell>
      <TableCell className="text-right">Rs. {Number(row.total_value || 0).toLocaleString()}</TableCell>
      <TableCell className={`text-right ${(row.unrealizedGain || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
        Rs. {(row.unrealizedGain || 0).toLocaleString()}
      </TableCell>
      <TableCell className={`text-right ${(row.unrealizedGain || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
        {(row.unrealizedGainPercent || 0).toFixed(2)}%
      </TableCell>
    </TableRow>
  ))
    )}
  </TableBody>

    <TableFooter>
      <TableRow>
      <TableCell colSpan={3}>Total</TableCell>
      <TableCell className="text-right">Rs. {totalHoldingsValue.toLocaleString()}</TableCell>
      <TableCell className="text-right">Rs. {(unrealizedGains?.total_unrealized_gain)?.toLocaleString()}</TableCell>
      <TableCell className="text-right">{unrealizedGains?.total_unrealized_gain && totalHoldingsValue > 0 ? (
        (unrealizedGains.total_unrealized_gain / totalHoldingsValue) * 100
      ).toFixed(2) : '0.00'}%</TableCell>
      </TableRow>
    </TableFooter>
</Table>
</div>
{totalItems > itemsPerPage && (
  <Pagination
    currentPage={currentPage}
    totalPages={totalPages}
    onPageChange={setCurrentPage}
    itemsPerPage={itemsPerPage}
    totalItems={totalItems}
  />
)}
</Card>

{ /* Sector Portfolio Summary */ }
<Card className="h-fit w-full mt-6">
  <CardHeader>
    <CardTitle>Portfolio Summary by Sector</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="w-full overflow-x-auto">
      <Table className="min-w-full">
        <TableHeader>
          <TableRow>
            <TableHead>SECTOR</TableHead>
            <TableHead className="text-center">Weightage %</TableHead>
            <TableHead className="text-right">HELD FOR TRADING</TableHead>
            <TableHead className="text-right">HELD FOR MATURITY</TableHead>
            <TableHead className="text-right">REALISED GAIN/LOSS</TableHead>
            <TableHead className="text-right">UNREALISED GAIN/LOSS</TableHead>
            <TableHead className="text-right">SECTOR G/L %</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="bg-gray-50 font-bold">
            <TableCell>TOTAL</TableCell>
            <TableCell className="text-center">100.0%</TableCell>
            <TableCell className="text-right">Rs. {sectorPortfolioSummary?.totalHeldForTrading.toLocaleString()}</TableCell>
            <TableCell className="text-right">Rs. {sectorPortfolioSummary?.totalHeldForMaturity.toLocaleString()}</TableCell>
            <TableCell className={`text-right ${sectorPortfolioSummary?.totalRealizedGain && sectorPortfolioSummary.totalRealizedGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {sectorPortfolioSummary?.totalRealizedGain && sectorPortfolioSummary.totalRealizedGain >= 0 ? '+' : ''}Rs. {sectorPortfolioSummary?.totalRealizedGain.toLocaleString()}
            </TableCell>
            <TableCell className={`text-right ${sectorPortfolioSummary?.totalUnrealizedGain && sectorPortfolioSummary.totalUnrealizedGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ({sectorPortfolioSummary?.totalUnrealizedGain && sectorPortfolioSummary.totalUnrealizedGain >= 0 ? '+' : ''}Rs. {sectorPortfolioSummary?.totalUnrealizedGain.toLocaleString()})
            </TableCell>
            <TableCell className={`text-right font-bold ${((sectorPortfolioSummary?.totalRealizedGain || 0) + (sectorPortfolioSummary?.totalUnrealizedGain || 0)) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {sectorPortfolioSummary && sectorPortfolioSummary.totalPortfolioValue > 0 ? 
                (((sectorPortfolioSummary.totalRealizedGain + sectorPortfolioSummary.totalUnrealizedGain) / sectorPortfolioSummary.totalPortfolioValue) * 100).toFixed(2)
                : '0.00'}%
            </TableCell>
          </TableRow>
          {sectorPortfolioSummary?.sectors.map((sector, index) => {
            const sectorColors = [
              'bg-blue-50 border-l-4 border-l-blue-500',
              'bg-green-50 border-l-4 border-l-green-500', 
              'bg-purple-50 border-l-4 border-l-purple-500',
              'bg-orange-50 border-l-4 border-l-orange-500',
              'bg-red-50 border-l-4 border-l-red-500',
              'bg-cyan-50 border-l-4 border-l-cyan-500',
              'bg-yellow-50 border-l-4 border-l-yellow-500',
              'bg-indigo-50 border-l-4 border-l-indigo-500',
              'bg-pink-50 border-l-4 border-l-pink-500',
              'bg-gray-50 border-l-4 border-l-gray-500',
            ];
            return (
              <TableRow key={sector.sector} className={sectorColors[index % sectorColors.length]}>
                <TableCell className="font-medium">{sector.sector}</TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center">
                    <div className="w-8 h-2 bg-blue-200 rounded-full overflow-hidden mr-2">
                      <div 
                        className="h-full bg-blue-600" 
                        style={{ width: `${Math.min(sector.weightagePercent, 100)}%` }}
                      ></div>
                    </div>
                    {sector.weightagePercent.toFixed(1)}%
                  </div>
                </TableCell>
                <TableCell className="text-right">Rs. {sector.heldForTrading.toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  {sector.heldForMaturity > 0 ? `Rs. ${sector.heldForMaturity.toLocaleString()}` : '-'}
                  {sector.heldForMaturity > 0 && (
                    <span className="ml-1 inline-block w-2 h-2 bg-green-500 rounded-full" title="Has maturity holdings"></span>
                  )}
                </TableCell>
                <TableCell className={`text-right ${sector.realizedGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {sector.realizedGain !== 0 ? (
                    <>
                      {sector.realizedGain >= 0 ? '+' : ''}Rs. {sector.realizedGain.toLocaleString()}
                      {sector.realizedGain >= 0 ? (
                        <span className="ml-1 inline-block w-2 h-2 bg-green-500 rounded-full" title="Positive realized gain"></span>
                      ) : (
                        <span className="ml-1 inline-block w-2 h-2 bg-red-500 rounded-full" title="Realized loss"></span>
                      )}
                    </>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </TableCell>
                <TableCell className={`text-right ${sector.unrealizedGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {sector.unrealizedGain >= 0 ? '+' : ''}Rs. {sector.unrealizedGain.toLocaleString()}
                  {sector.unrealizedGain >= 0 ? (
                    <span className="ml-1 inline-block w-2 h-2 bg-green-500 rounded-full" title="Unrealized gain"></span>
                  ) : (
                    <span className="ml-1 inline-block w-2 h-2 bg-red-500 rounded-full" title="Unrealized loss"></span>
                  )}
                </TableCell>
                <TableCell className={`text-right font-medium ${sector.sectorGainPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {sector.sectorGainPercent >= 0 ? '+' : ''}{sector.sectorGainPercent.toFixed(2)}%
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  </CardContent>
</Card>


{/* Sector Breakdown Card */}
<Card className="h-fit w-full">
  <CardHeader>
    <CardTitle>Sector Breakdown</CardTitle>
    <p className="text-sm text-gray-600 mt-1">Investment distribution across sectors</p>
  </CardHeader>
  <CardContent>
<Tabs defaultValue="trading" className="w-full">
  <TabsList>
    <TabsTrigger value="trading">Held for Trading</TabsTrigger>
    <TabsTrigger value="maturity">Held for Maturity</TabsTrigger>
  </TabsList>
  <TabsContent value="trading" className="mt-4">
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-sm font-medium text-gray-700">Total Trading Portfolio by Sector</p>
        <p className="text-xs text-gray-500">*Amounts in Millions (Cost Value)</p>
      </div>
      <ChartContainer config={tradingChartConfig}>
        <BarChart
          accessibilityLayer
          data={investmentBreakdown?.trading.data || []}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 80,
          }}
        >
          <XAxis
            dataKey="sector"
            tickLine={false}
            tickMargin={10}
            axisLine={false}
            angle={-45}
            tick={{ fontSize: 10,  textAnchor: 'end' }}
            height={80}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `${(value / 1000000).toFixed(2)}`}
          />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent indicator="dashed" />}
            formatter={(value) => [`Rs. ${Number(value).toLocaleString()}`, ""]}
          />
          <Bar dataKey="value" radius={4}>
            {(investmentBreakdown?.trading.data || []).map((entry, index) => {
              const colors = [
                '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', 
                '#06b6d4', '#84cc16', '#f97316', '#8b5cf6', '#6366f1',
                '#ec4899', '#14b8a6', '#f59e0b', '#ef4444', '#6b7280'
              ];
              return (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.value > 0 ? colors[index % colors.length] : '#e5e7eb'} 
                />
              );
            })}
          </Bar>
        </BarChart>
      </ChartContainer>
      
      {/* Sector List */}
      <div className="mt-6">
        <h4 className="text-sm font-medium mb-3 text-gray-700">All Sectors (Trading Portfolio)</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
          {(investmentBreakdown?.trading.data || []).map((sector, index) => {
            const colors = [
              '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', 
              '#06b6d4', '#84cc16', '#f97316', '#8b5cf6', '#6366f1',
              '#ec4899', '#14b8a6', '#f59e0b', '#ef4444', '#6b7280'
            ];
            return (
              <div key={sector.sector} className="flex items-center gap-2 p-2 rounded border bg-gray-50">
                <div 
                  className="w-3 h-3 rounded-sm flex-shrink-0" 
                  style={{ backgroundColor: sector.value > 0 ? colors[index % colors.length] : '#e5e7eb' }}
                ></div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{sector.sector}</div>
                  <div className={`text-xs ${
                    sector.value > 0 ? 'text-gray-600' : 'text-gray-400'
                  }`}>
                    {sector.value > 0 
                      ? `${(sector.value / 1000000).toFixed(2)} Million (${sector.percentage.toFixed(2)}%)` 
                      : '-'
                    }
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  </TabsContent>
  <TabsContent value="maturity" className="mt-4">
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-sm font-medium text-gray-700">Total Maturity Portfolio by Sector</p>
        <p className="text-xs text-gray-500">*Amounts in Millions (Cost Value)</p>
      </div>
      <ChartContainer config={maturityChartConfig}>
        <BarChart
          accessibilityLayer
          data={investmentBreakdown?.maturity.data || []}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 80,
          }}
        >
          <XAxis
            dataKey="sector"
            tickLine={false}
            tickMargin={10}
            axisLine={false}
            angle={-45}
            tick={{ fontSize: 10,  textAnchor: 'end' }}
            height={80}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `${(value / 1000000).toFixed(2)}`}
          />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent indicator="dashed" />}
            formatter={(value) => [`Rs. ${Number(value).toLocaleString()}`, ""]}
          />
          <Bar dataKey="value" radius={4}>
            {(investmentBreakdown?.maturity.data || []).map((entry, index) => {
              const colors = [
                '#8b5cf6', '#06b6d4', '#84cc16', '#f59e0b', '#ef4444',
                '#3b82f6', '#10b981', '#f97316', '#6366f1', '#ec4899',
                '#14b8a6', '#f59e0b', '#ef4444', '#6b7280', '#8b5cf6'
              ];
              return (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.value > 0 ? colors[index % colors.length] : '#e5e7eb'} 
                />
              );
            })}
          </Bar>
        </BarChart>
      </ChartContainer>
      
      {/* Sector List */}
      <div className="mt-6">
        <h4 className="text-sm font-medium mb-3 text-gray-700">All Sectors (Maturity Portfolio)</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
          {(investmentBreakdown?.maturity.data || []).map((sector, index) => {
            const colors = [
              '#8b5cf6', '#06b6d4', '#84cc16', '#f59e0b', '#ef4444',
              '#3b82f6', '#10b981', '#f97316', '#6366f1', '#ec4899',
              '#14b8a6', '#f59e0b', '#ef4444', '#6b7280', '#8b5cf6'
            ];
            return (
              <div key={sector.sector} className="flex items-center gap-2 p-2 rounded border bg-gray-50">
                <div 
                  className="w-3 h-3 rounded-sm flex-shrink-0" 
                  style={{ backgroundColor: sector.value > 0 ? colors[index % colors.length] : '#e5e7eb' }}
                ></div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{sector.sector}</div>
                  <div className={`text-xs ${
                    sector.value > 0 ? 'text-gray-600' : 'text-gray-400'
                  }`}>
                    {sector.value > 0 
                      ? `${(sector.value / 1000000).toFixed(2)} Million (${sector.percentage.toFixed(2)}%)` 
                      : '-'
                    }
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  </TabsContent>
</Tabs>
  </CardContent>
</Card>

{/* Investment Breakdown Card */}
<Card className="h-fit w-full">
  <CardHeader>
    <CardTitle>Investment Breakdown</CardTitle>
    <p className="text-sm text-gray-600 mt-1">Individual stock breakdown by portfolio type</p>
  </CardHeader>
  <CardContent>
<Tabs defaultValue="trading" className="w-full">
  <TabsList>
    <TabsTrigger value="trading">Held for Trading</TabsTrigger>
    <TabsTrigger value="maturity">Held till Maturity</TabsTrigger>
  </TabsList>
  <TabsContent value="trading" className="mt-4">
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="text-center p-4 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">Rs. {(stockInvestmentBreakdown?.trading.total || 0).toLocaleString()}</div>
          <div className="text-sm font-medium text-gray-600">Trading Portfolio</div>
          <div className="text-xs text-gray-500 mt-1">
            {((stockInvestmentBreakdown?.trading.total || 0) / ((stockInvestmentBreakdown?.trading.total || 0) + (stockInvestmentBreakdown?.maturity.total || 0)) * 100).toFixed(1)}% of total
          </div>
        </div>
        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{stockInvestmentBreakdown?.trading.count || 0}</div>
          <div className="text-sm font-medium text-gray-600">Active Stocks</div>
          <div className="text-xs text-gray-500 mt-1">All trading stocks</div>
        </div>
      </div>
      
      <div className="text-center">
        <p className="text-sm font-medium text-gray-700">All Trading Stocks by Value</p>
        <p className="text-xs text-gray-500">*Amounts in Millions</p>
      </div>
      <ChartContainer config={tradingChartConfig}>
        <BarChart
          accessibilityLayer
          data={stockInvestmentBreakdown?.trading.data || []}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 60,
          }}
        >
          <XAxis
            dataKey="symbol"
            tickLine={false}
            tickMargin={10}
            axisLine={false}
            angle={-45}
            tick={{ fontSize: 10, textAnchor: 'end' }}
            height={60}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `${(value / 1000000).toFixed(2)}`}
          />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent indicator="dashed" />}
            formatter={(value) => [`Rs. ${Number(value).toLocaleString()}`, ""]}
          />
          <Bar dataKey="value" radius={4}>
            {(stockInvestmentBreakdown?.trading.data || []).map((entry, index) => {
              const colors = [
                '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', 
                '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#ec4899'
              ];
              return (
                <Cell 
                  key={`cell-${index}`} 
                  fill={colors[index % colors.length]} 
                />
              );
            })}
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  </TabsContent>
  <TabsContent value="maturity" className="mt-4">
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="text-center p-4 bg-purple-50 rounded-lg">
          <div className="text-2xl font-bold text-purple-600">Rs. {(stockInvestmentBreakdown?.maturity.total || 0).toLocaleString()}</div>
          <div className="text-sm font-medium text-gray-600">Long-term Portfolio</div>
          <div className="text-xs text-gray-500 mt-1">
            {((stockInvestmentBreakdown?.maturity.total || 0) / ((stockInvestmentBreakdown?.trading.total || 0) + (stockInvestmentBreakdown?.maturity.total || 0)) * 100).toFixed(1)}% of total
          </div>
        </div>
        <div className="text-center p-4 bg-indigo-50 rounded-lg">
          <div className="text-2xl font-bold text-indigo-600">{stockInvestmentBreakdown?.maturity.count || 0}</div>
          <div className="text-sm font-medium text-gray-600">Core Holdings</div>
          <div className="text-xs text-gray-500 mt-1">Long-term investments</div>
        </div>
      </div>
      
      <div className="text-center">
        <p className="text-sm font-medium text-gray-700">All Maturity Stocks by Value</p>
        <p className="text-xs text-gray-500">*Amounts in Millions</p>
      </div>
      <ChartContainer config={maturityChartConfig}>
        <BarChart
          accessibilityLayer
          data={stockInvestmentBreakdown?.maturity.data || []}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 60,
          }}
        >
          <XAxis
            dataKey="symbol"
            tickLine={false}
            tickMargin={10}
            axisLine={false}
            angle={-45}
            tick={{ fontSize: 10, textAnchor: 'end' }}
            height={60}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `${(value / 1000000).toFixed(2)}`}
          />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent indicator="dashed" />}
            formatter={(value) => [`Rs. ${Number(value).toLocaleString()}`, ""]}
          />
          <Bar dataKey="value" radius={4}>
            {(stockInvestmentBreakdown?.maturity.data || []).map((entry, index) => {
              const colors = [
                '#8b5cf6', '#06b6d4', '#84cc16', '#f59e0b', '#ef4444',
                '#3b82f6', '#10b981', '#f97316', '#6366f1', '#ec4899'
              ];
              return (
                <Cell 
                  key={`cell-${index}`} 
                  fill={colors[index % colors.length]} 
                />
              );
            })}
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  </TabsContent>
</Tabs>
  </CardContent>
</Card>
</div>
    )
  );
}
