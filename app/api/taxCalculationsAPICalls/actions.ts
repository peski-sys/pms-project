"use server"

import { prisma } from "@/lib/db"
import { sanitizeNumeric } from "@/lib/apiUtils"
import { getBatchMarketSnapshotLTP } from "@/lib/marketSnapshotUtils"

type TaxBaseSourceType = "TRADING" | "PROMOTER"

export type TaxBaseCalculationRow = {
  symbol: string
  company: string
  sourceType: TaxBaseSourceType
  subId?: number | null
  subName?: string | null
  remarks?: string | null
  isIPOStaging?: boolean
  openingQuantity: number
  openingBalance: number
  closingQuantity: number
  purchaseThisYear: number
  bonusCost: number
  rightCost: number
  totalPurchaseCost: number
  salesThisYear: number
  realisedGainLoss: number
  closingValue: number
  waccTaxBase: number
  waccBooksBase: number
  waccMarketPrice: number
  waccActualGLCost: number
}

export type TaxBaseSectionTotals = {
  openingQuantity: number
  openingBalance: number
  purchaseThisYear: number
  bonusCost: number
  rightCost: number
  totalPurchaseCost: number
  salesThisYear: number
  realisedGainLoss: number
  closingValue: number
  closingQuantity: number
}

export type TaxBaseSectionResponse = {
  rows: TaxBaseCalculationRow[]
  totals: TaxBaseSectionTotals
}

export type TaxBaseCalculationResponse = {
  trading: TaxBaseSectionResponse
  promoterPrimary: TaxBaseSectionResponse
  promoterOther: TaxBaseSectionResponse
}

const EMPTY_TOTALS: TaxBaseSectionTotals = {
  openingQuantity: 0,
  openingBalance: 0,
  purchaseThisYear: 0,
  bonusCost: 0,
  rightCost: 0,
  totalPurchaseCost: 0,
  salesThisYear: 0,
  realisedGainLoss: 0,
  closingValue: 0,
  closingQuantity: 0,
}

const accumulateTotals = (totals: TaxBaseSectionTotals, row: TaxBaseCalculationRow) => {
  totals.openingQuantity += row.openingQuantity
  totals.openingBalance += row.openingBalance
  totals.purchaseThisYear += row.purchaseThisYear
  totals.bonusCost += row.bonusCost
  totals.rightCost += row.rightCost
  totals.totalPurchaseCost += row.totalPurchaseCost
  totals.salesThisYear += row.salesThisYear
  totals.realisedGainLoss += row.realisedGainLoss
  totals.closingValue += row.closingValue
  totals.closingQuantity += row.closingQuantity
}

const cloneTotals = () => ({ ...EMPTY_TOTALS })

const buildBonusCostMap = (records: { symbol: string; quantity: number; effective_rate: any }[]) => {
  const bonusMap = new Map<string, number>()
  records.forEach((record) => {
    const quantity = sanitizeNumeric(record.quantity)
    const effectiveRate = sanitizeNumeric(record.effective_rate)
    const cost = quantity * effectiveRate
    bonusMap.set(record.symbol, (bonusMap.get(record.symbol) ?? 0) + cost)
  })
  return bonusMap
}

const buildSymbolHoldingMap = (records: { symbol: string; wacc_tax_base: any }[]) => {
  const map = new Map<string, number>()
  records.forEach((record) => {
    map.set(record.symbol, sanitizeNumeric(record.wacc_tax_base))
  })
  return map
}

const buildSymbolHoldingDataMap = (records: { symbol: string; quantity: any; wacc_tax_base: any }[]) => {
  const map = new Map<string, { quantity: number; wacc_tax_base: number }>()
  records.forEach((record) => {
    map.set(record.symbol, {
      quantity: sanitizeNumeric(record.quantity),
      wacc_tax_base: sanitizeNumeric(record.wacc_tax_base)
    })
  })
  return map
}

