"use server"

import { prisma } from '@/lib/db';
import { sanitizeNumeric, calculatePercentage } from '@/lib/apiUtils';
import { getBatchMarketSnapshotLTP } from '@/lib/marketSnapshotUtils';

const microservice_url = process.env.MICROSERVICE_URL

// Keep market indexes unchanged as requested
export async function getAllIndex() {
    try{
        const response = await fetch(`${microservice_url}/allIndexes`);
        const data = await response.json();
        return data
    } catch (error) {
        console.error(`Error`, error);
    }
}

// Get sector allocation using fiscal year balance data
export async function getSectorAllocationFiscal(selectUser: string, fiscalYearId: number) {
    try {
        const fiscalYearBalances = await prisma.fiscal_year_balance.findMany({
            where: {
                
                fiscal_year_id: fiscalYearId,
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
                        sectors: {
                            select: {
                                sector_name: true
                            }
                        }
                    }
                }
            }
        });

        // Batch fetch LTP for all symbols from market_snapshots
        const symbols = fiscalYearBalances.map(h => h.symbol);
        const ltpMap = await getBatchMarketSnapshotLTP(symbols, fiscalYearId);

        const sectorMap = new Map<string, number>();
        let totalValue = 0;

        for (const balance of fiscalYearBalances) {
            const sectorName = balance.stock_fulls.sectors.sector_name;
            const costValue = sanitizeNumeric(balance.closing_quantity) * sanitizeNumeric(balance.effective_rate);
            
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
    } catch (error) {
        console.error('Error getting fiscal sector allocation:', error);
        return [];
    }
}

export async function getFiscalID() {
    try {
        const currentDate = new Date().toISOString()
        const currentID = await prisma.fiscal_years.findMany({
            where: {
                start_date: {
                    lte: currentDate
                },
                end_date: {
                    gte: currentDate
                },
            },
            orderBy: {
                fiscal_year_id: 'desc'
            }
        })
        
        // Return fiscal year ID if found, otherwise return 0 as fallback
        if (currentID.length > 0 && currentID[0]?.fiscal_year_id) {
            return currentID[0].fiscal_year_id
        }
        
        // Fallback: get the most recent fiscal year
        const latestFiscalYear = await prisma.fiscal_years.findFirst({
            orderBy: {
                fiscal_year_id: 'desc'
            },
            select: {
                fiscal_year_id: true
            }
        })
        
        return latestFiscalYear?.fiscal_year_id || 0
    } catch (error) {
        console.error('Error getting current fiscal year ID:', error)
        return 0
    }
}

