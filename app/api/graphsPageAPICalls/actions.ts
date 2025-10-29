"use server"

import { prisma } from '@/lib/db';
import { getBatchLTP, sanitizeNumeric, calculatePercentage } from '@/lib/apiUtils';
import { getBatchMarketSnapshotLTP } from '@/lib/marketSnapshotUtils';

const microservice_url = process.env.MICROSERVICE_URL

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

    // Batch fetch LTP for all symbols using market snapshots
    const symbols = holdings.map(h => h.symbol);
    const ltpMap = await getBatchMarketSnapshotLTP(symbols, currentFiscalYear.fiscal_year_id);

    const sectorMap = new Map<string, number>();
    let totalValue = 0;

    for (const holding of holdings) {
        const sectorName = holding.stock_fulls.sectors.sector_name;
        const currentLTP = ltpMap.get(holding.symbol) || 0;
        const marketValue = sanitizeNumeric(holding.closing_quantity) * currentLTP;
        
        totalValue += marketValue;
        
        if (sectorMap.has(sectorName)) {
            sectorMap.set(sectorName, sectorMap.get(sectorName)! + marketValue);
        } else {
            sectorMap.set(sectorName, marketValue);
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
                    full_form: true,
                }
            }
        }
    });

    // Batch fetch LTP for all symbols using market snapshots
    const symbols = holdings.map(h => h.symbol);
    const ltpMap = await getBatchMarketSnapshotLTP(symbols, currentFiscalYear.fiscal_year_id);

    const performanceData = [];

    for (const holding of holdings) {
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
