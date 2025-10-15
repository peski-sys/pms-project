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
                }
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
        // Get all promoter holdings for the fiscal year
        const promoterHoldings = await prisma.promoter_records.findMany({
            where: {
                fiscal_year_id: given_fiscal,
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

        // For promoter shares, most transaction columns will be empty
        const metricData: MetricData[] = promoterHoldings.map(holding => {
            const symbol = holding.symbol
            const marketPrice = ltpMap.get(symbol) || 0
            const opening = openingMap.get(symbol)
            
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
                
                demat: 0, // Promoter shares don't have DEMAT/NON_DEMAT split
                non_demat: 0,
                
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