// Get investment highlights using fiscal year data (IFRS-compliant)
export async function getInvestmentHighlightsFiscal(selectUser: string, fiscalYearId: number) {
    try {
        // Get fund_id from client name
        const clientMapping = await prisma.client_broker_mapping.findFirst({
            where: {
                client_name: selectUser
            },
            select: {
                fund_id: true
            }
        });

        if (!clientMapping) {
            return {
                tradingSecurities: 0,
                listedEquityShares: 0,
                maturitySecurities: 0,
                totalInvestment: 0,
                realizedGain: 0,
                unrealizedGain: 0,
                dividendIncome: 0,
                netGain: 0,
                realizedGainPercent: 0,
                unrealizedGainPercent: 0,
                netGainPercent: 0
            };
        }

        // Get trading investments from fiscal_year_balance with source_type='TRADING' (cost value)
        const tradingBalances = await prisma.fiscal_year_balance.findMany({
            where: {
                fiscal_year_id: fiscalYearId,
                client_broker_mapping: {
                    client_name: selectUser,
                },
                source_type: "TRADING",
            },
            select: {
                closing_quantity: true,
                effective_rate: true,
                symbol: true
            }
        });

        // Calculate trading total (cost value)
        let tradingValue = 0;
        for (const balance of tradingBalances) {
            const closingQty = sanitizeNumeric(balance.closing_quantity);
            const effectiveRate = sanitizeNumeric(balance.effective_rate);
            const costValue = closingQty * effectiveRate;
            tradingValue += costValue;
        }

        // Get promoter investments from promoter_records table (cost value)
        const promoterRecords = await prisma.promoter_records.findMany({
            where: {
                fiscal_year_id: fiscalYearId,
                client_broker_mapping: {
                    client_name: selectUser,
                },
            },
            select: {
                quantity: true,
                effective_rate: true,
            }
        });

        // Calculate promoter total (cost value)
        let promoterValue = 0;
        for (const record of promoterRecords) {
            const quantity = sanitizeNumeric(record.quantity);
            const effectiveRate = sanitizeNumeric(record.effective_rate);
            const costValue = quantity * effectiveRate;
            promoterValue += costValue;
        }

        // Get IPO allotment staging records total_value
        const ipoStagingRecords = await prisma.ipo_allotment_staging.findMany({
            where: {
                fiscal_year_id: fiscalYearId,
                fund_id: clientMapping.fund_id
            },
            select: {
                total_value: true
            }
        });

        // Calculate IPO staging total
        let ipoStagingValue = 0;
        for (const record of ipoStagingRecords) {
            const totalValue = sanitizeNumeric(record.total_value);
            ipoStagingValue += totalValue;
        }

        // Calculate totals
        const maturityValue = promoterValue + ipoStagingValue;
        const totalInvestment = tradingValue + maturityValue;
        
        // Get realized gains from sell_records (only for trading securities)
        const realizedGains = await prisma.sell_records.aggregate({
            where: {
                fiscal_year_id: fiscalYearId,
                client_broker_mapping: {
                    client_name: selectUser,
                },
            },
            _sum: {
                profit_loss: true
            }
        });

        // Calculate unrealized gains using market snapshots (only for trading securities)
        let unrealizedGain = 0;
        const symbols = tradingBalances.map(b => b.symbol);
        const ltpMap = await getBatchMarketSnapshotLTP(symbols, fiscalYearId);
        
        for (const balance of tradingBalances) {
            const closingQty = sanitizeNumeric(balance.closing_quantity);
            const effectiveRate = sanitizeNumeric(balance.effective_rate);
            const marketPrice = ltpMap.get(balance.symbol) || 0;
            const marketValue = closingQty * marketPrice;
            const bookValue = closingQty * effectiveRate;
            unrealizedGain += (marketValue - bookValue);
        }
        
        // Get dividend income
        const dividends = await prisma.cash_records.aggregate({
            where: {
                fiscal_year_id: fiscalYearId,
                client_broker_mapping: {
                    client_name: selectUser,
                },
            },
            _sum: {
                amount: true
            }
        });
        
        const dividendIncome = sanitizeNumeric(dividends._sum.amount);
        const realizedGain = sanitizeNumeric(realizedGains._sum.profit_loss);
        const netGain = realizedGain + unrealizedGain;
        
        return {
            tradingSecurities: tradingValue,
            listedEquityShares: tradingValue, // Assuming all trading securities are equity shares
            maturitySecurities: maturityValue,
            totalInvestment: totalInvestment,
            realizedGain: realizedGain,
            unrealizedGain: unrealizedGain,
            dividendIncome: dividendIncome,
            netGain: netGain,
            realizedGainPercent: calculatePercentage(realizedGain, totalInvestment),
            unrealizedGainPercent: calculatePercentage(unrealizedGain, totalInvestment),
            netGainPercent: calculatePercentage(netGain, totalInvestment)
        };
    } catch (error) {
        console.error('Error getting fiscal investment highlights:', error);
        return {
            tradingSecurities: 0,
            listedEquityShares: 0,
            maturitySecurities: 0,
            totalInvestment: 0,
            realizedGain: 0,
            unrealizedGain: 0,
            dividendIncome: 0,
            netGain: 0,
            realizedGainPercent: 0,
            unrealizedGainPercent: 0,
            netGainPercent: 0
        };
    }
}

