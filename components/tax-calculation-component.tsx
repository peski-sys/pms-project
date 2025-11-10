"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { getUsers } from "@/app/api/dashboardAPICalls/actions"
import { getFiscal } from "@/app/api/fiscalAPI/actions"
import { getTaxBaseCalculationData, TaxBaseCalculationResponse, TaxBaseCalculationRow } from "@/app/api/taxCalculationsAPICalls/actions"
import { Pagination } from "@/components/ui/pagination"
import { SortAsc, SortDesc } from "lucide-react"
import { cn } from "@/lib/utils"

type ClientMapping = {
  client_id: string
  client_name: string
  client_broker: number
  recorded_at: Date | null
}

type FiscalYear = {
  fiscal_year_id: number
  year_label: string
  start_date: Date
  end_date: Date
}

type SectionConfig = {
  key: keyof TaxBaseCalculationResponse
  title: string
  description: string
}

const NUMBER_FORMAT = new Intl.NumberFormat("en-NP", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const QUANTITY_FORMAT = new Intl.NumberFormat("en-NP", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const formatCurrency = (value: number) => `Rs. ${NUMBER_FORMAT.format(value ?? 0)}`
const formatQuantity = (value: number) => QUANTITY_FORMAT.format(value ?? 0)

const TAX_BASE_SECTIONS: SectionConfig[] = [
  {
    key: "trading",
    title: "Trading Securities",
    description: "Held for Trading Securities",
  },
  {
    key: "promoterPrimary",
    title: "Promoter Shares",
    description: "Held till Maturity",
  },
  {
    key: "promoterOther",
    title: "Promoter Shares (Other Sub Classes)",
    description: "Sub Groups",
  },
]

const ITEMS_PER_PAGE = 15

const ITEMS_PER_PAGE_OPTIONS = [5, 10, 15, 20, 25, 50]

type SectionState = {
  page: number
}

const useSectionState = (keys: SectionConfig[]) => {
  const initialState = useMemo(() => {
    const entries = keys.map((section) => [section.key, { page: 1 }])
    return Object.fromEntries(entries) as Record<SectionConfig["key"], SectionState>
  }, [keys])

  const [state, setState] = useState(initialState)

  const setPage = useCallback(
    (key: SectionConfig["key"], page: number) => {
      setState((prev) => ({
        ...prev,
        [key]: { page },
      }))
    },
    []
  )

  const resetAll = useCallback(() => {
    setState(initialState)
  }, [initialState])

  return { state, setPage, resetAll }
}

export default function TaxCalculationComponent() {
  const [clients, setClients] = useState<ClientMapping[]>([])
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([])
  const [selectedClient, setSelectedClient] = useState<string>("")
  const [selectedFiscalId, setSelectedFiscalId] = useState<string>("")
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [data, setData] = useState<TaxBaseCalculationResponse | null>(null)
  const { state: sectionState, setPage, resetAll } = useSectionState(TAX_BASE_SECTIONS)
  const [itemsPerPage, setItemsPerPage] = useState<number>(ITEMS_PER_PAGE)
  const [sortConfig, setSortConfig] = useState<Record<SectionConfig["key"], { field: keyof TaxBaseCalculationRow | null; order: "asc" | "desc" }>>(() => {
    return TAX_BASE_SECTIONS.reduce((acc, section) => {
      acc[section.key] = { field: null, order: "asc" }
      return acc
    }, {} as Record<SectionConfig["key"], { field: keyof TaxBaseCalculationRow | null; order: "asc" | "desc" }>)
  })

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setIsLoading(true)
        const [clientList, fiscalList] = await Promise.all([getUsers(), getFiscal()])
        setClients(clientList)
        setFiscalYears(fiscalList)

        const defaultClient = clientList[0]?.client_name ?? ""
        const today = new Date()
        const defaultFiscal =
          fiscalList.find((fy) => {
            const start = new Date(fy.start_date)
            const end = new Date(fy.end_date)
            return today >= start && today <= end
          })?.fiscal_year_id.toString() ?? fiscalList[0]?.fiscal_year_id.toString() ?? ""

        setSelectedClient(defaultClient)
        setSelectedFiscalId(defaultFiscal)

        if (defaultClient && defaultFiscal) {
          const result = await getTaxBaseCalculationData(defaultClient, defaultFiscal)
          setData(result)
        }
      } catch (error) {
        console.error("Failed to boot tax calculation component", error)
      } finally {
        setIsLoading(false)
      }
    }

    bootstrap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    resetAll()
  }, [itemsPerPage, resetAll])

  const handleApplyFilters = useCallback(async () => {
    if (!selectedClient || !selectedFiscalId) return
    try {
      setIsRefreshing(true)
      const result = await getTaxBaseCalculationData(selectedClient, selectedFiscalId)
      setData(result)
      resetAll()
    } catch (error) {
      console.error("Failed to fetch tax base calculation data", error)
    } finally {
      setIsRefreshing(false)
    }
  }, [selectedClient, selectedFiscalId, resetAll])

  const handleSort = useCallback(
    (sectionKey: SectionConfig["key"], field: keyof TaxBaseCalculationRow) => {
      setSortConfig((prev) => {
        const current = prev[sectionKey]
        const isSameField = current.field === field
        const nextOrder = isSameField && current.order === "asc" ? "desc" : "asc"
        return {
          ...prev,
          [sectionKey]: {
            field,
            order: nextOrder,
          },
        }
      })
      setPage(sectionKey, 1)
    },
    [setPage]
  )

  const renderSortIndicator = (sectionKey: SectionConfig["key"], field: keyof TaxBaseCalculationRow) => {
    const config = sortConfig[sectionKey]
    if (config.field !== field) {
      return <span className="text-gray-400 text-xs">⇅</span>
    }
    return config.order === "asc" ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
  }

  const getSortedRows = useCallback(
    (sectionKey: SectionConfig["key"], rows: TaxBaseCalculationRow[]) => {
      const config = sortConfig[sectionKey]
      if (!config?.field) return rows

      const sorted = [...rows]
      sorted.sort((a, b) => {
        const aValue = a[config.field!]
        const bValue = b[config.field!]

        if (aValue == null && bValue == null) return 0
        if (aValue == null) return config.order === "asc" ? 1 : -1
        if (bValue == null) return config.order === "asc" ? -1 : 1

        if (typeof aValue === "number" && typeof bValue === "number") {
          return config.order === "asc" ? aValue - bValue : bValue - aValue
        }

        if (typeof aValue === "string" && typeof bValue === "string") {
          return config.order === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
        }

        return 0
      })
      return sorted
    },
    [sortConfig]
  )

  const renderSectionTable = (section: SectionConfig, rows: TaxBaseCalculationRow[]) => {
    const sectionTotals = data?.[section.key]?.totals
    const currentPage = sectionState[section.key]?.page ?? 1
    const sortedRows = getSortedRows(section.key, rows)
    const totalPages = Math.ceil(sortedRows.length / itemsPerPage) || 1
    const startIndex = (currentPage - 1) * itemsPerPage
    const pageRows = sortedRows.slice(startIndex, startIndex + itemsPerPage)

    const otherClassNames =
      section.key === "promoterOther"
        ? Array.from(
            new Set(
              rows
                .map((row) => row.subName)
                .filter((name): name is string => Boolean(name && name.trim()))
            )
          )
        : []

    return (
      <Card key={section.key} className="bg-white shadow-sm border border-gray-200">
        <CardHeader className="space-y-1">
          <CardTitle>
            {section.title}
            {otherClassNames.length > 0 ? ` (${otherClassNames.join(", ")})` : ""}
          </CardTitle>
          <CardDescription>{section.description}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[1200px]">
              <TableHeader>
                <TableRow>
                  <TableHead
                    rowSpan={2}
                    className="text-center align-middle cursor-pointer"
                    onClick={() => handleSort(section.key, "symbol")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Symbol
                      {renderSortIndicator(section.key, "symbol")}
                    </div>
                  </TableHead>
                  <TableHead
                    rowSpan={2}
                    className="text-center align-middle cursor-pointer"
                    onClick={() => handleSort(section.key, "company")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Company
                      {renderSortIndicator(section.key, "company")}
                    </div>
                  </TableHead>
                  <TableHead
                    rowSpan={2}
                    className="text-center align-middle cursor-pointer"
                    onClick={() => handleSort(section.key, "subId")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Sub Class
                      {renderSortIndicator(section.key, "subId")}
                    </div>
                  </TableHead>
                  <TableHead
                    rowSpan={2}
                    className="text-center align-middle cursor-pointer"
                    onClick={() => handleSort(section.key, "openingQuantity")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Opening Qty
                      {renderSortIndicator(section.key, "openingQuantity")}
                    </div>
                  </TableHead>
                  <TableHead
                    rowSpan={2}
                    className="text-center align-middle cursor-pointer"
                    onClick={() => handleSort(section.key, "openingBalance")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Opening Balance
                      {renderSortIndicator(section.key, "openingBalance")}
                    </div>
                  </TableHead>
                  <TableHead colSpan={4} className="text-center align-middle">This Fiscal Year Costs</TableHead>
                  <TableHead
                    rowSpan={2}
                    className="text-center align-middle cursor-pointer"
                    onClick={() => handleSort(section.key, "salesThisYear")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Sales This Year
                      {renderSortIndicator(section.key, "salesThisYear")}
                    </div>
                  </TableHead>
                  <TableHead
                    rowSpan={2}
                    className="text-center align-middle cursor-pointer"
                    onClick={() => handleSort(section.key, "realisedGainLoss")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Realised G/L
                      {renderSortIndicator(section.key, "realisedGainLoss")}
                    </div>
                  </TableHead>
                  <TableHead
                    rowSpan={2}
                    className="text-center align-middle cursor-pointer"
                    onClick={() => handleSort(section.key, "closingValue")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Closing Value
                      {renderSortIndicator(section.key, "closingValue")}
                    </div>
                  </TableHead>
                  <TableHead
                    rowSpan={2}
                    className="text-center align-middle cursor-pointer"
                    onClick={() => handleSort(section.key, "closingQuantity")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Closing Qty
                      {renderSortIndicator(section.key, "closingQuantity")}
                    </div>
                  </TableHead>
                  <TableHead colSpan={4} className="text-center align-middle">WACC Breakdown</TableHead>
                </TableRow>
                <TableRow>
                  <TableHead
                    className="text-center cursor-pointer"
                    onClick={() => handleSort(section.key, "purchaseThisYear")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Purchase
                      {renderSortIndicator(section.key, "purchaseThisYear")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-center cursor-pointer"
                    onClick={() => handleSort(section.key, "bonusCost")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Bonus Cost
                      {renderSortIndicator(section.key, "bonusCost")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-center cursor-pointer"
                    onClick={() => handleSort(section.key, "rightCost")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Right Cost
                      {renderSortIndicator(section.key, "rightCost")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-center cursor-pointer"
                    onClick={() => handleSort(section.key, "totalPurchaseCost")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Total Purchase Cost
                      {renderSortIndicator(section.key, "totalPurchaseCost")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-center cursor-pointer"
                    onClick={() => handleSort(section.key, "waccTaxBase")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Tax Base
                      {renderSortIndicator(section.key, "waccTaxBase")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-center cursor-pointer"
                    onClick={() => handleSort(section.key, "waccBooksBase")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Books Base
                      {renderSortIndicator(section.key, "waccBooksBase")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-center cursor-pointer"
                    onClick={() => handleSort(section.key, "waccMarketPrice")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Market Price
                      {renderSortIndicator(section.key, "waccMarketPrice")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-center cursor-pointer"
                    onClick={() => handleSort(section.key, "waccActualGLCost")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Actual G/L Cost
                      {renderSortIndicator(section.key, "waccActualGLCost")}
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                      No records available.
                    </TableCell>
                  </TableRow>
                ) : (
                  pageRows.map((row, index) => (
                    <TableRow
                      key={`${row.symbol}-${index}`}
                      className={cn(
                        row.isIPOStaging ? "bg-amber-50 hover:bg-amber-100" : "",
                        "transition-colors"
                      )}
                    >
                      <TableCell className="font-medium">{row.symbol}</TableCell>
                      <TableCell>{row.company}</TableCell>
                      <TableCell>
                        {row.subId ?? "-"}
                        {row.subName ? (
                          <span className="ml-2 text-xs text-slate-500">{row.subName}</span>
                        ) : null}
                      </TableCell>
                      <TableCell>{formatQuantity(row.openingQuantity)}</TableCell>
                      <TableCell>{formatCurrency(row.openingBalance)}</TableCell>
                      <TableCell>{formatCurrency(row.purchaseThisYear)}</TableCell>
                      <TableCell>{formatCurrency(row.bonusCost)}</TableCell>
                      <TableCell>{formatCurrency(row.rightCost)}</TableCell>
                      <TableCell>{formatCurrency(row.totalPurchaseCost)}</TableCell>
                      <TableCell>{formatCurrency(row.salesThisYear)}</TableCell>
                      <TableCell>{formatCurrency(row.realisedGainLoss)}</TableCell>
                      <TableCell>{formatCurrency(row.closingValue)}</TableCell>
                      <TableCell>{formatQuantity(row.closingQuantity)}</TableCell>
                      <TableCell>{formatCurrency(row.waccTaxBase)}</TableCell>
                      <TableCell>{formatCurrency(row.waccBooksBase)}</TableCell>
                      <TableCell>{formatCurrency(row.waccMarketPrice)}</TableCell>
                      <TableCell>{formatCurrency(row.waccActualGLCost)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {sectionTotals && (
                <TableFooter>
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={3} className="font-semibold text-right">Totals</TableCell>
                    <TableCell className="font-semibold">{formatQuantity(sectionTotals.openingQuantity)}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(sectionTotals.openingBalance)}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(sectionTotals.purchaseThisYear)}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(sectionTotals.bonusCost)}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(sectionTotals.rightCost)}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(sectionTotals.totalPurchaseCost)}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(sectionTotals.salesThisYear)}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(sectionTotals.realisedGainLoss)}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(sectionTotals.closingValue)}</TableCell>
                    <TableCell className="font-semibold">{formatQuantity(sectionTotals.closingQuantity)}</TableCell>
                    <TableCell colSpan={4}></TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>

          {rows.length > 0 && (
            <div className="flex flex-col gap-3 px-6 py-4 border-t bg-white">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Items per page:</span>
                  <Select
                    value={itemsPerPage.toString()}
                    onValueChange={(value) => setItemsPerPage(parseInt(value))}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option.toString()}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {sortedRows.length > itemsPerPage && (
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={(page) => setPage(section.key, page)}
                    itemsPerPage={itemsPerPage}
                    totalItems={sortedRows.length}
                  />
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const isDisabled = isLoading || !selectedClient || !selectedFiscalId

  return (
    <div className="space-y-6">
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardHeader>
          <CardTitle>Tax Base Calculation</CardTitle>
          <CardDescription>
            Review tax base and market comparisons across trading, promoter, and IPO staging holdings.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[repeat(3,minmax(0,1fr))]">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Fund</p>
            <Select value={selectedClient} onValueChange={setSelectedClient} disabled={isLoading}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Select fund" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.client_id} value={client.client_name}>
                    {client.client_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Fiscal Year</p>
            <Select value={selectedFiscalId} onValueChange={setSelectedFiscalId} disabled={isLoading}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Select fiscal year" />
              </SelectTrigger>
              <SelectContent>
                {fiscalYears.map((fiscal) => (
                  <SelectItem key={fiscal.fiscal_year_id} value={fiscal.fiscal_year_id.toString()}>
                    {fiscal.year_label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button onClick={handleApplyFilters} disabled={isDisabled || isRefreshing} className="w-full">
              {isRefreshing ? (
                <span className="inline-flex items-center gap-2">
                  <RefreshCw className="size-4 animate-spin" />
                  Refreshing
                </span>
              ) : (
                "Apply Filters"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <RefreshCw className="size-6 animate-spin" />
          <span className="ml-3 text-sm">Loading tax base data...</span>
        </div>
      ) : !data ? (
        <Card className="bg-white shadow-sm border border-gray-200">
          <CardContent className="py-16 text-center text-muted-foreground">
            Unable to load tax base calculation data. Please try again later.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {TAX_BASE_SECTIONS.map((section) =>
            renderSectionTable(section, data?.[section.key]?.rows ?? [])
          )}
        </div>
      )}
    </div>
  )
}

