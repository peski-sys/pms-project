"use server"

import { prisma } from "@/lib/db"
import { sanitizeNumeric, calculatePercentage } from '@/lib/apiUtils'
import { getBatchMarketSnapshotLTP } from '@/lib/marketSnapshotUtils'

// Helper function to batch fetch promoter sectors and create a map
// Returns a Map<sector_id, sector_name> for all promoter sectors
async function getPromoterSectorMap(): Promise<Map<number, string>> {
    const promoterSectors = await prisma.sectors.findMany({
        select: {
            sector_id: true,
            sector_name: true
        }
    })

    const sectorMap = new Map<number, string>()
    promoterSectors.forEach(sector => {
        sectorMap.set(sector.sector_id, sector.sector_name)
    })

    return sectorMap
}

// Helper function to get the correct sector name for a stock
// When sector_id = 14, use promoter_sector_id instead
function getCorrectSectorName(
    stockFulls: { sector_id: number; promoter_sector_id: number | null; sectors: { sector_name: string } },
    promoterSectorMap: Map<number, string>
): string {
    // If sector_id is 14 and promoter_sector_id exists and is not 0, use promoter sector
    if (stockFulls.sector_id === 14 && stockFulls.promoter_sector_id && stockFulls.promoter_sector_id !== 0) {
        const promoterSectorName = promoterSectorMap.get(stockFulls.promoter_sector_id);
        if (promoterSectorName) {
            return promoterSectorName;
        }
    }
    
    // Otherwise, use the default sector
    return stockFulls.sectors.sector_name;
}

type AggregatedStagingData = {
    openingQuantity: number
    openingAmount: number
    quantity: number
    amount: number
    demat: number
    nonDemat: number
}

type AggregatedStagingWithSubId = AggregatedStagingData & {
    symbol: string
    subId: number | null
}

function resolveNonDemat(nonDemat: number, quantity: number, demat: number) {
    if (nonDemat > 0) {
        return nonDemat
    }

    const computed = quantity - demat
    if (computed > 0) {
        return computed
    }

    return quantity
}

function aggregateStagingBySymbol(
    records: Array<{ symbol: string; opening_quantity?: unknown; opening_rate?: unknown; closing_quantity: unknown; effective_rate: unknown; demat?: unknown; non_demat?: unknown }>
): Map<string, AggregatedStagingData> {
    const map = new Map<string, AggregatedStagingData>()

    records.forEach(record => {
        if (!record.symbol) return

        const openingQty = sanitizeNumeric((record as any).opening_quantity)
        const openingRate = sanitizeNumeric((record as any).opening_rate)
        const openingAmount = openingQty * openingRate
        const quantity = sanitizeNumeric(record.closing_quantity)
        const rate = sanitizeNumeric(record.effective_rate)
        const demat = sanitizeNumeric((record as any).demat)
        const nonDematRaw = sanitizeNumeric((record as any).non_demat)
        const amount = quantity * rate
        const resolvedNonDemat = resolveNonDemat(nonDematRaw, quantity, demat)

        const existing = map.get(record.symbol)
        if (existing) {
            existing.openingQuantity += openingQty
            existing.openingAmount += openingAmount
            existing.quantity += quantity
            existing.amount += amount
            existing.demat += demat
            existing.nonDemat += resolvedNonDemat
        } else {
            map.set(record.symbol, {
                openingQuantity: openingQty,
                openingAmount,
                quantity,
                amount,
                demat,
                nonDemat: resolvedNonDemat
            })
        }
    })

    return map
}

function aggregateStagingBySymbolAndSubId(
    records: Array<{ symbol: string; sub_id: number | null; opening_quantity?: unknown; opening_rate?: unknown; closing_quantity: unknown; effective_rate: unknown; demat?: unknown; non_demat?: unknown }>
): Map<string, AggregatedStagingWithSubId> {
    const map = new Map<string, AggregatedStagingWithSubId>()

    records.forEach(record => {
        if (!record.symbol) return

        const subId = record.sub_id ?? null
        const key = `${record.symbol}_${subId ?? 'null'}`
        const openingQty = sanitizeNumeric((record as any).opening_quantity)
        const openingRate = sanitizeNumeric((record as any).opening_rate)
        const openingAmount = openingQty * openingRate
        const quantity = sanitizeNumeric(record.closing_quantity)
        const rate = sanitizeNumeric(record.effective_rate)
        const demat = sanitizeNumeric((record as any).demat)
        const nonDematRaw = sanitizeNumeric((record as any).non_demat)
        const amount = quantity * rate
        const resolvedNonDemat = resolveNonDemat(nonDematRaw, quantity, demat)

        const existing = map.get(key)
        if (existing) {
            existing.openingQuantity += openingQty
            existing.openingAmount += openingAmount
            existing.quantity += quantity
            existing.amount += amount
            existing.demat += demat
            existing.nonDemat += resolvedNonDemat
        } else {
            map.set(key, {
                symbol: record.symbol,
                subId,
                openingQuantity: openingQty,
                openingAmount,
                quantity,
                amount,
                demat,
                nonDemat: resolvedNonDemat
            })
        }
    })

    return map
}

type MetricData = {
    // Company Info
    company: string
    code: string
    category: string
    
    // Opening
    opening_quantity: number
    opening_rate: number
    opening_amount: number
    
    // Purchase
    purchase_quantity: number
    purchase_rate: number
    purchase_amount: number
    
    // Right Share
    right_quantity: number
    right_total: number
    
    // Bonus
    bonus_quantity: number
    bonus_book_close_date: string
    
    // Sales
    sales_quantity: number
    sales_cost: number
    sales_amount: number
    sales_profit: number
    
    // Closing
    closing_quantity: number
    closing_rate: number
    closing_amount: number
    
    // DEMAT/NON_DEMAT (for held for trading only)
    demat: number
    non_demat: number
    
    // Market Price (from market_snapshots)
    market_price: number
    
    // Capital Gain/Loss (based on effective_rate)
    unrealised_amount: number
    
    // Return
    today_return_percent: number

    // Remarks
    remarks?: string
    
    // IPO Staging indicator
    isIPOStaging?: boolean
}