// Get dividend information filtered by fiscal year
export async function getDividendInfoFiscal(selectUser: string, fiscalYearId: number) {
    try {
        const dividends = await prisma.cash_records.findMany({
            where: {
                fiscal_year_id: fiscalYearId,
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
    } catch (error) {
        console.error('Error getting fiscal dividend info:', error);
        return [];
    }
}

// Get comprehensive portfolio using fiscal year balance
export async function getComprehensivePortfolioFiscal(selectUser: string, fiscalYearId: number) {
    try {
        const fiscalBalances = await prisma.fiscal_year_balance.findMany({
            where: {
                fiscal_year_id: fiscalYearId,
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
                        sectors: {
                            select: {
                                sector_name: true
                            }
                        }
                    }
                }
            }
        });

        // Get realized gains for each stock
        const realizedGains = await prisma.sell_records.groupBy({
            by: ['symbol'],
            where: {
                fiscal_year_id: fiscalYearId,
                client_broker_mapping: {
                    client_name: selectUser,
                },
            },
            _sum: {
                profit_loss: true
            }
        });

        const realizedGainsMap = new Map<string, number>();
        realizedGains.forEach(gain => {
            realizedGainsMap.set(gain.symbol, sanitizeNumeric(gain._sum.profit_loss));
        });

        // Batch fetch LTP for all symbols from market_snapshots
        const symbols = fiscalBalances.map(h => h.symbol);
        const ltpMap = await getBatchMarketSnapshotLTP(symbols, fiscalYearId);

        const portfolioData = [];

        for (const balance of fiscalBalances) {
            const currentLTP = ltpMap.get(balance.symbol) || 0;
            const quantity = sanitizeNumeric(balance.closing_quantity);
            const effectiveRate = sanitizeNumeric(balance.effective_rate);
            const bookValue = quantity * effectiveRate;
            const marketValue = quantity * currentLTP;
            const unrealizedPnL = marketValue - bookValue;
            const pnlPercent = calculatePercentage(unrealizedPnL, bookValue);
            const realizedPnL = realizedGainsMap.get(balance.symbol) || 0;

            portfolioData.push({
                companyName: balance.stock_fulls.full_form,
                code: balance.symbol,
                sector: balance.stock_fulls.sectors.sector_name,
                quantity,
                bookValue,
                costPrice: effectiveRate, // Using effective_rate as Cost Price
                marketRate: currentLTP,
                unrealisedPnL: unrealizedPnL,
                pnlPercent,
                realisedPnL: realizedPnL
            });
        }

        return portfolioData;
    } catch (error) {
        console.error('Error getting fiscal comprehensive portfolio:', error);
        return [];
    }
}

// Get top gainers and losers from fiscal year portfolio
export async function getPortfolioGainersLosersFiscal(selectUser: string, fiscalYearId: number) {
    try {
        const fiscalBalances = await prisma.fiscal_year_balance.findMany({
            where: {
                
                fiscal_year_id: fiscalYearId,
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

        // Batch fetch LTP for all symbols from market_snapshots
        const symbols = fiscalBalances.map(h => h.symbol);
        const ltpMap = await getBatchMarketSnapshotLTP(symbols, fiscalYearId);

        const performanceData = [];

        for (const balance of fiscalBalances) {
            const currentLTP = ltpMap.get(balance.symbol) || 0;
            const quantity = sanitizeNumeric(balance.closing_quantity);
            const effectiveRate = sanitizeNumeric(balance.effective_rate);
            const bookValue = quantity * effectiveRate;
            const marketValue = quantity * currentLTP;
            const changePercent = calculatePercentage(marketValue - bookValue, bookValue);

            performanceData.push({
                symbol: balance.symbol,
                name: balance.stock_fulls.full_form,
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
    } catch (error) {
        console.error('Error getting fiscal portfolio gainers/losers:', error);
        return {
            topGainers: [],
            topLosers: []
        };
    }
}