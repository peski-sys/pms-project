"use server"

import { prisma } from "@/lib/db"
import { getBatchLTP, sanitizeNumeric, calculatePercentage } from '@/lib/apiUtils'

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
    
    // DEMAT/NON_DEMAT
    demat: number
    non_demat: number
    
    // Market Price
    market_price: number
    
    // Capital Gain/Loss
    unrealised_amount: number
    
    // Return
    today_return_percent: number

    // Remarks (from FYB for trading, from promoter_records for promoter)
    remarks?: string
}

// Get comprehensive metric data for held for trading securities
export async function getMetricDataTrading(currentFund: string, fiscalID: string): Promise<MetricData[]> {
    const given_fund = currentFund
    const given_fiscal = Number(fiscalID)

    // Get all symbols from current fiscal year balance (trading securities)
    const tradingSymbols = await prisma.fiscal_year_balance.findMany({
        where: {
            fiscal_year_id: given_fiscal,
            client_broker_mapping: {
                client_name: given_fund
            },
            closing_quantity: {
                gt: 0 // Only get holdings with positive quantities
            }
        },
        select: {
            symbol: true,
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

    const symbols = tradingSymbols.map(s => s.symbol)
    if (symbols.length === 0) return []

    // Batch fetch market prices
    const ltpMap = await getBatchLTP(symbols)

    // Get the previous fiscal year for opening balances
    const currentFiscalYear = await prisma.fiscal_years.findUnique({
        where: { fiscal_year_id: given_fiscal }
    })

    // Remarks are already included in tradingSymbols query
    
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

    // Get opening balances from PREVIOUS fiscal year's closing data
    const openingBalances = previousFiscalYear ? await prisma.fiscal_year_balance.findMany({
        where: {
            symbol: { in: symbols },
            fiscal_year_id: previousFiscalYear.fiscal_year_id,
            client_broker_mapping: {
                client_name: given_fund
            }
        },
        select: {
            symbol: true,
            closing_quantity: true,  // Previous year's closing quantity
            effective_rate: true     // Previous year's effective rate
        }
    }) : []

    // Get purchase data
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
        },
        _avg: {
            effective_rate: true
        }
    })

    // Get right share data
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

    // Get bonus data with book close dates
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

    // Get sales data
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
        },
        _avg: {
            effective_rate: true
        }
    })

    // Create maps for easy lookup
    const openingMap = new Map(openingBalances.map(o => [o.symbol, o]))
    const purchaseMap = new Map(purchaseData.map(p => [p.symbol, p]))
    const rightMap = new Map(rightData.map(r => [r.symbol, r]))
    const salesMap = new Map(salesData.map(s => [s.symbol, s]))
    
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
    const metricData: MetricData[] = tradingSymbols.map(holding => {
        const symbol = holding.symbol
        const opening = openingMap.get(symbol)
        const purchase = purchaseMap.get(symbol)
        const right = rightMap.get(symbol)
        const bonus = bonusMap.get(symbol)
        const sales = salesMap.get(symbol)
        const marketPrice = ltpMap.get(symbol) || 0
        
    // Calculate values - Opening is previous year's CLOSING data
        const openingQty = sanitizeNumeric((opening as any)?.closing_quantity)  // Previous year's closing quantity
        const openingRate = sanitizeNumeric((opening as any)?.effective_rate)   // Previous year's effective rate
        const openingAmount = openingQty * openingRate
        
        const purchaseQty = sanitizeNumeric((purchase as any)?._sum.quantity)
        const purchaseAmount = sanitizeNumeric((purchase as any)?._sum.net_payable)
        const purchaseRate = purchaseQty > 0 ? purchaseAmount / purchaseQty : 0
        
        const rightQty = sanitizeNumeric((right as any)?._sum.quantity)
        const rightTotal = sanitizeNumeric((right as any)?._sum.total_value)
        
        const bonusQty = bonus?.quantity || 0
        const bonusBookClose = bonus?.bookCloseDate || ''
        
        const salesQty = sanitizeNumeric((sales as any)?._sum.quantity)
        const salesAmount = sanitizeNumeric((sales as any)?._sum.net_receivable)
        const salesProfit = sanitizeNumeric((sales as any)?._sum.profit_loss)
        const salesCost = salesAmount - salesProfit // Net receivable - profit = cost
        
        const closingQty = sanitizeNumeric(holding.closing_quantity)
        const closingRate = sanitizeNumeric(holding.effective_rate)
        const closingAmount = closingQty * closingRate
        
        // DEMAT/NON_DEMAT values
        const dematQty = sanitizeNumeric(holding.demat)
        const nonDematQty = sanitizeNumeric(holding.non_demat)
        
        // Calculate unrealized gain/loss
        const marketValue = closingQty * marketPrice
        const unrealisedAmount = marketValue - closingAmount
        
        // Calculate return percentage
        const todayReturnPercent = calculatePercentage(unrealisedAmount, closingAmount)
        
        return {
            company: holding.stock_fulls.full_form,
            code: symbol,
            category: holding.stock_fulls.sectors.sector_name,
            
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
            remarks: holding.remarks || ""
        }
    })

    return metricData
}