// Get comprehensive metric data for held for trading securities using fiscal_year_balance
export async function getMetricDataTradingFiscal(currentFund: string, fiscalID: string): Promise<MetricData[]> {
    const given_fund = currentFund
    const given_fiscal = Number(fiscalID)

    try {
        // Get all symbols from current fiscal year balance (trading securities)
        const fiscalYearBalances = await prisma.fiscal_year_balance.findMany({
            where: {
                fiscal_year_id: given_fiscal,
                client_broker_mapping: {
                    client_name: given_fund
                },
                source_type: "TRADING",
            },
            select: {
                symbol: true,
                opening_quantity: true,
                opening_rate: true,
                closing_quantity: true,
                effective_rate: true,
                demat: true,
                non_demat: true,
                remarks: true,
                stock_fulls: {
                    select: {
                        full_form: true,
                        sector_id: true,
                        promoter_sector_id: true,
                        sectors: {
                            select: {
                                sector_name: true
                            }
                        }
                    }
                }
            }
        })

        const symbols = fiscalYearBalances.map(s => s.symbol)
        if (symbols.length === 0) return []

        // Batch fetch market prices from market_snapshots
        const ltpMap = await getBatchMarketSnapshotLTP(symbols, given_fiscal)

        // Get promoter sector map for efficient sector name lookup
        const promoterSectorMap = await getPromoterSectorMap()

        // DEMAT/NON_DEMAT values are now included in fiscalYearBalances query above

        // Get purchase data from buy_records
        const purchaseData = await prisma.buy_records.groupBy({
            by: ['symbol'],
            where: {
                symbol: { in: symbols },
                fiscal_year_id: given_fiscal,
                client_broker_mapping: {
                    client_name: given_fund
                }
            },
            _sum: {
                quantity: true,
                net_payable: true
            }
        })

        // Get right share data from right_records
        const rightData = await prisma.right_records.groupBy({
            by: ['symbol'],
            where: {
                symbol: { in: symbols },
                fiscal_year_id: given_fiscal,
                client_broker_mapping: {
                    client_name: given_fund
                }
            },
            _sum: {
                quantity: true,
                total_value: true
            }
        })

        // Get bonus data with book close dates from bonus_records
        const bonusData = await prisma.bonus_records.findMany({
            where: {
                symbol: { in: symbols },
                fiscal_year_id: given_fiscal,
                client_broker_mapping: {
                    client_name: given_fund
                }
            },
            select: {
                symbol: true,
                quantity: true,
                bookclose_date: true
            }
        })

        // Get sales data from sell_records
        const salesData = await prisma.sell_records.groupBy({
            by: ['symbol'],
            where: {
                symbol: { in: symbols },
                fiscal_year_id: given_fiscal,
                client_broker_mapping: {
                    client_name: given_fund
                }
            },
            _sum: {
                quantity: true,
                net_receivable: true,
                profit_loss: true
            }
        })

        // Create maps for easy lookup with proper typing
        const purchaseMap = new Map(purchaseData.map(p => [p.symbol, p as any]))
        const rightMap = new Map(rightData.map(r => [r.symbol, r as any]))
        const salesMap = new Map(salesData.map(s => [s.symbol, s as any]))
        
        // Group bonus data by symbol (get latest book close date)
        const bonusMap = new Map<string, { quantity: number, bookCloseDate: string }>()
        bonusData.forEach(bonus => {
            const existing = bonusMap.get(bonus.symbol)
            const quantity = sanitizeNumeric(bonus.quantity)
            const bookCloseDate = bonus.bookclose_date?.toISOString().split('T')[0] || ''
            
            if (!existing) {
                bonusMap.set(bonus.symbol, { quantity, bookCloseDate })
            } else {
                bonusMap.set(bonus.symbol, {
                    quantity: existing.quantity + quantity,
                    bookCloseDate: bookCloseDate > existing.bookCloseDate ? bookCloseDate : existing.bookCloseDate
                })
            }
        })

        // Build comprehensive metric data
        const metricData: MetricData[] = fiscalYearBalances.map(balance => {
            const symbol = balance.symbol
            const purchase = purchaseMap.get(symbol)
            const right = rightMap.get(symbol)
            const bonus = bonusMap.get(symbol)
            const sales = salesMap.get(symbol)
            const marketPrice = ltpMap.get(symbol) || 0
            
            // Opening from fiscal_year_balance.opening_quantity and opening_rate
            const openingQty = sanitizeNumeric(balance.opening_quantity)
            const openingRate = sanitizeNumeric(balance.opening_rate)
            const openingAmount = openingQty * openingRate
            
            // Purchase data
            const purchaseQty = sanitizeNumeric(purchase?._sum.quantity)
            const purchaseAmount = sanitizeNumeric(purchase?._sum.net_payable)
            const purchaseRate = purchaseQty > 0 ? purchaseAmount / purchaseQty : 0
            
            // Right share data
            const rightQty = sanitizeNumeric(right?._sum.quantity)
            const rightTotal = sanitizeNumeric(right?._sum.total_value)
            
            // Bonus data
            const bonusQty = bonus?.quantity || 0
            const bonusBookClose = bonus?.bookCloseDate || ''
            
            // Sales data
            const salesQty = sanitizeNumeric(sales?._sum.quantity)
            const salesAmount = sanitizeNumeric(sales?._sum.net_receivable)
            const salesProfit = sanitizeNumeric(sales?._sum.profit_loss)
            const salesCost = salesAmount - salesProfit // Net receivable - profit = cost
            
            // Closing from fiscal_year_balance.closing_quantity and effective_rate
            const closingQty = sanitizeNumeric(balance.closing_quantity)
            const closingRate = sanitizeNumeric(balance.effective_rate)
            const closingAmount = closingQty * closingRate
            
            // DEMAT/NON_DEMAT values from fiscal_year_balance (fiscal year specific)
            const dematQty = sanitizeNumeric(balance.demat)
            const nonDematQty = sanitizeNumeric(balance.non_demat)
            
            // Calculate unrealized gain/loss based on effective_rate
            const marketValue = closingQty * marketPrice
            const bookValue = closingQty * closingRate // Using effective_rate for book value
            const unrealisedAmount = marketValue - bookValue
            
            // Calculate return percentage
            const todayReturnPercent = bookValue > 0 ? calculatePercentage(unrealisedAmount, bookValue) : 0
            
            return {
                company: balance.stock_fulls.full_form,
                code: symbol,
                category: getCorrectSectorName(balance.stock_fulls, promoterSectorMap),
                
                opening_quantity: openingQty,
                opening_rate: openingRate,
                opening_amount: openingAmount,
                
                purchase_quantity: purchaseQty,
                purchase_rate: purchaseRate,
                purchase_amount: purchaseAmount,
                
                right_quantity: rightQty,
                right_total: rightTotal,

                bonus_quantity: bonusQty,
                bonus_book_close_date: bonusBookClose,
                
                sales_quantity: salesQty,
                sales_cost: salesCost,
                sales_amount: salesAmount,
                sales_profit: salesProfit,
                
                closing_quantity: closingQty,
                closing_rate: closingRate,
                closing_amount: closingAmount,
                
                demat: dematQty,
                non_demat: nonDematQty,
                
                market_price: marketPrice,
                unrealised_amount: unrealisedAmount,
                today_return_percent: todayReturnPercent,
                remarks: balance.remarks || ""
            }
        })

        return metricData
    } catch (error) {
        console.error('Error getting trading metric data:', error)
        return []
    }
}

