"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  getBonusRecords, 
  getPromoterRecords, 
  getRightRecords, 
  getCashRecords,
  deleteBonusRecord,
  deletePromoterRecord,
  deleteRightRecord,
  deleteCashRecord
} from "@/app/api/manualHistoryAPI/actions";
import { getIPOAllotmentRecords, deleteIPOAllotmentRecord, getIPOAllotmentStagingRecords, deleteIPOAllotmentStaging, dematerializeIPOStaging } from "@/app/api/ipoAllotmentAPI/actions"
import { PromoterDialog } from "@/components/dialogs/promoter-dialog"
import { BonusDialog } from "@/components/dialogs/bonus-dialog"
import { RightDialog } from "@/components/dialogs/right-dialog"
import { CashDialog } from "@/components/dialogs/cash-dialog"
import { CloseoutDialog } from "@/components/dialogs/closeout-dialog"
import { IPOAllotmentDialog } from "@/components/dialogs/ipo-allotment-dialog"
import { getUsers } from "@/app/api/dashboardAPICalls/actions";
import { getFiscal } from "@/app/api/fiscalAPI/actions";
import { RefreshCw } from "lucide-react";
import {
  Trash2, 
  TrendingUp, 
  Users, 
  ArrowUpRight, 
  DollarSign,
  Calendar,
  Hash,
  Percent,
  Star,
  PackageOpen
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Pagination } from "./ui/pagination";
import { Decimal } from "@prisma/client/runtime/library";

type UserFund = {
  client_id: string;
  client_name: string;
  client_broker: number;
  recorded_at: Date | null;
};

type FiscalYear = {
  fiscal_year_id: number;
  year_label: string;
  start_date: Date;
  end_date: Date;
};

type BonusRecord = {
  bonus_id: number;
  fund_id: number;
  client_id: string;
  symbol: string;
  bonus_percent: number;
  quantity: number;
  bookclose_date: Date;
  effective_rate: number;
  fiscal_year_id: number | null;
  client_broker_mapping: {
    client_name: string;
    client_id: string;
  };
  stock_fulls: {
    symbol: string;
    full_form: string;
  };
  funds: {
    fund_name: string;
  };
  fiscal_years: {
    year_label: string;
  } | null;
};

type PromoterRecord = {
  promoter_id: number;
  fund_id: number;
  client_id: string;
  symbol: string;
  quantity: number;
  effective_rate: number;
  total_value: number | null;
  fiscal_year_id: number | null;
  recorded_at: Date | null;
  added_at: Date | null;
  client_broker_mapping: {
    client_name: string;
    client_id: string;
  };
  stock_fulls: {
    symbol: string;
    full_form: string;
  };
  funds: {
    fund_name: string;
  };
  fiscal_years: {
    year_label: string;
  } | null;
};

type RightRecord = {
  right_id: number;
  fund_id: number;
  client_id: string;
  symbol: string;
  right_ratio: string;
  bookclose_date: Date;
  quantity: number;
  effective_rate: number;
  fiscal_year_id: number | null;
  total_value: number | null;
  client_broker_mapping: {
    client_name: string;
    client_id: string;
  };
  stock_fulls: {
    symbol: string;
    full_form: string;
  };
  funds: {
    fund_name: string;
  };
  fiscal_years: {
    year_label: string;
  } | null;
};

type CashRecord = {
  cash_id: number;
  fund_id: number;
  client_id: string;
  symbol: string;
  amount: number;
  bookclose_date: Date;
  fiscal_year_id: number | null;
  recorded_at: Date | null;
  client_broker_mapping: {
    client_name: string;
    client_id: string;
  };
  stock_fulls: {
    symbol: string;
    full_form: string;
  };
  funds: {
    fund_name: string;
  };
  fiscal_years: {
    year_label: string;
  } | null;
};

type IPOAllotmentRecord = {
  allotment_id: number;
  fund_id: number;
  client_id: string;
  quantity: number;
  effective_rate: Decimal;
  total_value: Decimal | null;
  fiscal_year_id: number | null;
  recorded_at: Date | null;
  added_at: Date;
  client_broker_mapping: {
    client_name: string;
    client_id: string;
  };
  funds: {
    fund_name: string;
  };
  fiscal_years: {
    year_label: string;
  } | null;
};

type IPOAllotmentStagingRecord = {
  allotment_staging_id: number;
  fund_id: number;
  quantity: number;
  effective_rate: number;
  total_value: number | null;
  fiscal_year_id: number;
  recorded_at: Date | null;
  added_at: Date;
  symbol: string;
  funds: {
    fund_name: string;
  };
  fiscal_years: {
    year_label: string;
  } | null;
  stock_fulls: {
    symbol: string;
    full_form: string;
  };
  sub_classes: {
    sub_name: string;
  } | null;
};

