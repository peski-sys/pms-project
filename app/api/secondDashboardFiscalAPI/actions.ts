"use server"

import { prisma } from "@/lib/db"
import { sanitizeNumeric, calculatePercentage } from '@/lib/apiUtils'
import { getBatchMarketSnapshotLTP } from '@/lib/marketSnapshotUtils'

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
                category: balance.stock_fulls.sectors.sector_name,
                
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

// Get comprehensive metric data for held for maturity securities (promoter shares)
export async function getMetricDataPromoterFiscal(currentFund: string, fiscalID: string): Promise<MetricData[]> {
    const given_fund = currentFund
    const given_fiscal = Number(fiscalID)

    try {
        // Get all promoter holdings for the fiscal year with sub_id = 1
        const promoterHoldings = await prisma.promoter_records.findMany({
            where: {
                fiscal_year_id: given_fiscal,
                sub_id: 1, // Only show sub_id = 1 for default promoter shares
                client_broker_mapping: {
                    client_name: given_fund
                }
            },
            select: {
                symbol: true,
                quantity: true,
                effective_rate: true,
                total_value: true,
                added_at: true,
                remarks: true,
                client_id: true, // Add client_id to get fiscal year balance data
                stock_fulls: {
                    select: {
                        full_form: true,
                        sectors: {
                            select: {
                                sector_name: true
                            }
                        }
                    }
                }
            }
        })

        const symbols = promoterHoldings.map(p => p.symbol)
        if (symbols.length === 0) return []

        // Get DEMAT/Non-DEMAT data from fiscal_year_balance for promoter records
        const fiscalBalanceData = await prisma.fiscal_year_balance.findMany({
            where: {
                fiscal_year_id: given_fiscal,
                symbol: { in: symbols },
                client_broker_mapping: {
                    client_name: given_fund
                },
                source_type: "MATURITY" // Promoter records typically use MATURITY source type
            },
            select: {
                symbol: true,
                client_id: true,
                demat: true,
                non_demat: true
            }
        })

        // Get the previous fiscal year for opening balances
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

        // Get opening balances from PREVIOUS fiscal year's promoter records
        const openingBalances = previousFiscalYear ? await prisma.promoter_records.findMany({
            where: {
                symbol: { in: symbols },
                fiscal_year_id: previousFiscalYear.fiscal_year_id,
                sub_id: 1, // Only get opening balances from sub_id = 1
                client_broker_mapping: {
                    client_name: given_fund
                }
            },
            select: {
                symbol: true,
                quantity: true,
                effective_rate: true,
                total_value: true
            }
        }) : []

        // Batch fetch market prices from market_snapshots
        const ltpMap = await getBatchMarketSnapshotLTP(symbols, given_fiscal)

        // Create map for opening balances
        const openingMap = new Map(openingBalances.map(o => [o.symbol, o as any]))
        
        // Create map for fiscal balance data (DEMAT/Non-DEMAT)
        const fiscalBalanceMap = new Map()
        fiscalBalanceData.forEach(fb => {
            const key = `${fb.symbol}_${fb.client_id}`
            fiscalBalanceMap.set(key, fb)
        })

        // For promoter shares, most transaction columns will be empty
        const metricData: MetricData[] = promoterHoldings.map(holding => {
            const symbol = holding.symbol
            const marketPrice = ltpMap.get(symbol) || 0
            const opening = openingMap.get(symbol)
            const fiscalBalance = fiscalBalanceMap.get(`${symbol}_${holding.client_id}`)
            
            // Opening data from previous year's promoter records (if exists)
            const openingQty = sanitizeNumeric(opening?.quantity)
            const openingRate = sanitizeNumeric(opening?.effective_rate)
            const openingAmount = openingQty * openingRate
            
            // Closing data from current promoter records
            const closingQty = sanitizeNumeric(holding.quantity)
            const closingRate = sanitizeNumeric(holding.effective_rate)
            const closingAmount = sanitizeNumeric(holding.total_value)
            
            // Calculate unrealized gain/loss based on effective_rate
            const marketValue = closingQty * marketPrice
            const bookValue = closingQty * closingRate // Using effective_rate for book value
            const unrealisedAmount = marketValue - bookValue
            
            // Calculate return percentage
            const todayReturnPercent = bookValue > 0 ? calculatePercentage(unrealisedAmount, bookValue) : 0
            
            // Get DEMAT/Non-DEMAT data
            const dematQty = sanitizeNumeric(fiscalBalance?.demat) || closingQty // Default to total quantity if no fiscal balance
            const nonDematQty = sanitizeNumeric(fiscalBalance?.non_demat) || 0
            
            return {
                company: holding.stock_fulls.full_form,
                code: symbol,
                category: holding.stock_fulls.sectors.sector_name,
                
                // Opening data from previous year (if available)
                opening_quantity: openingQty,
                opening_rate: openingRate,
                opening_amount: openingAmount,
                
                // No purchase/right/bonus/sales data for promoter shares
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
                
                demat: dematQty, // Get from fiscal_year_balance
                non_demat: nonDematQty,
                
                market_price: marketPrice,
                unrealised_amount: unrealisedAmount,
                today_return_percent: todayReturnPercent,
                remarks: holding.remarks || ""
            }
        })

        return metricData
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

        // Get sub classes that have promoter records in the current fiscal year
        const subClassesWithData = await prisma.sub_classes.findMany({
            where: {
                fund_id: fundData.fund_id,
                sub_id: { not: 1 }, // Exclude sub_id = 1
                promoter_records: {
                    some: {
                        fiscal_year_id: given_fiscal,
                        client_broker_mapping: {
                            client_name: given_fund
                        }
                    }
                }
            },
            select: {
                sub_id: true,
                sub_name: true
            },
            orderBy: {
                sub_name: 'asc'
            }
        })

        return subClassesWithData
    } catch (error) {
        console.error('Error getting sub classes for fund:', error)
        return []
    }
}