// Get comprehensive metric data for promoter shares
export async function getMetricDataPromoter(currentFund: string, fiscalID: string): Promise<MetricData[]> {
    const given_fund = currentFund
    const given_fiscal = Number(fiscalID)

    // Get all promoter holdings
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

    // Get the previous fiscal year for opening balances (if any promoter shares existed before)
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

    // Get opening balances from PREVIOUS fiscal year's closing data for promoter shares
    const openingBalances = previousFiscalYear ? await prisma.fiscal_year_balance.findMany({
        where: {
            symbol: { in: symbols },
            fiscal_year_id: previousFiscalYear.fiscal_year_id,
            client_broker_mapping: {
                client_name: given_fund
            }
        },
        select: {
            symbol: true,
            closing_quantity: true,
            effective_rate: true
        }
    }) : []

    // Batch fetch market prices
    const ltpMap = await getBatchLTP(symbols)

    // Create map for opening balances
    const openingMap = new Map(openingBalances.map(o => [o.symbol, o]))

    // For promoter shares, most columns will be empty or show only closing data
    const metricData: MetricData[] = promoterHoldings.map(holding => {
        const symbol = holding.symbol
        const marketPrice = ltpMap.get(symbol) || 0
        const opening = openingMap.get(symbol)
        
        // Opening data from previous year (if exists)
        const openingQty = sanitizeNumeric((opening as any)?.closing_quantity)
        const openingRate = sanitizeNumeric((opening as any)?.effective_rate)
        const openingAmount = openingQty * openingRate
        
        const closingQty = sanitizeNumeric(holding.quantity)
        const closingRate = sanitizeNumeric(holding.effective_rate)
        const closingAmount = sanitizeNumeric(holding.total_value)
        
        // Calculate unrealized gain/loss
        const marketValue = closingQty * marketPrice
        const unrealisedAmount = marketValue - closingAmount
        
        // Calculate return percentage
        const todayReturnPercent = calculatePercentage(unrealisedAmount, closingAmount)
        
        return {
            company: holding.stock_fulls.full_form,
            code: symbol,
            category: holding.stock_fulls.sectors.sector_name,
            
            // Opening data from previous year's closing (if available)
            opening_quantity: openingQty,
            opening_rate: openingRate,
            opening_amount: openingAmount,
            
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
            remarks: (holding as any).remarks || ""
        }
    })

    return metricData
}