// Get comprehensive metric data for held for maturity securities (promoter shares with sub_id = 1)
export async function getMetricDataPromoterFiscal(currentFund: string, fiscalID: string): Promise<MetricData[]> {
    const given_fund = currentFund
    const given_fiscal = Number(fiscalID)

    try {
        // Get all fiscal_year_balance records with source_type='PROMOTER' and sub_id=1
        const fiscalYearBalances = await prisma.fiscal_year_balance.findMany({
            where: {
                fiscal_year_id: given_fiscal,
                client_broker_mapping: {
                    client_name: given_fund
                },
                source_type: "PROMOTER",
                sub_id: 1
            },
            select: {
                symbol: true,
                client_id: true,
                opening_quantity: true,
                opening_rate: true,
                closing_quantity: true,
                effective_rate: true,
                demat: true,
                non_demat: true,
                remarks: true,
                stock_fulls: {
                    select: {
                        full_form: true,
                        sector_id: true,
                        promoter_sector_id: true,
                        sectors: {
                            select: {
                                sector_name: true
                            }
                        }
                    }
                }
            }
        })

        // Get fund_id for IPO staging records
        const fundData = await prisma.client_broker_mapping.findFirst({
            where: {
                client_name: given_fund
            },
            select: { fund_id: true }
        })

        // Get staging holdings from fiscal_year_balance_staging with sub_id = 1 (not dematerialized yet)
        const ipoStagingRecords = fundData ? await prisma.fiscal_year_balance_staging.findMany({
            where: {
                fiscal_year_id: given_fiscal,
                fund_id: fundData.fund_id,
                sub_id: 1
            },
            select: {
                symbol: true,
                closing_quantity: true,
                effective_rate: true,
                demat: true,
                non_demat: true
            }
        }) : []

        const ipoAggregated = aggregateStagingBySymbol(ipoStagingRecords)

        // Get stock details for staging records
        const ipoSymbols = Array.from(ipoAggregated.keys())
        const ipoStockDetails = ipoSymbols.length > 0 ? await prisma.stock_fulls.findMany({
            where: {
                symbol: { in: ipoSymbols }
            },
            select: {
                symbol: true,
                full_form: true,
                sector_id: true,
                promoter_sector_id: true,
                sectors: {
                    select: {
                        sector_name: true
                    }
                }
            }
        }) : []

        const ipoStockMap = new Map(ipoStockDetails.map(s => [s.symbol, s]))

        const symbols = [...fiscalYearBalances.map(b => b.symbol), ...ipoSymbols]
        if (symbols.length === 0) return []

        // Batch fetch market prices from market_snapshots
        const ltpMap = await getBatchMarketSnapshotLTP(symbols, given_fiscal)

        // Get promoter sector map for efficient sector name lookup
        const promoterSectorMap = await getPromoterSectorMap()

        // Get purchase data from buy_records (for promoter shares)
        const purchaseData = await prisma.buy_records.groupBy({
            by: ['symbol'],
            where: {
                symbol: { in: fiscalYearBalances.map(b => b.symbol) },
                fiscal_year_id: given_fiscal,
                client_broker_mapping: {
                    client_name: given_fund
                }
            },
            _sum: {
                quantity: true,
                net_payable: true
            }
        })

        // Get right share data from right_records
        const rightData = await prisma.right_records.groupBy({
            by: ['symbol'],
            where: {
                symbol: { in: fiscalYearBalances.map(b => b.symbol) },
                fiscal_year_id: given_fiscal,
                client_broker_mapping: {
                    client_name: given_fund
                }
            },
            _sum: {
                quantity: true,
                total_value: true
            }
        })

        // Get bonus data with book close dates from bonus_records
        const bonusData = await prisma.bonus_records.findMany({
            where: {
                symbol: { in: fiscalYearBalances.map(b => b.symbol) },
                fiscal_year_id: given_fiscal,
                client_broker_mapping: {
                    client_name: given_fund
                }
            },
            select: {
                symbol: true,
                quantity: true,
                bookclose_date: true
            }
        })

        // Get sales data from sell_records
        const salesData = await prisma.sell_records.groupBy({
            by: ['symbol'],
            where: {
                symbol: { in: fiscalYearBalances.map(b => b.symbol) },
                fiscal_year_id: given_fiscal,
                client_broker_mapping: {
                    client_name: given_fund
                }
            },
            _sum: {
                quantity: true,
                net_receivable: true,
                profit_loss: true
            }
        })

        // Create maps for easy lookup
        const purchaseMap = new Map(purchaseData.map(p => [p.symbol, p as any]))
        const rightMap = new Map(rightData.map(r => [r.symbol, r as any]))
        const salesMap = new Map(salesData.map(s => [s.symbol, s as any]))
        
        // Group bonus data by symbol (get latest book close date)
        const bonusMap = new Map<string, { quantity: number, bookCloseDate: string }>()
        bonusData.forEach(bonus => {
            const existing = bonusMap.get(bonus.symbol)
            const quantity = sanitizeNumeric(bonus.quantity)
            const bookCloseDate = bonus.bookclose_date?.toISOString().split('T')[0] || ''
            
            if (!existing) {
                bonusMap.set(bonus.symbol, { quantity, bookCloseDate })
            } else {
                bonusMap.set(bonus.symbol, {
                    quantity: existing.quantity + quantity,
                    bookCloseDate: bookCloseDate > existing.bookCloseDate ? bookCloseDate : existing.bookCloseDate
                })
            }
        })

        // Get opening balances from PREVIOUS fiscal year's IPO staging records
        const currentFiscalYear = await prisma.fiscal_years.findUnique({
            where: { fiscal_year_id: given_fiscal }
        })
        
        let previousFiscalYear = null
        if (currentFiscalYear) {
            previousFiscalYear = await prisma.fiscal_years.findFirst({
                where: {
                    end_date: {
                        lt: currentFiscalYear.start_date
                    }
                },
                orderBy: { end_date: 'desc' }
            })
        }

        const ipoOpeningRecords = (previousFiscalYear && fundData) ? await prisma.fiscal_year_balance_staging.findMany({
            where: {
                fiscal_year_id: previousFiscalYear.fiscal_year_id,
                fund_id: fundData.fund_id,
                sub_id: 1
            },
            select: {
                symbol: true,
                closing_quantity: true,
                effective_rate: true,
                demat: true,
                non_demat: true
            }
        }) : []

        const ipoOpeningMap = aggregateStagingBySymbol(ipoOpeningRecords)

        // Build comprehensive metric data from fiscal_year_balance
        const promoterData: MetricData[] = fiscalYearBalances.map(balance => {
            const symbol = balance.symbol
            const purchase = purchaseMap.get(symbol)
            const right = rightMap.get(symbol)
            const bonus = bonusMap.get(symbol)
            const sales = salesMap.get(symbol)
            const marketPrice = ltpMap.get(symbol) || 0
            
            // Opening from fiscal_year_balance
            const openingQty = sanitizeNumeric(balance.opening_quantity)
            const openingRate = sanitizeNumeric(balance.opening_rate)
            const openingAmount = openingQty * openingRate
            
            // Purchase data
            const purchaseQty = sanitizeNumeric(purchase?._sum.quantity)
            const purchaseAmount = sanitizeNumeric(purchase?._sum.net_payable)
            const purchaseRate = purchaseQty > 0 ? purchaseAmount / purchaseQty : 0
            
            // Right share data
            const rightQty = sanitizeNumeric(right?._sum.quantity)
            const rightTotal = sanitizeNumeric(right?._sum.total_value)
            
            // Bonus data
            const bonusQty = bonus?.quantity || 0
            const bonusBookClose = bonus?.bookCloseDate || ''
            
            // Sales data
            const salesQty = sanitizeNumeric(sales?._sum.quantity)
            const salesAmount = sanitizeNumeric(sales?._sum.net_receivable)
            const salesProfit = sanitizeNumeric(sales?._sum.profit_loss)
            const salesCost = salesAmount - salesProfit
            
            // Closing from fiscal_year_balance
            const closingQty = sanitizeNumeric(balance.closing_quantity)
            const closingRate = sanitizeNumeric(balance.effective_rate)
            const closingAmount = closingQty * closingRate
            
            // DEMAT/NON_DEMAT values from fiscal_year_balance
            const dematQty = sanitizeNumeric(balance.demat)
            const nonDematQty = sanitizeNumeric(balance.non_demat)
            
            // Calculate unrealized gain/loss based on effective_rate
            const marketValue = closingQty * marketPrice
            const bookValue = closingQty * closingRate
            const unrealisedAmount = marketValue - bookValue
            
            // Calculate return percentage
            const todayReturnPercent = bookValue > 0 ? calculatePercentage(unrealisedAmount, bookValue) : 0
            
            return {
                company: balance.stock_fulls.full_form,
                code: symbol,
                category: getCorrectSectorName(balance.stock_fulls, promoterSectorMap),
                
                opening_quantity: openingQty,
                opening_rate: openingRate,
                opening_amount: openingAmount,
                
                purchase_quantity: purchaseQty,
                purchase_rate: purchaseRate,
                purchase_amount: purchaseAmount,
                
                right_quantity: rightQty,
                right_total: rightTotal,

                bonus_quantity: bonusQty,
                bonus_book_close_date: bonusBookClose,
                
                sales_quantity: salesQty,
                sales_cost: salesCost,
                sales_amount: salesAmount,
                sales_profit: salesProfit,
                
                closing_quantity: closingQty,
                closing_rate: closingRate,
                closing_amount: closingAmount,
                
                demat: dematQty,
                non_demat: nonDematQty,
                
                market_price: marketPrice,
                unrealised_amount: unrealisedAmount,
                today_return_percent: todayReturnPercent,
                remarks: balance.remarks || "",
                isIPOStaging: false
            }
        })

        // Process IPO staging records (sub_id = 1)
        const ipoData: MetricData[] = Array.from(ipoAggregated.entries()).map(([symbol, data]) => {
            const stockDetail = ipoStockMap.get(symbol)
            const marketPriceFromLTP = ltpMap.get(symbol) || 0
            const previousOpening = ipoOpeningMap.get(symbol)

            const currentOpeningQty = sanitizeNumeric(data.openingQuantity)
            const currentOpeningAmount = sanitizeNumeric(data.openingAmount)
            const hasCurrentOpening = currentOpeningQty > 0

            const fallbackOpeningQty = previousOpening ? sanitizeNumeric(previousOpening.openingQuantity ?? previousOpening.quantity) : 0
            const fallbackOpeningAmount = previousOpening ? sanitizeNumeric(previousOpening.openingAmount ?? previousOpening.amount) : 0

            const openingQty = hasCurrentOpening ? currentOpeningQty : fallbackOpeningQty
            const openingAmount = hasCurrentOpening ? currentOpeningAmount : fallbackOpeningAmount
            const openingRate = openingQty > 0 ? openingAmount / openingQty : 0

            // Closing data from current staging records
            const closingQty = data.quantity
            const closingAmount = data.amount
            const closingRate = closingQty > 0 ? closingAmount / closingQty : 0
            
            // Use closing rate as market price if market value is zero (no LTP available)
            const marketPrice = marketPriceFromLTP > 0 ? marketPriceFromLTP : closingRate
            
            // Calculate unrealized gain/loss
            const marketValue = closingQty * marketPrice
            const bookValue = closingQty * closingRate
            const unrealisedAmount = marketValue - bookValue
            
            // Calculate return percentage
            const todayReturnPercent = bookValue > 0 ? calculatePercentage(unrealisedAmount, bookValue) : 0
            
            // DEMAT / NON-DEMAT from staging data (defaults to all non-demat)
            const dematQty = data.demat
            const nonDematQty = data.nonDemat > 0 ? data.nonDemat : closingQty
            
            return {
                company: stockDetail?.full_form || symbol,
                code: symbol,
                category: stockDetail ? getCorrectSectorName(stockDetail, promoterSectorMap) : 'Unknown',
                
                opening_quantity: openingQty,
                opening_rate: openingRate,
                opening_amount: openingAmount,
                
                // No purchase/right/bonus/sales data for IPO staging
                purchase_quantity: 0,
                purchase_rate: 0,
                purchase_amount: 0,
                
                right_quantity: 0,
                right_total: 0,
                
                bonus_quantity: 0,
                bonus_book_close_date: '',
                
                sales_quantity: 0,
                sales_cost: 0,
                sales_amount: 0,
                sales_profit: 0,
                
                closing_quantity: closingQty,
                closing_rate: closingRate,
                closing_amount: closingAmount,
                
                demat: dematQty,
                non_demat: nonDematQty,
                
                market_price: marketPrice,
                unrealised_amount: unrealisedAmount,
                today_return_percent: todayReturnPercent,
                remarks: '',
                isIPOStaging: true
            }
        })

        // Combine fiscal_year_balance and IPO staging data
        return [...promoterData, ...ipoData]
    } catch (error) {
        console.error('Error getting promoter metric data:', error)
        return []
    }
}