const consolidateRows = (rows: TaxBaseCalculationRow[]): TaxBaseCalculationRow[] => {
  const consolidated = new Map<
    string,
    {
      row: TaxBaseCalculationRow
      remarks: Set<string>
      weightSum: number
      waccTaxBaseWeighted: number
      waccBooksBaseWeighted: number
      waccMarketPriceWeighted: number
    }
  >()

  rows.forEach((row) => {
    const key = `${row.symbol}__${row.subId ?? "null"}`
    const weightBase = row.closingValue || row.totalPurchaseCost || row.purchaseThisYear || 1

    if (!consolidated.has(key)) {
      consolidated.set(key, {
        row: { ...row },
        remarks: new Set(row.remarks ? [row.remarks] : []),
        weightSum: weightBase,
        waccTaxBaseWeighted: row.waccTaxBase * weightBase,
        waccBooksBaseWeighted: row.waccBooksBase * weightBase,
        waccMarketPriceWeighted: row.waccMarketPrice * weightBase,
      })
    } else {
      const entry = consolidated.get(key)!
      entry.row.openingQuantity += row.openingQuantity
      entry.row.openingBalance += row.openingBalance
      entry.row.purchaseThisYear += row.purchaseThisYear
      entry.row.bonusCost += row.bonusCost
      entry.row.rightCost += row.rightCost
      entry.row.totalPurchaseCost += row.totalPurchaseCost
      entry.row.salesThisYear += row.salesThisYear
      entry.row.realisedGainLoss += row.realisedGainLoss
      entry.row.closingValue += row.closingValue
      entry.row.closingQuantity += row.closingQuantity
      entry.row.isIPOStaging = entry.row.isIPOStaging || row.isIPOStaging

      if (row.remarks) {
        entry.remarks.add(row.remarks)
      }

      entry.weightSum += weightBase
      entry.waccTaxBaseWeighted += row.waccTaxBase * weightBase
      entry.waccBooksBaseWeighted += row.waccBooksBase * weightBase
      entry.waccMarketPriceWeighted += row.waccMarketPrice * weightBase
    }
  })

  return Array.from(consolidated.values()).map(({ row, remarks, weightSum, waccTaxBaseWeighted, waccBooksBaseWeighted, waccMarketPriceWeighted }) => {
    if (remarks.size > 0) {
      row.remarks = Array.from(remarks).join("; ")
    }

    if (weightSum > 0) {
      row.waccTaxBase = waccTaxBaseWeighted / weightSum
      row.waccBooksBase = waccBooksBaseWeighted / weightSum
      row.waccMarketPrice = waccMarketPriceWeighted / weightSum
      row.waccActualGLCost = row.waccMarketPrice - row.waccTaxBase
    }

    return row
  })
}

type FiscalBalanceSectionOptions = {
  fiscalYearId: number
  fundId: number
  clientName: string
  sourceType: "TRADING" | "PROMOTER"
  whereExtra?: Record<string, unknown>
}

type AdditionalHolding = {
  symbol: string
  company: string
  subId?: number | null
  subName?: string | null
  remarks?: string | null
  effectiveRate: number
  quantity: number
  totalValue?: number
  isIPOStaging?: boolean
  openingQuantity?: number
  closingQuantity?: number
  openingBalance?: number
  purchaseThisYear?: number
  bonusCost?: number
  rightCost?: number
  totalPurchaseCost?: number
  salesThisYear?: number
  realisedGainLoss?: number
  closingValueOverride?: number
}