export default function ManualHistoryComponent() {
  const [bonusRecords, setBonusRecords] = useState<BonusRecord[]>([]);
  const [promoterRecords, setPromoterRecords] = useState<PromoterRecord[]>([]);
  const [rightRecords, setRightRecords] = useState<RightRecord[]>([]);
  const [cashRecords, setCashRecords] = useState<CashRecord[]>([]);
  const [ipoAllotmentRecords, setIPOAllotmentRecords] = useState<IPOAllotmentRecord[]>([]);
  const [ipoAllotmentStagingRecords, setIPOAllotmentStagingRecords] = useState<IPOAllotmentStagingRecord[]>([]);
  const [funds, setFunds] = useState<UserFund[]>([]);
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [selectedFund, setSelectedFund] = useState<string>("");
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("bonus");
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [dematerializeDialogOpen, setDematerializeDialogOpen] = useState(false);
  const [selectedStagingRecord, setSelectedStagingRecord] = useState<IPOAllotmentStagingRecord | null>(null);
  const [clientIdForDemat, setClientIdForDemat] = useState<string>('');
  const [clientTradingForDemat, setClientTradingForDemat] = useState<string>('');
  const [dematerializeLoading, setDematerializeLoading] = useState(false);
  
  // Pagination states for each tab
  const [bonusPage, setBonusPage] = useState(1);
  const [promoterPage, setPromoterPage] = useState(1);
  const [rightPage, setRightPage] = useState(1);
  const [cashPage, setCashPage] = useState(1);
  const [ipoPage, setIPOPage] = useState(1);
  const [ipoStagingPage, setIPOStagingPage] = useState(1);
  const itemsPerPage = 10;

  const fetchAllRecords = async (fundName?: string, fiscalYearId?: number) => {
    setLoading(true);
    try {
      const [bonus, promoter, right, cash, ipoAllotment, ipoStaging] = await Promise.all([
        getBonusRecords(fundName, fiscalYearId),
        getPromoterRecords(fundName, fiscalYearId),
        getRightRecords(fundName, fiscalYearId),
        getCashRecords(fundName, fiscalYearId),
        getIPOAllotmentRecords(fundName, fiscalYearId),
        getIPOAllotmentStagingRecords(fundName, fiscalYearId)
      ]);

      setBonusRecords(bonus);
      setPromoterRecords(promoter);
      setRightRecords(right);
      setCashRecords(cash);
      setIPOAllotmentRecords(ipoAllotment);
      setIPOAllotmentStagingRecords(ipoStaging);
    } catch (error) {
      console.error('Error fetching records:', error);
      toast.error('Failed to fetch records');
    } finally {
      setLoading(false);
    }
  };

  const fetchFunds = async () => {
    try {
      const usersList = await getUsers();
      setFunds(usersList);
      
      // Set first fund as selected if funds exist and no fund is currently selected
      if (usersList.length > 0 && !selectedFund) {
        setSelectedFund(usersList[0].client_name);
      }
    } catch (error) {
      console.error('Error fetching funds:', error);
      toast.error('Failed to fetch funds');
    }
  };

  const fetchFiscalYears = async () => {
    try {
      const fiscalsList = await getFiscal();
      setFiscalYears(fiscalsList);
      
      // Set current fiscal year as selected if fiscal years exist and no fiscal year is currently selected
      if (fiscalsList.length > 0 && !selectedFiscalYear) {
        const currentDate = new Date();
        const currentFiscalYear = fiscalsList.find(fiscal => {
          const startDate = new Date(fiscal.start_date);
          const endDate = new Date(fiscal.end_date);
          return currentDate >= startDate && currentDate <= endDate;
        });
        
        // If current fiscal year found, use it; otherwise use the first one
        const defaultFiscalYear = currentFiscalYear || fiscalsList[0];
        setSelectedFiscalYear(defaultFiscalYear.fiscal_year_id.toString());
      }
    } catch (error) {
      console.error('Error fetching fiscal years:', error);
      toast.error('Failed to fetch fiscal years');
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      await Promise.all([
        fetchFunds(),
        fetchFiscalYears()
      ]);
    };
    initializeData();
  }, []);

  useEffect(() => {
    if (selectedFund && selectedFiscalYear) {
      const fiscalYearId = Number(selectedFiscalYear);
      fetchAllRecords(selectedFund, fiscalYearId);
    }
  }, [selectedFund, selectedFiscalYear]);

  const handleFundChange = (value: string) => {
    setSelectedFund(value);
  };

  const handleFiscalYearChange = (value: string) => {
    setSelectedFiscalYear(value);
  };

  const handleDeleteBonus = async (bonusId: number) => {
    setDeleteLoading(`bonus-${bonusId}`);
    try {
      await deleteBonusRecord(bonusId);
      setBonusRecords(prev => prev.filter(record => record.bonus_id !== bonusId));
      toast.success('Bonus record deleted successfully');
    } catch (error) {
      console.error('Error deleting bonus record:', error);
      toast.error('Failed to delete bonus record');
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleDeletePromoter = async (promoterId: number) => {
    setDeleteLoading(`promoter-${promoterId}`);
    try {
      await deletePromoterRecord(promoterId);
      setPromoterRecords(prev => prev.filter(record => record.promoter_id !== promoterId));
      toast.success('Promoter record deleted successfully');
    } catch (error) {
      console.error('Error deleting promoter record:', error);
      toast.error('Failed to delete promoter record');
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleDeleteRight = async (rightId: number) => {
    setDeleteLoading(`right-${rightId}`);
    try {
      await deleteRightRecord(rightId);
      setRightRecords(prev => prev.filter(record => record.right_id !== rightId));
      toast.success('Right record deleted successfully');
    } catch (error) {
      console.error('Error deleting right record:', error);
      toast.error('Failed to delete right record');
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleDeleteCash = async (cashId: number) => {
    setDeleteLoading(`cash-${cashId}`);
    try {
      await deleteCashRecord(cashId);
      setCashRecords(prev => prev.filter(record => record.cash_id !== cashId));
      toast.success('Cash record deleted successfully');
    } catch (error) {
      console.error('Error deleting cash record:', error);
      toast.error('Failed to delete cash record');
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleDeleteIPOAllotment = async (allotmentId: number) => {
    setDeleteLoading(`ipo-${allotmentId}`);
    try {
      const result = await deleteIPOAllotmentRecord(allotmentId);
      if (result.success) {
        setIPOAllotmentRecords(prev => prev.filter(record => record.allotment_id !== allotmentId));
        toast.success('IPO allotment record deleted successfully');
      } else {
        toast.error(result.error || 'Failed to delete IPO allotment record');
      }
    } catch (error) {
      console.error('Error deleting IPO allotment record:', error);
      toast.error('Failed to delete IPO allotment record');
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleDeleteIPOStaging = async (stagingId: number) => {
    setDeleteLoading(`ipo-staging-${stagingId}`);
    try {
      const result = await deleteIPOAllotmentStaging(stagingId);
      if (result.success) {
        setIPOAllotmentStagingRecords(prev => prev.filter(record => record.allotment_staging_id !== stagingId));
        toast.success('IPO staging record deleted successfully');
      } else {
        toast.error(result.error || 'Failed to delete IPO staging record');
      }
    } catch (error) {
      console.error('Error deleting IPO staging record:', error);
      toast.error('Failed to delete IPO staging record');
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleDematerialize = async () => {
    if (!selectedStagingRecord || !clientIdForDemat.trim() || !clientTradingForDemat.trim()) {
      toast.error('Please select a client');
      return;
    }

    setDematerializeLoading(true);
    try {
      const result = await dematerializeIPOStaging(selectedStagingRecord.allotment_staging_id, clientIdForDemat, clientTradingForDemat);
      if (result.success) {
        setIPOAllotmentStagingRecords(prev => 
          prev.filter(record => record.allotment_staging_id !== selectedStagingRecord.allotment_staging_id)
        );
        toast.success(`IPO dematerialized to client ${clientIdForDemat}`);
        setDematerializeDialogOpen(false);
        setSelectedStagingRecord(null);
        setClientIdForDemat('');
        setClientTradingForDemat('')
        // Refresh records to show in IPO Allotment tab
        const fiscalYearId = selectedFiscalYear ? Number(selectedFiscalYear) : undefined;
        fetchAllRecords(selectedFund, fiscalYearId);
      } else {
        toast.error(result.error || 'Failed to dematerialize IPO');
      }
    } catch (error) {
      console.error('Error dematerializing IPO:', error);
      toast.error('Failed to dematerialize IPO');
    } finally {
      setDematerializeLoading(false);
    }
  };

  // Pagination calculations
  const bonusTotalPages = Math.ceil(bonusRecords.length / itemsPerPage);
  const bonusStartIndex = (bonusPage - 1) * itemsPerPage;
  const paginatedBonusRecords = bonusRecords.slice(bonusStartIndex, bonusStartIndex + itemsPerPage);
  
  const promoterTotalPages = Math.ceil(promoterRecords.length / itemsPerPage);
  const promoterStartIndex = (promoterPage - 1) * itemsPerPage;
  const paginatedPromoterRecords = promoterRecords.slice(promoterStartIndex, promoterStartIndex + itemsPerPage);
  
  const rightTotalPages = Math.ceil(rightRecords.length / itemsPerPage);
  const rightStartIndex = (rightPage - 1) * itemsPerPage;
  const paginatedRightRecords = rightRecords.slice(rightStartIndex, rightStartIndex + itemsPerPage);
  
  const cashTotalPages = Math.ceil(cashRecords.length / itemsPerPage);
  const cashStartIndex = (cashPage - 1) * itemsPerPage;
  const paginatedCashRecords = cashRecords.slice(cashStartIndex, cashStartIndex + itemsPerPage);
  
  const ipoTotalPages = Math.ceil(ipoAllotmentRecords.length / itemsPerPage);
  const ipoStartIndex = (ipoPage - 1) * itemsPerPage;
  const paginatedIPORecords = ipoAllotmentRecords.slice(ipoStartIndex, ipoStartIndex + itemsPerPage);
  
  const ipoStagingTotalPages = Math.ceil(ipoAllotmentStagingRecords.length / itemsPerPage);
  const ipoStagingStartIndex = (ipoStagingPage - 1) * itemsPerPage;
  const paginatedIPOStagingRecords = ipoAllotmentStagingRecords.slice(ipoStagingStartIndex, ipoStagingStartIndex + itemsPerPage);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="animate-spin size-8" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Manual Stock Entry Buttons */}
      <Card className="bg-white shadow-sm border border-gray-200 mb-6">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-gray-900">Manual Stock Entry</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <PromoterDialog onSuccess={() => {
              const fiscalYearId = selectedFiscalYear ? Number(selectedFiscalYear) : undefined;
              fetchAllRecords(selectedFund, fiscalYearId);
            }} />
            <BonusDialog onSuccess={() => {
              const fiscalYearId = selectedFiscalYear ? Number(selectedFiscalYear) : undefined;
              fetchAllRecords(selectedFund, fiscalYearId);
            }} />
            <RightDialog onSuccess={() => {
              const fiscalYearId = selectedFiscalYear ? Number(selectedFiscalYear) : undefined;
              fetchAllRecords(selectedFund, fiscalYearId);
            }} />
            <CashDialog onSuccess={() => {
              const fiscalYearId = selectedFiscalYear ? Number(selectedFiscalYear) : undefined;
              fetchAllRecords(selectedFund, fiscalYearId);
            }} />
            <CloseoutDialog onSuccess={() => {
              const fiscalYearId = selectedFiscalYear ? Number(selectedFiscalYear) : undefined;
              fetchAllRecords(selectedFund, fiscalYearId);
            }} />
            <IPOAllotmentDialog onSuccess={() => {
              const fiscalYearId = selectedFiscalYear ? Number(selectedFiscalYear) : undefined;
              fetchAllRecords(selectedFund, fiscalYearId);
            }} />
          </div>
        </CardContent>
      </Card>

      {/* Fund and Fiscal Year Selection */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
          {/* Fund Filter */}
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Fund:</h2>
            <Select value={selectedFund} onValueChange={handleFundChange}>
              <SelectTrigger className="w-[280px] bg-white border-gray-300 shadow-sm">
                <SelectValue placeholder="Select a fund" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Available Funds</SelectLabel>
                  {funds.map((fund) => (
                    <SelectItem key={fund.client_id} value={fund.client_name}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        {fund.client_name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* Fiscal Year Filter */}
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Fiscal Year:</h2>
            <Select value={selectedFiscalYear} onValueChange={handleFiscalYearChange}>
              <SelectTrigger className="w-[200px] bg-white border-gray-300 shadow-sm">
                <SelectValue placeholder="Select fiscal year" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Fiscal Years</SelectLabel>
                  {fiscalYears.map((fiscal) => (
                    <SelectItem key={fiscal.fiscal_year_id} value={fiscal.fiscal_year_id.toString()}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        {fiscal.year_label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="mt-3 text-sm text-gray-600">
          {selectedFund && selectedFiscalYear && (
            <span>
              Showing: <strong>{selectedFund}</strong>
              {" | Fiscal Year: "}
              <strong>
                {fiscalYears.find(f => f.fiscal_year_id.toString() === selectedFiscalYear)?.year_label || selectedFiscalYear}
              </strong>
            </span>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6 h-12 bg-gray-100 rounded-lg p-1">
          <TabsTrigger 
            value="bonus" 
            className="flex items-center gap-2 h-10 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-emerald-700 data-[state=active]:text-white transition-all duration-200"
          >
            <TrendingUp className="w-4 h-4" />
            <span className="hidden sm:inline">Bonus Shares</span>
            <span className="sm:hidden">Bonus</span>
            <Badge variant="secondary" className="ml-1 bg-emerald-100 text-emerald-800 text-xs">
              {bonusRecords.length.toLocaleString()}
            </Badge>
          </TabsTrigger>
          <TabsTrigger 
            value="promoter"
            className="flex items-center gap-2 h-10 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white transition-all duration-200"
          >
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Promoter Shares</span>
            <span className="sm:hidden">Promoter</span>
            <Badge variant="secondary" className="ml-1 bg-purple-100 text-purple-800 text-xs">
              {promoterRecords.length.toLocaleString()}
            </Badge>
          </TabsTrigger>
          <TabsTrigger 
            value="right"
            className="flex items-center gap-2 h-10 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white transition-all duration-200"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span className="hidden sm:inline">Right Shares</span>
            <span className="sm:hidden">Rights</span>
            <Badge variant="secondary" className="ml-1 bg-blue-100 text-blue-800 text-xs">
              {rightRecords.length.toLocaleString()}
            </Badge>
          </TabsTrigger>
          <TabsTrigger 
            value="cash"
            className="flex items-center gap-2 h-10 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-600 data-[state=active]:to-orange-700 data-[state=active]:text-white transition-all duration-200"
          >
            <DollarSign className="w-4 h-4" />
            <span className="hidden sm:inline">Cash Dividend</span>
            <span className="sm:hidden">Cash</span>
            <Badge variant="secondary" className="ml-1 bg-orange-100 text-orange-800 text-xs">
              {cashRecords.length.toLocaleString()}
            </Badge>
          </TabsTrigger>
          <TabsTrigger 
            value="ipo"
            className="flex items-center gap-2 h-10 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-indigo-700 data-[state=active]:text-white transition-all duration-200"
          >
            <Star className="w-4 h-4" />
            <span className="hidden sm:inline">IPO Allotment</span>
            <span className="sm:hidden">IPO</span>
            <Badge variant="secondary" className="ml-1 bg-indigo-100 text-indigo-800 text-xs">
              {ipoAllotmentRecords.length.toLocaleString()}
            </Badge>
          </TabsTrigger>
          <TabsTrigger 
            value="ipo-staging"
            className="flex items-center gap-2 h-10 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600 data-[state=active]:to-amber-700 data-[state=active]:text-white transition-all duration-200"
          >
            <PackageOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Non DEMAT IPO</span>
            <span className="sm:hidden">Pending</span>
            <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-800 text-xs">
              {ipoAllotmentStagingRecords.length.toLocaleString()}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Bonus Records Tab */}
        <TabsContent value="bonus" className="mt-6">
          <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-t-lg">
              <CardTitle className="text-emerald-800 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Bonus Share Records
                <Badge variant="secondary" className="ml-2 bg-emerald-200 text-emerald-800">
                  {bonusRecords.length} records
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {bonusRecords.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <TrendingUp className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium mb-2">No Bonus Records Found</p>
                  <p className="text-sm">There are no bonus share records to display.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left p-4 font-medium text-gray-700">Symbol</th>
                        <th className="text-left p-4 font-medium text-gray-700">Client</th>
                        <th className="text-left p-4 font-medium text-gray-700">Fund</th>
                        <th className="text-left p-4 font-medium text-gray-700">Bonus %</th>
                        <th className="text-left p-4 font-medium text-gray-700">Quantity</th>
                        <th className="text-left p-4 font-medium text-gray-700">Effective Rate</th>
                        <th className="text-left p-4 font-medium text-gray-700">Book Close Date</th>
                        <th className="text-left p-4 font-medium text-gray-700">Fiscal Year</th>
                        <th className="text-center p-4 font-medium text-gray-700">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedBonusRecords.map((record, index) => (
                        <tr key={record.bonus_id} className={`border-b hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className="font-semibold text-emerald-700">{record.symbol}</span>
                              <span className="text-xs text-gray-500 truncate max-w-32">{record.stock_fulls.full_form}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-900">{record.client_broker_mapping.client_name}</span>
                              <span className="text-xs text-gray-500">{record.client_id}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge variant="outline" className="text-xs">
                              {record.funds.fund_name}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1">
                              <Percent className="w-3 h-3 text-emerald-600" />
                              <span className="font-semibold text-emerald-700">{record.bonus_percent.toFixed(2)}%</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1">
                              <Hash className="w-3 h-3 text-gray-600" />
                              <span className="font-medium">{record.quantity.toLocaleString()}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="font-medium text-gray-900">Rs. {record.effective_rate.toFixed(2)}</span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-gray-600" />
                              <span className="text-sm">{format(new Date(record.bookclose_date), 'dd MMM yyyy')}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge variant="secondary" className="text-xs">
                              {record.fiscal_years?.year_label || 'N/A'}
                            </Badge>
                          </td>
                          <td className="p-4 text-center">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="destructive" 
                                  size="sm" 
                                  className="h-8 w-8 p-0"
                                  disabled={deleteLoading === `bonus-${record.bonus_id}`}
                                >
                                  {deleteLoading === `bonus-${record.bonus_id}` ? (
                                    <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3 h-3" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-red-600">Delete Bonus Record</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this bonus record for <strong>{record.symbol}</strong>? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleDeleteBonus(record.bonus_id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {bonusRecords.length > 0 && (
                <Pagination
                  currentPage={bonusPage}
                  totalPages={bonusTotalPages}
                  onPageChange={setBonusPage}
                  itemsPerPage={itemsPerPage}
                  totalItems={bonusRecords.length}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Promoter Records Tab */}
        <TabsContent value="promoter" className="mt-6">
          <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-t-lg">
              <CardTitle className="text-purple-800 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Promoter Share Records
                <Badge variant="secondary" className="ml-2 bg-purple-200 text-purple-800">
                  {promoterRecords.length} records
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {promoterRecords.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium mb-2">No Promoter Records Found</p>
                  <p className="text-sm">There are no promoter share records to display.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left p-4 font-medium text-gray-700">Symbol</th>
                        <th className="text-left p-4 font-medium text-gray-700">Client</th>
                        <th className="text-left p-4 font-medium text-gray-700">Fund</th>
                        <th className="text-left p-4 font-medium text-gray-700">Quantity</th>
                        <th className="text-left p-4 font-medium text-gray-700">Effective Rate</th>
                        <th className="text-left p-4 font-medium text-gray-700">Total Value</th>
                        <th className="text-left p-4 font-medium text-gray-700">Added Date</th>
                        <th className="text-left p-4 font-medium text-gray-700">Fiscal Year</th>
                        <th className="text-center p-4 font-medium text-gray-700">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedPromoterRecords.map((record, index) => (
                        <tr key={record.promoter_id} className={`border-b hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className="font-semibold text-purple-700">{record.symbol}</span>
                              <span className="text-xs text-gray-500 truncate max-w-32">{record.stock_fulls.full_form}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-900">{record.client_broker_mapping.client_name}</span>
                              <span className="text-xs text-gray-500">{record.client_id}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge variant="outline" className="text-xs">
                              {record.funds.fund_name}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1">
                              <Hash className="w-3 h-3 text-gray-600" />
                              <span className="font-medium">{record.quantity.toLocaleString()}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="font-medium text-gray-900">Rs. {record.effective_rate.toFixed(2)}</span>
                          </td>
                          <td className="p-4">
                            <span className="font-semibold text-purple-700">Rs. {(record.total_value || 0).toFixed(2)}</span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-gray-600" />
                              <span className="text-sm">
                                {record.added_at ? format(new Date(record.added_at), 'dd MMM yyyy') : 'N/A'}
                              </span>
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge variant="secondary" className="text-xs">
                              {record.fiscal_years?.year_label || 'N/A'}
                            </Badge>
                          </td>
                          <td className="p-4 text-center">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="destructive" 
                                  size="sm" 
                                  className="h-8 w-8 p-0"
                                  disabled={deleteLoading === `promoter-${record.promoter_id}`}
                                >
                                  {deleteLoading === `promoter-${record.promoter_id}` ? (
                                    <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3 h-3" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-red-600">Delete Promoter Record</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this promoter record for <strong>{record.symbol}</strong>? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleDeletePromoter(record.promoter_id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {promoterRecords.length > 0 && (
                <Pagination
                  currentPage={promoterPage}
                  totalPages={promoterTotalPages}
                  onPageChange={setPromoterPage}
                  itemsPerPage={itemsPerPage}
                  totalItems={promoterRecords.length}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Right Records Tab */}
        <TabsContent value="right" className="mt-6">
          <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-t-lg">
              <CardTitle className="text-blue-800 flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5" />
                Right Share Records
                <Badge variant="secondary" className="ml-2 bg-blue-200 text-blue-800">
                  {rightRecords.length} records
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {rightRecords.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <ArrowUpRight className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium mb-2">No Right Records Found</p>
                  <p className="text-sm">There are no right share records to display.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left p-4 font-medium text-gray-700">Symbol</th>
                        <th className="text-left p-4 font-medium text-gray-700">Client</th>
                        <th className="text-left p-4 font-medium text-gray-700">Fund</th>
                        <th className="text-left p-4 font-medium text-gray-700">Right Ratio</th>
                        <th className="text-left p-4 font-medium text-gray-700">Quantity</th>
                        <th className="text-left p-4 font-medium text-gray-700">Effective Rate</th>
                        <th className="text-left p-4 font-medium text-gray-700">Total Value</th>
                        <th className="text-left p-4 font-medium text-gray-700">Book Close Date</th>
                        <th className="text-left p-4 font-medium text-gray-700">Fiscal Year</th>
                        <th className="text-center p-4 font-medium text-gray-700">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRightRecords.map((record, index) => (
                        <tr key={record.right_id} className={`border-b hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className="font-semibold text-blue-700">{record.symbol}</span>
                              <span className="text-xs text-gray-500 truncate max-w-32">{record.stock_fulls.full_form}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-900">{record.client_broker_mapping.client_name}</span>
                              <span className="text-xs text-gray-500">{record.client_id}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge variant="outline" className="text-xs">
                              {record.funds.fund_name}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <Badge variant="outline" className="text-blue-700 font-medium">
                              {record.right_ratio}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1">
                              <Hash className="w-3 h-3 text-gray-600" />
                              <span className="font-medium">{record.quantity.toLocaleString()}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="font-medium text-gray-900">Rs. {record.effective_rate.toFixed(2)}</span>
                          </td>
                          <td className="p-4">
                            <span className="font-semibold text-blue-700">Rs. {(record.total_value || 0).toFixed(2)}</span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-gray-600" />
                              <span className="text-sm">{format(new Date(record.bookclose_date), 'dd MMM yyyy')}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge variant="secondary" className="text-xs">
                              {record.fiscal_years?.year_label || 'N/A'}
                            </Badge>
                          </td>
                          <td className="p-4 text-center">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="destructive" 
                                  size="sm" 
                                  className="h-8 w-8 p-0"
                                  disabled={deleteLoading === `right-${record.right_id}`}
                                >
                                  {deleteLoading === `right-${record.right_id}` ? (
                                    <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3 h-3" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-red-600">Delete Right Record</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this right record for <strong>{record.symbol}</strong>? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleDeleteRight(record.right_id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {rightRecords.length > 0 && (
                <Pagination
                  currentPage={rightPage}
                  totalPages={rightTotalPages}
                  onPageChange={setRightPage}
                  itemsPerPage={itemsPerPage}
                  totalItems={rightRecords.length}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cash Records Tab */}
        <TabsContent value="cash" className="mt-6">
          <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-t-lg">
              <CardTitle className="text-orange-800 flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Cash Dividend Records
                <Badge variant="secondary" className="ml-2 bg-orange-200 text-orange-800">
                  {cashRecords.length} records
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {cashRecords.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <DollarSign className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium mb-2">No Cash Records Found</p>
                  <p className="text-sm">There are no cash dividend records to display.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left p-4 font-medium text-gray-700">Symbol</th>
                        <th className="text-left p-4 font-medium text-gray-700">Client</th>
                        <th className="text-left p-4 font-medium text-gray-700">Fund</th>
                        <th className="text-left p-4 font-medium text-gray-700">Amount</th>
                        <th className="text-left p-4 font-medium text-gray-700">Book Close Date</th>
                        <th className="text-left p-4 font-medium text-gray-700">Fiscal Year</th>
                        <th className="text-left p-4 font-medium text-gray-700">Recorded At</th>
                        <th className="text-center p-4 font-medium text-gray-700">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedCashRecords.map((record, index) => (
                        <tr key={record.cash_id} className={`border-b hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className="font-semibold text-orange-700">{record.symbol}</span>
                              <span className="text-xs text-gray-500 truncate max-w-32">{record.stock_fulls.full_form}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-900">{record.client_broker_mapping.client_name}</span>
                              <span className="text-xs text-gray-500">{record.client_id}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge variant="outline" className="text-xs">
                              {record.funds.fund_name}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3 text-orange-600" />
                              <span className="font-semibold text-orange-700">Rs. {record.amount.toFixed(2)}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-gray-600" />
                              <span className="text-sm">{format(new Date(record.bookclose_date), 'dd MMM yyyy')}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge variant="secondary" className="text-xs">
                              {record.fiscal_years?.year_label || 'N/A'}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-gray-600" />
                              <span className="text-sm">
                                {record.recorded_at ? format(new Date(record.recorded_at), 'dd MMM yyyy') : 'N/A'}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="destructive" 
                                  size="sm" 
                                  className="h-8 w-8 p-0"
                                  disabled={deleteLoading === `cash-${record.cash_id}`}
                                >
                                  {deleteLoading === `cash-${record.cash_id}` ? (
                                    <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3 h-3" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-red-600">Delete Cash Record</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this cash dividend record for <strong>{record.symbol}</strong>? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleDeleteCash(record.cash_id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {cashRecords.length > 0 && (
                <Pagination
                  currentPage={cashPage}
                  totalPages={cashTotalPages}
                  onPageChange={setCashPage}
                  itemsPerPage={itemsPerPage}
                  totalItems={cashRecords.length}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* IPO Allotment Records Tab */}
        <TabsContent value="ipo" className="mt-6">
          <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-indigo-100 rounded-t-lg">
              <CardTitle className="text-indigo-800 flex items-center gap-2">
                <Star className="w-5 h-5" />
                IPO Allotment Records
                <Badge variant="secondary" className="ml-2 bg-indigo-200 text-indigo-800">
                  {ipoAllotmentRecords.length} records
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {ipoAllotmentRecords.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Star className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium mb-2">No IPO Allotment Records Found</p>
                  <p className="text-sm">There are no IPO allotment records to display.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left p-4 font-medium text-gray-700">Client</th>
                        <th className="text-left p-4 font-medium text-gray-700">Fund</th>
                        <th className="text-left p-4 font-medium text-gray-700">Quantity</th>
                        <th className="text-left p-4 font-medium text-gray-700">Effective Rate</th>
                        <th className="text-left p-4 font-medium text-gray-700">Total Value</th>
                        <th className="text-left p-4 font-medium text-gray-700">Allotment Date</th>
                        <th className="text-left p-4 font-medium text-gray-700">Fiscal Year</th>
                        <th className="text-center p-4 font-medium text-gray-700">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedIPORecords.map((record, index) => (
                        <tr key={record.allotment_id} className={`border-b hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-900">{record.client_broker_mapping.client_name}</span>
                              <span className="text-xs text-gray-500">{record.client_id}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge variant="outline" className="text-xs">
                              {record.funds.fund_name}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1">
                              <Hash className="w-3 h-3 text-gray-600" />
                              <span className="font-medium">{record.quantity.toLocaleString()}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="font-medium text-gray-900">Rs. {Number(record.effective_rate).toFixed(2)}</span>
                          </td>
                          <td className="p-4">
                            <span className="font-semibold text-indigo-700">Rs. {Number(record.total_value || 0).toFixed(2)}</span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-gray-600" />
                              <span className="text-sm">{format(new Date(record.added_at), 'dd MMM yyyy')}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge variant="secondary" className="text-xs">
                              {record.fiscal_years?.year_label || 'N/A'}
                            </Badge>
                          </td>
                          <td className="p-4 text-center">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="destructive" 
                                  size="sm" 
                                  className="h-8 w-8 p-0"
                                  disabled={deleteLoading === `ipo-${record.allotment_id}`}
                                >
                                  {deleteLoading === `ipo-${record.allotment_id}` ? (
                                    <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3 h-3" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-red-600">Delete IPO Allotment Record</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this IPO allotment record for <strong>{record.client_broker_mapping.client_name}</strong>? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleDeleteIPOAllotment(record.allotment_id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {ipoAllotmentRecords.length > 0 && (
                <Pagination
                  currentPage={ipoPage}
                  totalPages={ipoTotalPages}
                  onPageChange={setIPOPage}
                  itemsPerPage={itemsPerPage}
                  totalItems={ipoAllotmentRecords.length}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Non-DEMAT IPO Staging Records Tab */}
        <TabsContent value="ipo-staging" className="mt-6">
          <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-amber-50 to-amber-100 rounded-t-lg">
              <CardTitle className="text-amber-800 flex items-center gap-2">
                <PackageOpen className="w-5 h-5" />
                Non-DEMAT IPO Allotment (Pending)
                <Badge variant="secondary" className="ml-2 bg-amber-200 text-amber-800">
                  {ipoAllotmentStagingRecords.length} records
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {ipoAllotmentStagingRecords.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <PackageOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium mb-2">No Non-DEMAT IPO Records Found</p>
                  <p className="text-sm">There are no pending IPO allotments awaiting dematerialization.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left p-4 font-medium text-gray-700">Symbol</th>
                        <th className="text-left p-4 font-medium text-gray-700">Fund</th>
                        <th className="text-left p-4 font-medium text-gray-700">Sub Class</th>
                        <th className="text-left p-4 font-medium text-gray-700">Quantity</th>
                        <th className="text-left p-4 font-medium text-gray-700">Effective Rate</th>
                        <th className="text-left p-4 font-medium text-gray-700">Total Value</th>
                        <th className="text-left p-4 font-medium text-gray-700">Allotment Date</th>
                        <th className="text-left p-4 font-medium text-gray-700">Fiscal Year</th>
                        <th className="text-center p-4 font-medium text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedIPOStagingRecords.map((record, index) => (
                        <tr key={record.allotment_staging_id} className={`border-b hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className="font-semibold text-amber-700">{record.stock_fulls.symbol}</span>
                              <span className="text-xs text-gray-500 truncate max-w-32">{record.stock_fulls.full_form}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge variant="outline" className="text-xs">
                              {record.funds.fund_name}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <Badge variant="secondary" className="text-xs">
                              {record.sub_classes?.sub_name || 'N/A'}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1">
                              <Hash className="w-3 h-3 text-gray-600" />
                              <span className="font-medium">{record.quantity.toLocaleString()}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="font-medium text-gray-900">Rs. {Number(record.effective_rate).toFixed(2)}</span>
                          </td>
                          <td className="p-4">
                            <span className="font-semibold text-amber-700">Rs. {Number(record.total_value || 0).toFixed(2)}</span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-gray-600" />
                              <span className="text-sm">{format(new Date(record.added_at), 'dd MMM yyyy')}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge variant="secondary" className="text-xs">
                              {record.fiscal_years?.year_label || 'N/A'}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-center gap-2">
                              <Dialog open={dematerializeDialogOpen && selectedStagingRecord?.allotment_staging_id === record.allotment_staging_id} onOpenChange={(open) => {
                                setDematerializeDialogOpen(open);
                                if (!open) {
                                  setSelectedStagingRecord(null);
                                  setClientIdForDemat('');
                                  setClientTradingForDemat('');
                                }
                              }}>
                                <DialogTrigger asChild>
                                  <Button 
                                    variant="default" 
                                    size="sm" 
                                    className="h-8 bg-green-600 hover:bg-green-700 text-white"
                                    onClick={() => setSelectedStagingRecord(record)}
                                  >
                                    <Users className="w-3 h-3 mr-1" />
                                    Dematerialize
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle className="text-green-700">Dematerialize IPO Allotment</DialogTitle>
                                    <DialogDescription>
                                      Assign this IPO allotment to a specific client. The record will be moved from staging to IPO allotment records.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="grid gap-4 py-4">
                                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
                                      <p className="text-sm font-medium text-amber-800">IPO Details:</p>
                                      <p className="text-xs text-amber-700 mt-1">
                                        <strong>{record.stock_fulls.symbol}</strong> - {record.quantity} shares @ Rs. {Number(record.effective_rate).toFixed(2)}
                                      </p>
                                    </div>
                                    <div className="grid gap-2">
                                      <Label htmlFor="client-id">Select Client</Label>
                                      <Select value={clientIdForDemat} onValueChange={setClientIdForDemat}>
                                        <SelectTrigger className="w-full">
                                          <SelectValue placeholder="Select a client" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {funds.map((client) => (
                                            <SelectItem key={client.client_id} value={client.client_id}>
                                              {client.client_name} ({client.client_id})
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                      <div className="grid gap-2">
                                      <Label htmlFor="client-id">Set as Held For:</Label>
                                      <Select value={clientTradingForDemat} onValueChange={setClientTradingForDemat}>
                                        <SelectTrigger className="w-full">
                                          <SelectValue placeholder="Select a client" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="TRADING">Trading</SelectItem>
                                          <SelectItem value="PROMOTER">Maturity</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                  <DialogFooter>
                                    <Button variant="outline" onClick={() => {
                                      setDematerializeDialogOpen(false);
                                      setSelectedStagingRecord(null);
                                      setClientIdForDemat('');
                                      setClientTradingForDemat('');
                                    }}>Cancel</Button>
                                    <Button 
                                      onClick={handleDematerialize} 
                                      disabled={dematerializeLoading || !clientIdForDemat}
                                      className="bg-green-600 hover:bg-green-700"
                                    >
                                      {dematerializeLoading ? 'Processing...' : 'Dematerialize'}
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                              
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    variant="destructive" 
                                    size="sm" 
                                    className="h-8 w-8 p-0"
                                    disabled={deleteLoading === `ipo-staging-${record.allotment_staging_id}`}
                                  >
                                    {deleteLoading === `ipo-staging-${record.allotment_staging_id}` ? (
                                      <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <Trash2 className="w-3 h-3" />
                                    )}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="text-red-600">Delete Non-DEMAT IPO Record</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete this pending IPO allotment for <strong>{record.stock_fulls.symbol}</strong>? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => handleDeleteIPOStaging(record.allotment_staging_id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {ipoAllotmentStagingRecords.length > 0 && (
                <Pagination
                  currentPage={ipoStagingPage}
                  totalPages={ipoStagingTotalPages}
                  onPageChange={setIPOStagingPage}
                  itemsPerPage={itemsPerPage}
                  totalItems={ipoAllotmentStagingRecords.length}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