// Get available sub classes for a specific fund (excluding sub_id = 1)
export async function getSubClassesForFund(currentFund: string, fiscalID: string) {
    const given_fund = currentFund
    const given_fiscal = Number(fiscalID)

    try {
        // Get fund ID first
        const fundData = await prisma.funds.findFirst({
            where: { 
                client_broker_mapping: {
                    some: {
                        client_name: given_fund
                    }
                }
            },
            select: { fund_id: true }
        })

        if (!fundData) return []

        // Get ALL sub_classes for this fund (excluding sub_id = 1)
        // Return all sub_classes regardless of whether they have data
        const allSubClasses = await prisma.sub_classes.findMany({
            where: {
                fund_id: fundData.fund_id,
                sub_id: { not: 1 }
            },
            select: {
                sub_id: true,
                sub_name: true
            },
            orderBy: {
                sub_name: 'asc'
            }
        })

        return allSubClasses
    } catch (error) {
        console.error('Error getting sub classes for fund:', error)
        return []
    }
}

// Get comprehensive metric data for a specific sub class (sub_id != 1)
export async function getMetricDataSubClassFiscal(currentFund: string, fiscalID: string, subClassId: number): Promise<MetricData[]> {
    const given_fund = currentFund
    const given_fiscal = Number(fiscalID)

    try {
        // Get records from fiscal_year_balance with source_type='PROMOTER' and specific sub_id
        const fiscalYearBalances = await prisma.fiscal_year_balance.findMany({
            where: {
                fiscal_year_id: given_fiscal,
                client_broker_mapping: {
                    client_name: given_fund
                },
                source_type: "PROMOTER",
                sub_id: subClassId
            },
            select: {
                symbol: true,
                client_id: true,
                opening_quantity: true,
                opening_rate: true,
                closing_quantity: true,
                effective_rate: true,
                demat: true,
                non_demat: true,
                remarks: true,
                stock_fulls: {
                    select: {
                        full_form: true,
                        sector_id: true,
                        promoter_sector_id: true,
                        sectors: {
                            select: {
                                sector_name: true
                            }
                        }
                    }
                }
            }
        })

        // Get fund_id for IPO staging records
        const fundData = await prisma.client_broker_mapping.findFirst({
            where: {
                client_name: given_fund
            },
            select: { fund_id: true }
        })

        // Get IPO allotment staging records with specific sub_id (not dematerialized yet)
        const ipoStagingRecords = fundData ? await prisma.fiscal_year_balance_staging.findMany({
            where: {
                fiscal_year_id: given_fiscal,
                fund_id: fundData.fund_id,
                sub_id: subClassId
            },
            select: {
                symbol: true,
                closing_quantity: true,
                effective_rate: true,
                demat: true,
                non_demat: true
            }
        }) : []

        const ipoAggregated = aggregateStagingBySymbol(ipoStagingRecords)

        // Get stock details for staging records
        const ipoSymbols = Array.from(ipoAggregated.keys())
        const ipoStockDetails = ipoSymbols.length > 0 ? await prisma.stock_fulls.findMany({
            where: {
                symbol: { in: ipoSymbols }
            },
            select: {
                symbol: true,
                full_form: true,
                sector_id: true,
                promoter_sector_id: true,
                sectors: {
                    select: {
                        sector_name: true
                    }
                }
            }
        }) : []

        const ipoStockMap = new Map(ipoStockDetails.map(s => [s.symbol, s]))

        // Combine symbols from fiscal_year_balance and IPO staging
        const symbols = [...fiscalYearBalances.map(b => b.symbol), ...ipoSymbols]

        // Batch fetch market prices from market_snapshots
        const ltpMap = await getBatchMarketSnapshotLTP(symbols, given_fiscal)

        // Get promoter sector map for efficient sector name lookup
        const promoterSectorMap = await getPromoterSectorMap()

        // Get purchase data from buy_records
        const purchaseData = await prisma.buy_records.groupBy({
            by: ['symbol'],
            where: {
                symbol: { in: fiscalYearBalances.map(b => b.symbol) },
                fiscal_year_id: given_fiscal,
                client_broker_mapping: {
                    client_name: given_fund
                }
            },
            _sum: {
                quantity: true,
                net_payable: true
            }
        })

        // Get right share data from right_records
        const rightData = await prisma.right_records.groupBy({
            by: ['symbol'],
            where: {
                symbol: { in: fiscalYearBalances.map(b => b.symbol) },
                fiscal_year_id: given_fiscal,
                client_broker_mapping: {
                    client_name: given_fund
                }
            },
            _sum: {
                quantity: true,
                total_value: true
            }
        })

        // Get bonus data with book close dates from bonus_records
        const bonusData = await prisma.bonus_records.findMany({
            where: {
                symbol: { in: fiscalYearBalances.map(b => b.symbol) },
                fiscal_year_id: given_fiscal,
                client_broker_mapping: {
                    client_name: given_fund
                }
            },
            select: {
                symbol: true,
                quantity: true,
                bookclose_date: true
            }
        })

        // Get sales data from sell_records
        const salesData = await prisma.sell_records.groupBy({
            by: ['symbol'],
            where: {
                symbol: { in: fiscalYearBalances.map(b => b.symbol) },
                fiscal_year_id: given_fiscal,
                client_broker_mapping: {
                    client_name: given_fund
                }
            },
            _sum: {
                quantity: true,
                net_receivable: true,
                profit_loss: true
            }
        })

        // Create maps for easy lookup
        const purchaseMap = new Map(purchaseData.map(p => [p.symbol, p as any]))
        const rightMap = new Map(rightData.map(r => [r.symbol, r as any]))
        const salesMap = new Map(salesData.map(s => [s.symbol, s as any]))
        
        // Group bonus data by symbol (get latest book close date)
        const bonusMap = new Map<string, { quantity: number, bookCloseDate: string }>()
        bonusData.forEach(bonus => {
            const existing = bonusMap.get(bonus.symbol)
            const quantity = sanitizeNumeric(bonus.quantity)
            const bookCloseDate = bonus.bookclose_date?.toISOString().split('T')[0] || ''
            
            if (!existing) {
                bonusMap.set(bonus.symbol, { quantity, bookCloseDate })
            } else {
                bonusMap.set(bonus.symbol, {
                    quantity: existing.quantity + quantity,
                    bookCloseDate: bookCloseDate > existing.bookCloseDate ? bookCloseDate : existing.bookCloseDate
                })
            }
        })

        // Get opening balances from PREVIOUS fiscal year's IPO staging records
        const currentFiscalYear = await prisma.fiscal_years.findUnique({
            where: { fiscal_year_id: given_fiscal }
        })
        
        let previousFiscalYear = null
        if (currentFiscalYear) {
            previousFiscalYear = await prisma.fiscal_years.findFirst({
                where: {
                    end_date: {
                        lt: currentFiscalYear.start_date
                    }
                },
                orderBy: { end_date: 'desc' }
            })
        }

        const ipoOpeningRecords = (previousFiscalYear && fundData) ? await prisma.fiscal_year_balance_staging.findMany({
            where: {
                fiscal_year_id: previousFiscalYear.fiscal_year_id,
                fund_id: fundData.fund_id,
                sub_id: subClassId
            },
            select: {
                symbol: true,
                closing_quantity: true,
                effective_rate: true,
                demat: true,
                non_demat: true
            }
        }) : []

        const ipoOpeningMap = aggregateStagingBySymbol(ipoOpeningRecords)

        // Build comprehensive metric data from fiscal_year_balance
        const subClassData: MetricData[] = fiscalYearBalances.map(balance => {
            const symbol = balance.symbol
            const purchase = purchaseMap.get(symbol)
            const right = rightMap.get(symbol)
            const bonus = bonusMap.get(symbol)
            const sales = salesMap.get(symbol)
            const marketPrice = ltpMap.get(symbol) || 0
            
            // Opening from fiscal_year_balance
            const openingQty = sanitizeNumeric(balance.opening_quantity)
            const openingRate = sanitizeNumeric(balance.opening_rate)
            const openingAmount = openingQty * openingRate
            
            // Purchase data
            const purchaseQty = sanitizeNumeric(purchase?._sum.quantity)
            const purchaseAmount = sanitizeNumeric(purchase?._sum.net_payable)
            const purchaseRate = purchaseQty > 0 ? purchaseAmount / purchaseQty : 0
            
            // Right share data
            const rightQty = sanitizeNumeric(right?._sum.quantity)
            const rightTotal = sanitizeNumeric(right?._sum.total_value)
            
            // Bonus data
            const bonusQty = bonus?.quantity || 0
            const bonusBookClose = bonus?.bookCloseDate || ''
            
            // Sales data
            const salesQty = sanitizeNumeric(sales?._sum.quantity)
            const salesAmount = sanitizeNumeric(sales?._sum.net_receivable)
            const salesProfit = sanitizeNumeric(sales?._sum.profit_loss)
            const salesCost = salesAmount - salesProfit
            
            // Closing from fiscal_year_balance
            const closingQty = sanitizeNumeric(balance.closing_quantity)
            const closingRate = sanitizeNumeric(balance.effective_rate)
            const closingAmount = closingQty * closingRate
            
            // DEMAT/NON_DEMAT values from fiscal_year_balance
            const dematQty = sanitizeNumeric(balance.demat)
            const nonDematQty = sanitizeNumeric(balance.non_demat)
            
            // Calculate unrealized gain/loss based on effective_rate
            const marketValue = closingQty * marketPrice
            const bookValue = closingQty * closingRate
            const unrealisedAmount = marketValue - bookValue
            
            // Calculate return percentage
            const todayReturnPercent = bookValue > 0 ? calculatePercentage(unrealisedAmount, bookValue) : 0
            
            return {
                company: balance.stock_fulls.full_form,
                code: symbol,
                category: getCorrectSectorName(balance.stock_fulls, promoterSectorMap),
                
                opening_quantity: openingQty,
                opening_rate: openingRate,
                opening_amount: openingAmount,
                
                purchase_quantity: purchaseQty,
                purchase_rate: purchaseRate,
                purchase_amount: purchaseAmount,
                
                right_quantity: rightQty,
                right_total: rightTotal,

                bonus_quantity: bonusQty,
                bonus_book_close_date: bonusBookClose,
                
                sales_quantity: salesQty,
                sales_cost: salesCost,
                sales_amount: salesAmount,
                sales_profit: salesProfit,
                
                closing_quantity: closingQty,
                closing_rate: closingRate,
                closing_amount: closingAmount,
                
                demat: dematQty,
                non_demat: nonDematQty,
                
                market_price: marketPrice,
                unrealised_amount: unrealisedAmount,
                today_return_percent: todayReturnPercent,
                remarks: balance.remarks || "",
                isIPOStaging: false
            }
        })

        // Process IPO staging records (specific sub_id)
        const ipoData: MetricData[] = Array.from(ipoAggregated.entries()).map(([symbol, data]) => {
            const stockDetail = ipoStockMap.get(symbol)
            const marketPriceFromLTP = ltpMap.get(symbol) || 0
            const opening = ipoOpeningMap.get(symbol)
            
            // Opening data from previous year's staging records (if exists)
            const openingQty = opening?.quantity || 0
            const openingAmount = opening?.amount || 0
            const openingRate = openingQty > 0 ? openingAmount / openingQty : 0
            
            // Closing data from current staging records
            const closingQty = data.quantity
            const closingAmount = data.amount
            const closingRate = closingQty > 0 ? closingAmount / closingQty : 0
            
            // Use closing rate as market price if market value is zero (no LTP available)
            const marketPrice = marketPriceFromLTP > 0 ? marketPriceFromLTP : closingRate
            
            // Calculate unrealized gain/loss
            const marketValue = closingQty * marketPrice
            const bookValue = closingQty * closingRate
            const unrealisedAmount = marketValue - bookValue
            
            // Calculate return percentage
            const todayReturnPercent = bookValue > 0 ? calculatePercentage(unrealisedAmount, bookValue) : 0

            // DEMAT / NON-DEMAT from staging data (defaults to all non-demat)
            const dematQty = data.demat
            const nonDematQty = data.nonDemat > 0 ? data.nonDemat : closingQty
            
            return {
                company: stockDetail?.full_form || symbol,
                code: symbol,
                category: stockDetail ? getCorrectSectorName(stockDetail, promoterSectorMap) : 'Unknown',
                
                opening_quantity: openingQty,
                opening_rate: openingRate,
                opening_amount: openingAmount,
                
                // No purchase/right/bonus/sales data for IPO staging
                purchase_quantity: 0,
                purchase_rate: 0,
                purchase_amount: 0,
                
                right_quantity: 0,
                right_total: 0,
                
                bonus_quantity: 0,
                bonus_book_close_date: '',
                
                sales_quantity: 0,
                sales_cost: 0,
                sales_amount: 0,
                sales_profit: 0,
                
                closing_quantity: closingQty,
                closing_rate: closingRate,
                closing_amount: closingAmount,
                
                demat: dematQty,
                non_demat: nonDematQty,
                
                market_price: marketPrice,
                unrealised_amount: unrealisedAmount,
                today_return_percent: todayReturnPercent,
                remarks: '',
                isIPOStaging: true
            }
        })

        // Combine fiscal_year_balance and IPO staging data
        return [...subClassData, ...ipoData]
    } catch (error) {
        console.error('Error getting sub class metric data:', error)
        return []
    }
}

