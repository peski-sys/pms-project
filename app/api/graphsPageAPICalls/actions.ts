"use server"

import { prisma } from '@/lib/db';
import { getBatchLTP, sanitizeNumeric, calculatePercentage } from '@/lib/apiUtils';
import { getBatchMarketSnapshotLTP } from '@/lib/marketSnapshotUtils';

const microservice_url = process.env.MICROSERVICE_URL

// Helper function to batch fetch promoter sectors and create a map
// Returns a Map<sector_id, sector_name> for all promoter sectors
async function getPromoterSectorMap(): Promise<Map<number, string>> {
    const promoterSectors = await prisma.sectors.findMany({
        select: {
            sector_id: true,
            sector_name: true
        }
    });
    
    const sectorMap = new Map<number, string>();
    promoterSectors.forEach(sector => {
        sectorMap.set(sector.sector_id, sector.sector_name);
    });
    
    return sectorMap;
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

// Removed duplicate - use getInvestmentHighlights from dashboardAPICalls instead

export async function getAllIndex() {
    try {
        const response = await fetch(`${microservice_url}/allIndexes`);
        const data = await response.json();
        return data
    } catch (error) {
        console.error(`Error`, error);
    }
}

// Get sector allocation with optimized batch LTP using current fiscal year
export async function getSectorAllocation(selectUser: string) {
    // Get current fiscal year
    const currentDate = new Date();
    const currentFiscalYear = await prisma.fiscal_years.findFirst({
        where: {
            start_date: { lte: currentDate },
            end_date: { gte: currentDate }
        }
    });

    if (!currentFiscalYear) {
        return [];
    }

    const holdings = await prisma.fiscal_year_balance.findMany({
        where: {
            fiscal_year_id: currentFiscalYear.fiscal_year_id,
            client_broker_mapping: {
                client_name: selectUser,
            },
            source_type: "TRADING",
        },
        select: {
            symbol: true,
            closing_quantity: true,
            effective_rate: true,
            stock_fulls: {
                select: {
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
    });

    // Batch fetch LTP for all symbols using market snapshots
    const symbols = holdings.map(h => h.symbol);
    const ltpMap = await getBatchMarketSnapshotLTP(symbols, currentFiscalYear.fiscal_year_id);

    // Get promoter sector map for efficient sector name lookup
    const promoterSectorMap = await getPromoterSectorMap();

    const sectorMap = new Map<string, number>();
    let totalValue = 0;

    for (const holding of holdings) {
        const sectorName = getCorrectSectorName(holding.stock_fulls, promoterSectorMap);
        const costValue = sanitizeNumeric(holding.closing_quantity) * sanitizeNumeric(holding.effective_rate);
        
        totalValue += costValue;
        
        if (sectorMap.has(sectorName)) {
            sectorMap.set(sectorName, sectorMap.get(sectorName)! + costValue);
        } else {
            sectorMap.set(sectorName, costValue);
        }
    }

    const sectorAllocation = Array.from(sectorMap.entries()).map(([sector, value]) => ({
        sector,
        value,
        percentage: calculatePercentage(value, totalValue),
        // Add color mapping for chart
        fill: `var(--color-${sector.toLowerCase().replace(/\s+/g, '')})`
    }));

    return sectorAllocation.sort((a, b) => b.value - a.value);
}

// Removed duplicate - use getComprehensivePortfolio from dashboardAPICalls instead

// Get dividend information with selective fields using current fiscal year
export async function getDividendInfo(selectUser: string) {
    // Get current fiscal year
    const currentDate = new Date();
    const currentFiscalYear = await prisma.fiscal_years.findFirst({
        where: {
            start_date: { lte: currentDate },
            end_date: { gte: currentDate }
        }
    });

    if (!currentFiscalYear) {
        return [];
    }

    const dividends = await prisma.cash_records.findMany({
        where: {
            fiscal_year_id: currentFiscalYear.fiscal_year_id,
            client_broker_mapping: {
                client_name: selectUser,
            },
        },
        select: {
            symbol: true,
            amount: true,
            stock_fulls: {
                select: {
                    sectors: {
                        select: {
                            sector_name: true
                        }
                    }
                }
            }
        }
    });

    const dividendData = dividends.map(dividend => ({
        symbol: dividend.symbol,
        sector: dividend.stock_fulls.sectors.sector_name,
        dividendAmount: sanitizeNumeric(dividend.amount)
    }));

    return dividendData;
}

// Get top gainers and losers from portfolio with batch LTP using current fiscal year
export async function getPortfolioGainersLosers(selectUser: string) {
    // Get current fiscal year
    const currentDate = new Date();
    const currentFiscalYear = await prisma.fiscal_years.findFirst({
        where: {
            start_date: { lte: currentDate },
            end_date: { gte: currentDate }
        }
    });

    if (!currentFiscalYear) {
        return { topGainers: [], topLosers: [] };
    }

    // Fetch all holdings for the client (could be more than one per symbol)
    const holdings = await prisma.fiscal_year_balance.findMany({
        where: {
            fiscal_year_id: currentFiscalYear.fiscal_year_id,
            client_broker_mapping: {
                client_name: selectUser,
            },
            source_type: "TRADING",
        },
        select: {
            symbol: true,
            closing_quantity: true,
            effective_rate: true,
            stock_fulls: {
                select: { full_form: true }
            }
        }
    });

    // Aggregate holdings by symbol (sum quantities, weighted avg rate)
    const symbolMap = new Map();
    for (const h of holdings) {
        const qty = sanitizeNumeric(h.closing_quantity);
        const rate = sanitizeNumeric(h.effective_rate);
        if (!symbolMap.has(h.symbol)) {
            symbolMap.set(h.symbol, {
                symbol: h.symbol,
                total_quantity: qty,
                total_cost: qty * rate,
                stock_fulls: h.stock_fulls,
            });
        } else {
            const prev = symbolMap.get(h.symbol);
            prev.total_quantity += qty;
            prev.total_cost += qty * rate;
        }
    }
    const aggregatedHoldings = Array.from(symbolMap.values()).map(h => ({
        symbol: h.symbol,
        closing_quantity: h.total_quantity,
        effective_rate: h.total_quantity > 0 ? h.total_cost / h.total_quantity : 0,
        stock_fulls: h.stock_fulls,
    }));

    // Batch fetch LTP for all symbols using market snapshots
    const symbols = aggregatedHoldings.map(h => h.symbol);
    const ltpMap = await getBatchMarketSnapshotLTP(symbols, currentFiscalYear.fiscal_year_id);

    const performanceData = [];
    for (const holding of aggregatedHoldings) {
        const currentLTP = ltpMap.get(holding.symbol) || 0;
        const quantity = sanitizeNumeric(holding.closing_quantity);
        const effectiveRate = sanitizeNumeric(holding.effective_rate);
        const bookValue = quantity * effectiveRate;
        const marketValue = quantity * currentLTP;
        const changePercent = calculatePercentage(marketValue - bookValue, bookValue);

        performanceData.push({
            symbol: holding.symbol,
            name: holding.stock_fulls.full_form,
            change: changePercent,
            price: currentLTP,
            volume: quantity
        });
    }

    // Sort by performance
    performanceData.sort((a, b) => b.change - a.change);

    const topGainers = performanceData.filter(stock => stock.change > 0).slice(0, 5);
    const topLosers = performanceData.filter(stock => stock.change < 0).slice(-5).reverse();

    return {
        topGainers,
        topLosers
    };
}

// Get profit/loss as of today for chart - from fiscal_year_balance where source_type='TRADING'
export async function getProfitLossToday(selectUser: string) {
    // Get current fiscal year
    const currentDate = new Date();
    const currentFiscalYear = await prisma.fiscal_years.findFirst({
        where: {
            start_date: { lte: currentDate },
            end_date: { gte: currentDate }
        }
    });

    if (!currentFiscalYear) {
        return [];
    }

    // Get holdings from fiscal_year_balance where source_type='TRADING'
    const holdings = await prisma.fiscal_year_balance.findMany({
        where: {
            fiscal_year_id: currentFiscalYear.fiscal_year_id,
            client_broker_mapping: {
                client_name: selectUser,
            },
            source_type: "TRADING",
        },
        select: {
            symbol: true,
            closing_quantity: true,
            effective_rate: true,
            fund_id: true,
            fiscal_year_id: true,
            stock_fulls: {
                select: {
                    full_form: true
                }
            }
        }
    });

    if (!holdings || holdings.length === 0) {
        return [];
    }

    // Combine holdings by fund_id, fiscal_year_id, and symbol
    const combinedMap = new Map<string, any>();
    
    holdings.forEach(holding => {
        const key = `${holding.fund_id}_${holding.fiscal_year_id || 'null'}_${holding.symbol}`;
        const quantity = sanitizeNumeric(holding.closing_quantity || 0);
        const rate = sanitizeNumeric(holding.effective_rate || 0);
        const totalValue = quantity * rate;
        
        if (combinedMap.has(key)) {
            const existing = combinedMap.get(key);
            const existingQuantity = existing.closing_quantity;
            const existingTotalValue = existing.total_cost_value;
            const newTotalQuantity = existingQuantity + quantity;
            const newTotalCostValue = existingTotalValue + totalValue;
            
            // Calculate weighted average cost price
            const newAverageRate = newTotalQuantity > 0 ? newTotalCostValue / newTotalQuantity : 0;
            
            combinedMap.set(key, {
                ...existing,
                closing_quantity: newTotalQuantity,
                effective_rate: newAverageRate,
                total_cost_value: newTotalCostValue
            });
        } else {
            combinedMap.set(key, {
                ...holding,
                closing_quantity: quantity,
                effective_rate: rate,
                total_cost_value: totalValue
            });
        }
    });
    
    const combinedHoldings = Array.from(combinedMap.values());

    // Batch fetch LTP for all symbols using market snapshots
    const symbols = combinedHoldings.map(h => h.symbol);
    const ltpMap = await getBatchMarketSnapshotLTP(symbols, currentFiscalYear.fiscal_year_id);

    // Calculate unrealized gain/loss for each stock
    const profitLossData = combinedHoldings.map(holding => {
        const currentLTP = ltpMap.get(holding.symbol) || 0;
        const quantity = sanitizeNumeric(holding.closing_quantity);
        const effectiveRate = sanitizeNumeric(holding.effective_rate);
        
        // Calculate unrealized gain/loss
        const bookValue = quantity * effectiveRate;
        const marketValue = quantity * currentLTP;
        const unrealizedGainLoss = marketValue - bookValue;
        
        // Calculate percentage gain/loss
        const pnlPercent = bookValue > 0 ? calculatePercentage(unrealizedGainLoss, bookValue) : 0;

        return {
            code: holding.symbol,
            companyName: holding.stock_fulls.full_form,
            pnlPercent: pnlPercent,
            gainPercent: pnlPercent, // For chart compatibility
            unrealizedGainLoss: unrealizedGainLoss,
            quantity: quantity,
            effectiveRate: effectiveRate,
            currentLTP: currentLTP
        };
    });

    // Sort by gain percentage descending
    return profitLossData.sort((a, b) => b.pnlPercent - a.pnlPercent);
}