const buildFiscalBalanceSection = async ({
  fiscalYearId,
  fundId,
  clientName,
  sourceType,
  whereExtra = {},
  additionalHoldings = [],
}: FiscalBalanceSectionOptions & { additionalHoldings?: AdditionalHolding[] }): Promise<TaxBaseSectionResponse> => {
  const balances = await prisma.fiscal_year_balance.findMany({
    where: {
      fiscal_year_id: fiscalYearId,
      source_type: sourceType,
      client_broker_mapping: {
        client_name: clientName,
      },
      ...whereExtra,
    },
    select: {
      symbol: true,
      opening_quantity: true,
      opening_rate: true,
      closing_quantity: true,
      effective_rate: true,
      remarks: true,
      sub_id: true,
      stock_fulls: {
        select: {
          full_form: true,
        },
      },
      sub_classes: {
        select: {
          sub_name: true,
        },
      },
    },
    orderBy: {
      symbol: "asc",
    },
  })

  if (balances.length === 0 && additionalHoldings.length === 0) {
    return {
      rows: [],
      totals: cloneTotals(),
    }
  }

  const balanceSymbols = balances.map((balance) => balance.symbol)
  const additionalSymbols = additionalHoldings.map((holding) => holding.symbol)
  const symbols = Array.from(new Set([...balanceSymbols, ...additionalSymbols]))

  // Build purchase data queries based on source type
  const purchaseQueries = []
  
  // Always include buy_records for all source types
  purchaseQueries.push(
    prisma.buy_records.groupBy({
      by: ["symbol"],
      where: {
        symbol: { in: symbols },
        fiscal_year_id: fiscalYearId,
        client_broker_mapping: { client_name: clientName },
      },
      _sum: { net_payable: true },
    })
  )
  
  // For PROMOTER source types, also include promoter_records and ipo_allotment_records
  if (sourceType === "PROMOTER") {
    purchaseQueries.push(
      prisma.promoter_records.groupBy({
        by: ["symbol"],
        where: {
          symbol: { in: symbols },
          fiscal_year_id: fiscalYearId,
          client_broker_mapping: { client_name: clientName },
          ...whereExtra,
        },
        _sum: { total_value: true },
      }),
      prisma.ipo_allotment_records.groupBy({
        by: ["symbol"],
        where: {
          symbol: { in: symbols },
          fiscal_year_id: fiscalYearId,
          client_broker_mapping: { client_name: clientName },
          ...whereExtra,
        },
        _sum: { total_value: true },
      })
    )
  }

  const allQueries = [
    ...purchaseQueries,
    prisma.right_records.groupBy({
      by: ["symbol"],
      where: {
        symbol: {
          in: symbols,
        },
        fiscal_year_id: fiscalYearId,
        client_broker_mapping: {
          client_name: clientName,
        },
      },
      _sum: {
        total_value: true,
      },
    }),
    prisma.sell_records.groupBy({
      by: ["symbol"],
      where: {
        symbol: {
          in: symbols,
        },
        fiscal_year_id: fiscalYearId,
        client_broker_mapping: {
          client_name: clientName,
        },
      },
      _sum: {
        net_receivable: true,
        approx_profit_loss: true,
      },
    }),
    prisma.bonus_records.findMany({
      where: {
        symbol: {
          in: symbols,
        },
        fiscal_year_id: fiscalYearId,
        client_broker_mapping: {
          client_name: clientName,
        },
      },
      select: {
        symbol: true,
        quantity: true,
        effective_rate: true,
      },
    }),
    getBatchMarketSnapshotLTP(symbols, fiscalYearId),
    prisma.symbol_holdings.findMany({
      where: {
        symbol: {
          in: symbols,
        },
        fund_id: fundId,
        fiscal_year_id: fiscalYearId,
      },
      select: {
        symbol: true,
        quantity: true,
        wacc_tax_base: true,
      },
    }),
  ]

  const results = await Promise.all(allQueries)
  
  // Extract results based on query count
  const buyRecordsData = results[0] as { symbol: string; _sum: { net_payable: number | null } }[]
  const rightData = results[purchaseQueries.length] as { symbol: string; _sum: { total_value: number | null } }[]
  const salesData = results[purchaseQueries.length + 1] as { symbol: string; _sum: { net_receivable: number | null; approx_profit_loss: number | null } }[]
  const bonusRecords = results[purchaseQueries.length + 2] as { symbol: string; quantity: number; effective_rate: any }[]
  const ltpMap = results[purchaseQueries.length + 3] as Map<string, number>
  const symbolHoldings = results[purchaseQueries.length + 4] as { symbol: string; quantity: any; wacc_tax_base: any }[]
  
  // Extract promoter data if available
  const promoterData = sourceType === "PROMOTER" && purchaseQueries.length > 1 
    ? [results[1], results[2]] 
    : []

  // Combine purchase data from all sources
  const combinedPurchaseMap = new Map<string, number>()
  
  // Add buy_records data
  const buyRecords = buyRecordsData as { symbol: string; _sum: { net_payable: number | null } }[]
  buyRecords.forEach(record => {
    const amount = sanitizeNumeric(record._sum.net_payable)
    combinedPurchaseMap.set(record.symbol, (combinedPurchaseMap.get(record.symbol) ?? 0) + amount)
  })
  
  // Add promoter_records and ipo_allotment_records data if available
  if (sourceType === "PROMOTER" && promoterData.length >= 2) {
    const [promoterRecords, ipoRecords] = promoterData as [
      { symbol: string; _sum: { total_value: number | null } }[],
      { symbol: string; _sum: { total_value: number | null } }[]
    ]
    
    promoterRecords.forEach(record => {
      const amount = sanitizeNumeric(record._sum.total_value)
      combinedPurchaseMap.set(record.symbol, (combinedPurchaseMap.get(record.symbol) ?? 0) + amount)
    })
    
    ipoRecords.forEach(record => {
      const amount = sanitizeNumeric(record._sum.total_value)
      combinedPurchaseMap.set(record.symbol, (combinedPurchaseMap.get(record.symbol) ?? 0) + amount)
    })
  }

  const rightMap = new Map(rightData.map((item) => [item.symbol, item]))
  const salesMap = new Map(salesData.map((item) => [item.symbol, item]))
  const bonusCostMap = buildBonusCostMap(bonusRecords)
  const symbolHoldingMap = buildSymbolHoldingMap(symbolHoldings)
  const symbolHoldingDataMap = buildSymbolHoldingDataMap(symbolHoldings)

  const rows: TaxBaseCalculationRow[] = balances.map((balance) => {
    const symbol = balance.symbol

    const openingQty = sanitizeNumeric(balance.opening_quantity)
    const openingRate = sanitizeNumeric(balance.opening_rate)
    const openingBalance = openingQty * openingRate

    const purchaseThisYear = combinedPurchaseMap.get(symbol) ?? 0

    const right = rightMap.get(symbol)
    const rightCost = sanitizeNumeric(right?._sum.total_value)

    const bonusCost = bonusCostMap.get(symbol) ?? 0

    const sales = salesMap.get(symbol)
    const salesThisYear = sanitizeNumeric(sales?._sum.net_receivable)
    const realisedGainLoss = sanitizeNumeric(sales?._sum.approx_profit_loss)

    const symbolHoldingData = symbolHoldingDataMap.get(symbol)
    const closingQty = symbolHoldingData?.quantity ?? sanitizeNumeric(balance.closing_quantity)
    const booksBase = sanitizeNumeric(balance.effective_rate)
    const closingValue = symbolHoldingData ? (symbolHoldingData.quantity * symbolHoldingData.wacc_tax_base) : (closingQty * booksBase)

    const totalPurchaseCost = purchaseThisYear + bonusCost + rightCost

    const waccTaxBase = symbolHoldingMap.get(symbol) ?? 0
    const marketPrice = ltpMap.get(symbol) ?? 0
    const waccActualGLCost = marketPrice - waccTaxBase

    return {
      symbol,
      company: balance.stock_fulls.full_form,
      sourceType,
      subId: balance.sub_id,
      subName: balance.sub_classes?.sub_name ?? null,
      remarks: balance.remarks,
      openingQuantity: openingQty,
      openingBalance,
      closingQuantity: closingQty,
      purchaseThisYear,
      bonusCost,
      rightCost,
      totalPurchaseCost,
      salesThisYear,
      realisedGainLoss,
      closingValue,
      waccTaxBase,
      waccBooksBase: booksBase,
      waccMarketPrice: marketPrice,
      waccActualGLCost,
    }
  })

  additionalHoldings.forEach((holding) => {
    const symbol = holding.symbol
    const booksBase = sanitizeNumeric(holding.effectiveRate)
    const baseQuantity = sanitizeNumeric(holding.quantity)
    const openingQuantity = sanitizeNumeric(holding.openingQuantity ?? 0)
    const closingQuantity = sanitizeNumeric(holding.closingQuantity ?? baseQuantity)
    const purchaseThisYear = sanitizeNumeric(holding.purchaseThisYear ?? 0)
    const bonusCost = sanitizeNumeric(holding.bonusCost ?? 0)
    const rightCost = sanitizeNumeric(holding.rightCost ?? 0)
    const salesThisYear = sanitizeNumeric(holding.salesThisYear ?? 0)
    const realisedGainLoss = sanitizeNumeric(holding.realisedGainLoss ?? 0)
    const openingBalance =
      holding.openingBalance != null ? sanitizeNumeric(holding.openingBalance) : openingQuantity * booksBase
    const explicitTotalValue =
      holding.closingValueOverride != null
        ? sanitizeNumeric(holding.closingValueOverride)
        : holding.totalValue != null
        ? sanitizeNumeric(holding.totalValue)
        : undefined
    const symbolHoldingData = symbolHoldingDataMap.get(symbol)
    const closingValue = explicitTotalValue ?? (symbolHoldingData ? (symbolHoldingData.quantity * symbolHoldingData.wacc_tax_base) : (closingQuantity * booksBase))
    const totalPurchaseCost = sanitizeNumeric(
      holding.totalPurchaseCost ?? purchaseThisYear + bonusCost + rightCost
    )
    const marketPrice = ltpMap.get(symbol) ?? 0
    const waccTaxBase = symbolHoldingMap.get(symbol) ?? 0
    const waccActualGLCost = marketPrice - waccTaxBase

    rows.push({
      symbol,
      company: holding.company,
      sourceType,
      subId: holding.subId,
      subName: holding.subName,
      remarks: holding.remarks,
      isIPOStaging: holding.isIPOStaging,
      openingQuantity,
      openingBalance,
      closingQuantity,
      purchaseThisYear,
      bonusCost,
      rightCost,
      totalPurchaseCost,
      salesThisYear,
      realisedGainLoss,
      closingValue,
      waccTaxBase,
      waccBooksBase: booksBase,
      waccMarketPrice: marketPrice,
      waccActualGLCost,
    })
  })

  const consolidatedRows = consolidateRows(rows)
  const totals = consolidatedRows.reduce((acc, row) => {
    accumulateTotals(acc, row)
    return acc
  }, cloneTotals())

  return {
    rows: consolidatedRows,
    totals,
  }
}