// Get comprehensive metric data for Non-DEMAT IPO allotments (staging) with sub_id != 1
export async function getMetricDataIPOStagingOtherFiscal(currentFund: string, fiscalID: string): Promise<MetricData[]> {
    const given_fund = currentFund
    const given_fiscal = Number(fiscalID)

    try {
        // Get fund_id first
        const fundData = await prisma.client_broker_mapping.findFirst({
            where: {
                client_name: given_fund
            },
            select: { fund_id: true }
        })

        if (!fundData) return []

        // Get all IPO staging holdings for the fiscal year with sub_id != 1, grouped by symbol and sub_id
        const ipoStagingRecords = await prisma.fiscal_year_balance_staging.findMany({
            where: {
                fiscal_year_id: given_fiscal,
                fund_id: fundData.fund_id,
                sub_id: { not: 1 }
            },
            select: {
                symbol: true,
                sub_id: true,
                closing_quantity: true,
                effective_rate: true,
                demat: true,
                non_demat: true
            }
        })

        const ipoAggregated = aggregateStagingBySymbolAndSubId(ipoStagingRecords)

        if (ipoAggregated.size === 0) return []

        const symbols = Array.from(new Set(Array.from(ipoAggregated.values()).map(h => h.symbol)))

        // Get stock details
        const stockDetails = await prisma.stock_fulls.findMany({
            where: {
                symbol: { in: symbols }
            },
            select: {
                symbol: true,
                full_form: true,
                sectors: {
                    select: {
                        sector_name: true
                    }
                }
            }
        })

        const stockMap = new Map(stockDetails.map(s => [s.symbol, s]))

        // Get previous fiscal year for opening balances
        const currentFiscalYear = await prisma.fiscal_years.findUnique({
            where: { fiscal_year_id: given_fiscal }
        })
        
        let previousFiscalYear = null
        if (currentFiscalYear) {
            previousFiscalYear = await prisma.fiscal_years.findFirst({
                where: {
                    end_date: {
                        lt: currentFiscalYear.start_date
                    }
                },
                orderBy: { end_date: 'desc' }
            })
        }

        // Get opening balances from PREVIOUS fiscal year's IPO staging records with sub_id != 1
        const openingRecords = (previousFiscalYear && fundData) ? await prisma.fiscal_year_balance_staging.findMany({
            where: {
                fiscal_year_id: previousFiscalYear.fiscal_year_id,
                fund_id: fundData.fund_id,
                sub_id: { not: 1 }
            },
            select: {
                symbol: true,
                sub_id: true,
                closing_quantity: true,
                effective_rate: true,
                demat: true,
                non_demat: true
            }
        }) : []

        // Create map for opening balances
        const openingMap = aggregateStagingBySymbolAndSubId(openingRecords)

        // Batch fetch market prices from market_snapshots
        const ltpMap = await getBatchMarketSnapshotLTP(symbols, given_fiscal)

        // Build metric data for IPO staging records
        const metricData: MetricData[] = Array.from(ipoAggregated.values()).map(holding => {
            const symbol = holding.symbol
            const sub_id = holding.subId
            const key = `${symbol}_${sub_id ?? 'null'}`
            const stockDetail = stockMap.get(symbol)
            const marketPriceFromLTP = ltpMap.get(symbol) || 0
            const opening = openingMap.get(key)
            
            // Opening data from previous year (if exists)
            const openingQty = opening?.quantity || 0
            const openingAmount = opening?.amount || 0
            const openingRate = openingQty > 0 ? openingAmount / openingQty : 0
            
            // Closing data from current staging records
            const closingQty = holding.quantity
            const closingAmount = holding.amount
            const closingRate = closingQty > 0 ? closingAmount / closingQty : 0
            
            // Use closing rate as market price if market value is zero (no LTP available)
            const marketPrice = marketPriceFromLTP > 0 ? marketPriceFromLTP : closingRate
            
            // Calculate unrealized gain/loss
            const marketValue = closingQty * marketPrice
            const bookValue = closingQty * closingRate
            const unrealisedAmount = marketValue - bookValue
            
            // Calculate return percentage
            const todayReturnPercent = bookValue > 0 ? calculatePercentage(unrealisedAmount, bookValue) : 0
            
            // DEMAT / NON-DEMAT from staging data (defaults to all non-demat)
            const dematQty = holding.demat
            const nonDematQty = holding.nonDemat > 0 ? holding.nonDemat : closingQty
            
            return {
                company: stockDetail?.full_form || symbol,
                code: symbol,
                category: stockDetail?.sectors.sector_name || 'Unknown',
                
                // Opening data from previous year (if available)
                opening_quantity: openingQty,
                opening_rate: openingRate,
                opening_amount: openingAmount,
                
                // No purchase/right/bonus/sales data for IPO staging
                purchase_quantity: 0,
                purchase_rate: 0,
                purchase_amount: 0,
                
                right_quantity: 0,
                right_total: 0,
                
                bonus_quantity: 0,
                bonus_book_close_date: '',
                
                sales_quantity: 0,
                sales_cost: 0,
                sales_amount: 0,
                sales_profit: 0,
                
                closing_quantity: closingQty,
                closing_rate: closingRate,
                closing_amount: closingAmount,
                
                demat: dematQty,
                non_demat: nonDematQty,
                
                market_price: marketPrice,
                unrealised_amount: unrealisedAmount,
                today_return_percent: todayReturnPercent,
                remarks: '', // No remarks in staging table
                isIPOStaging: true // Mark as IPO staging record
            }
        })

        return metricData
    } catch (error) {
        console.error('Error getting IPO staging other metric data:', error)
        return []
    }
}