// Legacy function - kept for backward compatibility
export async function getFilterSymbols(currentFund: string, fiscalID: string) {
    const given_fund = currentFund
    const given_fiscal = Number(fiscalID)

    const for_openings = await prisma.fiscal_year_balance.groupBy({
        by: ["symbol"],
        _sum: {
            opening_quantity: true
        },
        where: {
            funds: {
                fund_name: given_fund,
            },
            fiscal_year_id: given_fiscal
        },
        orderBy: {
            symbol: "asc"
        }
    })

    const for_purchase = await prisma.buy_records.groupBy({
        by: ["symbol"],
        _sum: {
            quantity: true,
            net_payable: true,
        },
        where: {
            funds: {
                fund_name: given_fund,
            },
            fiscal_year_id: given_fiscal
        },
        orderBy: {
            symbol: "asc"
        }
    })

    const for_right = await prisma.right_records.groupBy({
        by: ["symbol"],
        _sum: {
            quantity: true,
            total_value: true,
        },
        where: {
            funds: {
                fund_name: given_fund,
            },
            fiscal_year_id: given_fiscal
        },
        orderBy: {
            symbol: "asc"
        }
    })

    const for_sales = await prisma.sell_records.groupBy({
        by: ["symbol"],
        _sum: {
            quantity: true,
            net_receivable: true,
        },
        where: {
            funds: {
                fund_name: given_fund,
            },
            fiscal_year_id: given_fiscal
        },
        orderBy: {
            symbol: "asc"
        }
    })

        const for_bonus = await prisma.bonus_records.groupBy({
        by: ["symbol"],
        _sum: {
            quantity: true
        },
        where: {
            funds: {
                fund_name: given_fund,
            },
            fiscal_year_id: given_fiscal
        },
        orderBy: {
            symbol: "asc"
        }
    })

        const for_cash = await prisma.cash_records.groupBy({
        by: ["symbol"],
        _sum: {
            amount: true,
        },
        where: {
            funds: {
                fund_name: given_fund,
            },
            fiscal_year_id: given_fiscal
        },
        orderBy: {
            symbol: "asc"
        }
    })

    const for_closings = await prisma.fiscal_year_balance.groupBy({
        by: ["symbol"],
        _sum: {
            closing_quantity: true,
            effective_rate: true
        },
        where: {
            funds: {
                fund_name: given_fund,
            },
            fiscal_year_id: given_fiscal
        },
        orderBy: {
            symbol: "asc"
        }
    })

    const allSymbols = new Set([
  ...for_openings.map(d => d.symbol),
  ...for_purchase.map(d => d.symbol),
  ...for_right.map(d => d.symbol),
  ...for_bonus.map(d => d.symbol),
  ...for_cash.map(d => d.symbol),
  ...for_sales.map(d => d.symbol),
  ...for_closings.map(d => d.symbol),
]);

const openingMap = Object.fromEntries(for_openings.map(d => [d.symbol, d._sum]));
const purchaseMap = Object.fromEntries(for_purchase.map(d => [d.symbol, d._sum]));
const rightMap    = Object.fromEntries(for_right.map(d => [d.symbol, d._sum]));
const bonusMap    = Object.fromEntries(for_bonus.map(d => [d.symbol, d._sum]));
const cashMap     = Object.fromEntries(for_cash.map(d => [d.symbol, d._sum]));
const salesMap    = Object.fromEntries(for_sales.map(d => [d.symbol, d._sum]));
const closingMap  = Object.fromEntries(for_closings.map(d => [d.symbol, d._sum]));


const mergedData = Array.from(allSymbols).map(symbol => ({
  symbol,

  // Opening
  opening_quantity: Number(openingMap[symbol]?.opening_quantity) || 0,
  opening_rate: 0, 
  opening_amount: 0, 

  // Purchase
  purchase_quantity: Number(purchaseMap[symbol]?.quantity) || 0,
  purchase_rate: purchaseMap[symbol]?.quantity ? (Number(purchaseMap[symbol]?.net_payable) / purchaseMap[symbol]?.quantity) : 0,
  purchase_amount: Number(purchaseMap[symbol]?.net_payable) || 0,

  // Right Shares
  right_quantity: Number(rightMap[symbol]?.quantity) || 0,
  right_rate: rightMap[symbol]?.quantity
  ? (Number(rightMap[symbol]?.total_value) / rightMap[symbol]?.quantity)
  : 0,
right_amount: Number(rightMap[symbol]?.total_value) || 0,

  // Bonus
  bonus_quantity: Number(bonusMap[symbol]?.quantity) || 0,

  // Cash Dividend
  cash_amount: Number(cashMap[symbol]?.amount) || 0,

  // Sales
  sales_quantity: Number(salesMap[symbol]?.quantity) || 0,
  sales_rate: salesMap[symbol]?.quantity
    ? (Number(salesMap[symbol]?.net_receivable) / salesMap[symbol]?.quantity)
    : 0,
  sales_amount: Number(salesMap[symbol]?.net_receivable) || 0,

  // Closing
  closing_quantity: Number(closingMap[symbol]?.closing_quantity) || 0,
  closing_rate: Number(closingMap[symbol]?.effective_rate) || 0, // calculate separately if needed
  closing_amount: Number(closingMap[symbol]?.closing_quantity) * Number(closingMap[symbol]?.effective_rate) || 0,
}));


return mergedData

}