// Get comprehensive metric data for a specific sub class
export async function getMetricDataSubClassFiscal(currentFund: string, fiscalID: string, subClassId: number): Promise<MetricData[]> {
    const given_fund = currentFund
    const given_fiscal = Number(fiscalID)

    try {
        // Get all promoter holdings for the specific sub class
        const promoterHoldings = await prisma.promoter_records.findMany({
            where: {
                fiscal_year_id: given_fiscal,
                sub_id: subClassId, // Filter by specific sub class
                client_broker_mapping: {
                    client_name: given_fund
                }
            },
            select: {
                symbol: true,
                quantity: true,
                effective_rate: true,
                total_value: true,
                added_at: true,
                remarks: true,
                client_id: true, // Add client_id to get fiscal year balance data
                stock_fulls: {
                    select: {
                        full_form: true,
                        sectors: {
                            select: {
                                sector_name: true
                            }
                        }
                    }
                }
            }
        })

        const symbols = promoterHoldings.map(p => p.symbol)
        if (symbols.length === 0) return []

        // Get DEMAT/Non-DEMAT data from fiscal_year_balance for this sub class
        const fiscalBalanceData = await prisma.fiscal_year_balance.findMany({
            where: {
                fiscal_year_id: given_fiscal,
                symbol: { in: symbols },
                client_broker_mapping: {
                    client_name: given_fund
                },
                sub_id: subClassId, // Same sub class
                source_type: "MATURITY" // Promoter records typically use MATURITY source type
            },
            select: {
                symbol: true,
                client_id: true,
                demat: true,
                non_demat: true
            }
        })

        // Get the previous fiscal year for opening balances
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

        // Get opening balances from PREVIOUS fiscal year's promoter records for the same sub class
        const openingBalances = previousFiscalYear ? await prisma.promoter_records.findMany({
            where: {
                symbol: { in: symbols },
                fiscal_year_id: previousFiscalYear.fiscal_year_id,
                sub_id: subClassId, // Same sub class as current
                client_broker_mapping: {
                    client_name: given_fund
                }
            },
            select: {
                symbol: true,
                quantity: true,
                effective_rate: true,
                total_value: true
            }
        }) : []

        // Batch fetch market prices from market_snapshots
        const ltpMap = await getBatchMarketSnapshotLTP(symbols, given_fiscal)

        // Create map for opening balances
        const openingMap = new Map(openingBalances.map(o => [o.symbol, o as any]))
        
        // Create map for fiscal balance data (DEMAT/Non-DEMAT)
        const fiscalBalanceMap = new Map()
        fiscalBalanceData.forEach(fb => {
            const key = `${fb.symbol}_${fb.client_id}`
            fiscalBalanceMap.set(key, fb)
        })

        // Build metric data for this sub class (similar to promoter function)
        const metricData: MetricData[] = promoterHoldings.map(holding => {
            const symbol = holding.symbol
            const marketPrice = ltpMap.get(symbol) || 0
            const opening = openingMap.get(symbol)
            const fiscalBalance = fiscalBalanceMap.get(`${symbol}_${holding.client_id}`)
            
            // Opening data from previous year (if exists)
            const openingQty = sanitizeNumeric(opening?.quantity)
            const openingRate = sanitizeNumeric(opening?.effective_rate)
            const openingAmount = openingQty * openingRate
            
            // Closing data from current promoter records
            const closingQty = sanitizeNumeric(holding.quantity)
            const closingRate = sanitizeNumeric(holding.effective_rate)
            const closingAmount = sanitizeNumeric(holding.total_value)
            
            // Calculate unrealized gain/loss based on effective_rate
            const marketValue = closingQty * marketPrice
            const bookValue = closingQty * closingRate // Using effective_rate for book value
            const unrealisedAmount = marketValue - bookValue
            
            // Calculate return percentage
            const todayReturnPercent = bookValue > 0 ? calculatePercentage(unrealisedAmount, bookValue) : 0
            
            // Get DEMAT/Non-DEMAT data
            const dematQty = sanitizeNumeric(fiscalBalance?.demat) || closingQty // Default to total quantity if no fiscal balance
            const nonDematQty = sanitizeNumeric(fiscalBalance?.non_demat) || 0
            
            return {
                company: holding.stock_fulls.full_form,
                code: symbol,
                category: holding.stock_fulls.sectors.sector_name,
                
                // Opening data from previous year (if available)
                opening_quantity: openingQty,
                opening_rate: openingRate,
                opening_amount: openingAmount,
                
                // No purchase/right/bonus/sales data for promoter shares
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
                
                demat: dematQty, // Get from fiscal_year_balance
                non_demat: nonDematQty,
                
                market_price: marketPrice,
                unrealised_amount: unrealisedAmount,
                today_return_percent: todayReturnPercent,
                remarks: holding.remarks || ""
            }
        })

        return metricData
    } catch (error) {
        console.error('Error getting sub class metric data:', error)
        return []
    }
}