export async function getTaxBaseCalculationData(
  currentFund: string,
  fiscalYearId: string
): Promise<TaxBaseCalculationResponse> {
  const trimmedFund = currentFund.trim()
  const numericFiscalYear = Number(fiscalYearId)

  if (!trimmedFund || !numericFiscalYear) {
    return {
      trading: { rows: [], totals: cloneTotals() },
      promoterPrimary: { rows: [], totals: cloneTotals() },
      promoterOther: { rows: [], totals: cloneTotals() },
    }
  }

  const fundMapping = await prisma.client_broker_mapping.findFirst({
    where: {
      client_name: trimmedFund,
    },
    select: {
      fund_id: true,
    },
  })

  if (!fundMapping) {
    return {
      trading: { rows: [], totals: cloneTotals() },
      promoterPrimary: { rows: [], totals: cloneTotals() },
      promoterOther: { rows: [], totals: cloneTotals() },
    }
  }

  const fundId = fundMapping.fund_id

  const stagingRecords = await prisma.fiscal_year_balance_staging.findMany({
    where: {
      fiscal_year_id: numericFiscalYear,
      fund_id: fundId,
      source_type: "PROMOTER",
      non_demat: {
        gt: 0,
      },
    },
    select: {
      staging_id: true,
      symbol: true,
      effective_rate: true,
      closing_quantity: true,
      non_demat: true,
      remarks: true,
      sub_id: true,
      opening_quantity: true,
      opening_rate: true,
      added_quantity: true,
    },
  })

  const stagingSymbols = Array.from(new Set(stagingRecords.map((record) => record.symbol)))
  const stagingSubIds = Array.from(
    new Set(
      stagingRecords
        .map((record) => record.sub_id)
        .filter((value): value is number => typeof value === "number")
    )
  )

  const [stagingStockInfo, stagingSubClassInfo] = await Promise.all([
    stagingSymbols.length
      ? prisma.stock_fulls.findMany({
          where: {
            symbol: {
              in: stagingSymbols,
            },
          },
          select: {
            symbol: true,
            full_form: true,
          },
        })
      : Promise.resolve([]),
    stagingSubIds.length
      ? prisma.sub_classes.findMany({
          where: {
            sub_id: {
              in: stagingSubIds,
            },
          },
          select: {
            sub_id: true,
            sub_name: true,
          },
        })
      : Promise.resolve([]),
  ])

  const stagingStockMap = new Map(stagingStockInfo.map((item) => [item.symbol, item.full_form]))
  const stagingSubClassMap = new Map(stagingSubClassInfo.map((item) => [item.sub_id, item.sub_name]))

  const stagingHoldings = stagingRecords.map<AdditionalHolding>((record) => {
    const effectiveRate = sanitizeNumeric(record.effective_rate)
    const openingQuantity = sanitizeNumeric(record.opening_quantity)
    const openingRate = sanitizeNumeric(record.opening_rate)
    const addedQuantity = sanitizeNumeric(record.added_quantity)
    const closingQuantityRaw = sanitizeNumeric(record.closing_quantity)
    const nonDematQuantity = record.non_demat != null ? sanitizeNumeric(record.non_demat) : undefined
    const derivedQuantity = nonDematQuantity ?? closingQuantityRaw
    const openingBalance = openingQuantity * (openingRate || effectiveRate)
    const purchaseThisYear = addedQuantity * effectiveRate
    const closingValue = derivedQuantity * effectiveRate

    let parsedRemarks: string | null = record.remarks ?? null
    if (parsedRemarks) {
      try {
        const remarkJson = JSON.parse(parsedRemarks)
        if (remarkJson && typeof remarkJson.note === "string") {
          parsedRemarks = remarkJson.note
        }
      } catch (error) {
        // leave parsedRemarks as-is if not JSON
      }
    }

    return {
      symbol: record.symbol,
      company: stagingStockMap.get(record.symbol) ?? record.symbol,
      subId: record.sub_id,
      subName: record.sub_id != null ? stagingSubClassMap.get(record.sub_id) ?? null : null,
      remarks: parsedRemarks,
      effectiveRate,
      quantity: derivedQuantity,
      totalValue: closingValue,
      isIPOStaging: true,
      openingQuantity,
      closingQuantity: derivedQuantity,
      openingBalance,
      purchaseThisYear,
      bonusCost: 0,
      rightCost: 0,
      totalPurchaseCost: purchaseThisYear,
      salesThisYear: 0,
      realisedGainLoss: 0,
      closingValueOverride: closingValue,
    }
  })

  const [trading, promoterPrimary, promoterOther] = await Promise.all([
    buildFiscalBalanceSection({
      fiscalYearId: numericFiscalYear,
      fundId,
      clientName: trimmedFund,
      sourceType: "TRADING",
    }),
    buildFiscalBalanceSection({
      fiscalYearId: numericFiscalYear,
      fundId,
      clientName: trimmedFund,
      sourceType: "PROMOTER",
      whereExtra: {
        sub_id: 1,
      },
      additionalHoldings: stagingHoldings.filter((holding) => holding.subId === 1),
    }),
    buildFiscalBalanceSection({
      fiscalYearId: numericFiscalYear,
      fundId,
      clientName: trimmedFund,
      sourceType: "PROMOTER",
      whereExtra: {
        sub_id: {
          not: 1,
        },
      },
      additionalHoldings: stagingHoldings.filter((holding) => holding.subId !== 1),
    }),
  ])

  return {
    trading,
    promoterPrimary,
    promoterOther,
  }
}