// Get comprehensive metric data for Non-DEMAT IPO allotments (staging)
export async function getMetricDataIPOStagingFiscal(currentFund: string, fiscalID: string): Promise<MetricData[]> {
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

        // Get all IPO staging holdings for the fiscal year, grouped by symbol and sub_id
        const ipoStagingHoldings = await prisma.ipo_allotment_staging.groupBy({
            by: ['symbol', 'sub_id'],
            where: {
                fiscal_year_id: given_fiscal,
                fund_id: fundData.fund_id
            },
            _sum: {
                quantity: true,
                total_value: true
            },
            _avg: {
                effective_rate: true
            }
        })

        if (ipoStagingHoldings.length === 0) return []

        const symbols = ipoStagingHoldings.map(h => h.symbol)

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

        // Get opening balances from PREVIOUS fiscal year's IPO staging records
        const openingBalances = previousFiscalYear ? await prisma.ipo_allotment_staging.groupBy({
            by: ['symbol', 'sub_id'],
            where: {
                fiscal_year_id: previousFiscalYear.fiscal_year_id,
                fund_id: fundData.fund_id
            },
            _sum: {
                quantity: true,
                total_value: true
            },
            _avg: {
                effective_rate: true
            }
        }) : []

        // Create map for opening balances
        const openingMap = new Map(openingBalances.map(o => [`${o.symbol}_${o.sub_id}`, o]))

        // Batch fetch market prices from market_snapshots
        const ltpMap = await getBatchMarketSnapshotLTP(symbols, given_fiscal)

        // Build metric data for IPO staging records
        const metricData: MetricData[] = ipoStagingHoldings.map(holding => {
            const symbol = holding.symbol
            const sub_id = holding.sub_id
            const stockDetail = stockMap.get(symbol)
            const marketPrice = ltpMap.get(symbol) || 0
            const opening = openingMap.get(`${symbol}_${sub_id}`)
            
            // Opening data from previous year (if exists)
            const openingQty = sanitizeNumeric(opening?._sum.quantity) || 0
            const openingRate = sanitizeNumeric(opening?._avg.effective_rate) || 0
            const openingAmount = openingQty * openingRate
            
            // Closing data from current IPO staging records
            const closingQty = sanitizeNumeric(holding._sum.quantity) || 0
            const closingRate = sanitizeNumeric(holding._avg.effective_rate) || 0
            const closingAmount = sanitizeNumeric(holding._sum.total_value) || 0
            
            // Calculate unrealized gain/loss
            const marketValue = closingQty * marketPrice
            const bookValue = closingQty * closingRate
            const unrealisedAmount = marketValue - bookValue
            
            // Calculate return percentage
            const todayReturnPercent = bookValue > 0 ? calculatePercentage(unrealisedAmount, bookValue) : 0
            
            // For staging records: all NON-DEMAT, no DEMAT
            const dematQty = 0
            const nonDematQty = closingQty
            
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
                
                demat: dematQty, // Always 0 for staging (not dematerialized)
                non_demat: nonDematQty, // All quantity is non-demat
                
                market_price: marketPrice,
                unrealised_amount: unrealisedAmount,
                today_return_percent: todayReturnPercent,
                remarks: '' // No remarks in staging table
            }
        })

        return metricData
    } catch (error) {
        console.error('Error getting IPO staging metric data:', error)
        return []
    }
}
