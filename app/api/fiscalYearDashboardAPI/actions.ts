"use server"

import { prisma } from '@/lib/db';
import { sanitizeNumeric, calculatePercentage } from '@/lib/apiUtils';
import { getMarketSnapshotLTP, getBatchMarketSnapshotLTP } from '@/lib/marketSnapshotUtils';
import { withMarketSnapshotUpdate } from '@/lib/marketSnapshotAutoUpdate';

// Import helper functions from dashboardAPICalls
// Helper function to combine holdings by fund_id, fiscal_year_id, and symbol
function combineHoldingsByFund(holdings: any[]): any[] {
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
                total_cost_value: totalValue,
                fiscal_year_id: holding.fiscal_year_id // Ensure fiscal_year_id is preserved
            });
        }
    });
    
    return Array.from(combinedMap.values());
}

// Helper function to combine promoter records by fund_id and symbol  
function combinePromoterRecordsByFund(records: any[]): any[] {
    const combinedMap = new Map<string, any>();
    
    records.forEach(record => {
        const key = `${record.fund_id}_${record.symbol}`;
        const quantity = sanitizeNumeric(record.quantity || 0);
        
        if (combinedMap.has(key)) {
            const existing = combinedMap.get(key);
            const existingQuantity = existing.quantity;
            const newTotalQuantity = existingQuantity + quantity;
            
            combinedMap.set(key, {
                ...existing,
                quantity: newTotalQuantity
            });
        } else {
            combinedMap.set(key, {
                ...record,
                quantity: quantity
            });
        }
    });
    
    return Array.from(combinedMap.values());
}

// Get current fiscal year based on current date
export async function getCurrentFiscalYear() {
    try {
        const currentDate = new Date();
        
        const currentFiscalYear = await prisma.fiscal_years.findFirst({
            where: {
                start_date: { lte: currentDate },
                end_date: { gte: currentDate }
            },
            select: {
                fiscal_year_id: true,
                year_label: true,
                start_date: true,
                end_date: true
            }
        });

        return currentFiscalYear;
    } catch (error) {
        console.error('Error getting current fiscal year:', error);
        return null;
    }
}

// Get all fiscal years for dropdown
export async function getAllFiscalYears() {
    try {
        const fiscalYears = await prisma.fiscal_years.findMany({
            select: {
                fiscal_year_id: true,
                year_label: true,
                start_date: true,
                end_date: true
            },
            orderBy: {
                start_date: 'desc'
            }
        });

        return fiscalYears;
    } catch (error) {
        console.error('Error getting fiscal years:', error);
        return [];
    }
}

// Get total investment from fiscal_year_balance using market value (closing_quantity * current_ltp)
// Internal function - wrapped with market snapshot update
async function _getTotalInvestmentFiscal(selectUser: string, fiscalYearId: number) {
    try {
        if (!selectUser || selectUser.trim() === '') {
            console.error('No user selected for getTotalInvestmentFiscal');
            return { total_investment: 0, error: 'User not specified' };
        }

        const fiscalBalances = await prisma.fiscal_year_balance.findMany({
            where: {
                fiscal_year_id: fiscalYearId,
                client_broker_mapping: {
                    client_name: selectUser,
                },
            },
            select: {
                symbol: true,
                closing_quantity: true,
                effective_rate: true,
                fund_id: true,
                fiscal_year_id: true
            }
        });

        // Combine holdings by fund_id, fiscal_year_id, and symbol
        const combinedHoldings = combineHoldingsByFund(fiscalBalances);

        // Batch fetch LTP for all symbols
        const symbols = combinedHoldings.map(b => b.symbol);
        const ltpMap = await getBatchMarketSnapshotLTP(symbols, fiscalYearId);

        let totalInvestment = 0;
        combinedHoldings.forEach(balance => {
            const closingQty = sanitizeNumeric(balance.closing_quantity);
            const currentLTP = ltpMap.get(balance.symbol) || 0;
            // Use market value instead of cost value for total investment
            totalInvestment += (closingQty * currentLTP);
        });

        return {
            total_investment: totalInvestment
        };
    } catch (error) {
        console.error(`Error getting total investment for user ${selectUser} in fiscal year ${fiscalYearId}:`, error);
        return {
            total_investment: 0,
            error: error instanceof Error ? error.message : 'Failed to get total investment'
        };
    }
}


// Get unrealized gains using fiscal year balance and market snapshots
// Internal function - wrapped with market snapshot update
async function _getUnrealizedGainsFiscal(selectUser: string, fiscalYearId: number) {
    try {
        if (!selectUser || selectUser.trim() === '') {
            console.error('No user selected for getUnrealizedGainsFiscal');
            return {
                total_unrealized_gain: 0,
                total_market_value: 0,
                holdings: [],
                error: 'User not specified'
            };
        }

        const holdings = await prisma.fiscal_year_balance.findMany({
            where: {
                fiscal_year_id: fiscalYearId,
                client_broker_mapping: {
                    client_name: selectUser,
                },
            },
            select: {
                symbol: true,
                closing_quantity: true,
                effective_rate: true,
                client_id: true,
                fund_id: true,
                fiscal_year_id: true,
                stock_fulls: {
                    select: {
                        full_form: true,
                    }
                }
            }
        });

        if (!holdings || holdings.length === 0) {
            console.log(`No fiscal year balance found for user: ${selectUser} in fiscal year: ${fiscalYearId}`);
            return {
                total_unrealized_gain: 0,
                total_market_value: 0,
                holdings: []
            };
        }

    // Combine holdings by fund_id, fiscal_year_id, and symbol
    const combinedHoldings = combineHoldingsByFund(holdings);

    // Batch fetch LTP for all symbols
    const symbols = combinedHoldings.map(h => h.symbol);
    const ltpMap = await getBatchMarketSnapshotLTP(symbols, fiscalYearId);

    let totalUnrealizedGain = 0;
    let totalMarketValue = 0;
    const holdingsWithUnrealized = [];

    for (const holding of combinedHoldings) {
        try {
            const currentLTP = ltpMap.get(holding.symbol) || 0;
            const quantity = sanitizeNumeric(holding.closing_quantity);
            const effectiveRate = sanitizeNumeric(holding.effective_rate);
            const marketValue = quantity * currentLTP;
            const costValue = quantity * effectiveRate;
            const unrealizedGain = marketValue - costValue;
            
            totalUnrealizedGain += unrealizedGain;
            totalMarketValue += marketValue;
            
            holdingsWithUnrealized.push({
                ...holding,
                client_id: `${holding.fund_id}`, // Use fund_id as identifier since we combined by fund
                closing_quantity: quantity,
                effective_rate: effectiveRate,
                current_ltp: currentLTP,
                market_value: marketValue,
                cost_value: costValue,
                unrealized_gain: unrealizedGain,
                unrealized_gain_percent: effectiveRate > 0 ? calculatePercentage(unrealizedGain, costValue) : 0
            });
        } catch (holdingError) {
            console.error(`Error processing holding for ${holding.symbol}:`, holdingError);
            // Continue with other holdings
        }
    }

        return {
            total_unrealized_gain: totalUnrealizedGain,
            total_market_value: totalMarketValue,
            holdings: holdingsWithUnrealized
        };
    } catch (error) {
        console.error(`Error getting unrealized gains for user ${selectUser} in fiscal year ${fiscalYearId}:`, error);
        return {
            total_unrealized_gain: 0,
            total_market_value: 0,
            holdings: [],
            error: error instanceof Error ? error.message : 'Failed to get unrealized gains'
        };
    }
}

// Get investment breakdown by sectors using fiscal year balance
export async function getInvestmentBreakdownFiscal(selectUser: string, fiscalYearId: number) {
    try {
        // Get all sectors from the database
        const allSectors = await prisma.sectors.findMany({
            select: {
                sector_name: true
            },
            orderBy: {
                sector_name: 'asc'
            }
        });

        // Get trading investments (from fiscal_year_balance)
        const tradingInvestments = await prisma.fiscal_year_balance.findMany({
            where: {
                fiscal_year_id: fiscalYearId,
                client_broker_mapping: {
                    client_name: selectUser,
                },
            },
            select: {
                symbol: true,
                closing_quantity: true,
                effective_rate: true,
                fund_id: true,
                fiscal_year_id: true,
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

        // Combine trading investments by fund_id, fiscal_year_id, and symbol
        const combinedTradingInvestments = combineHoldingsByFund(tradingInvestments);

        // Get maturity investments (from promoter_records for the same fiscal year)
        const maturityInvestments = await prisma.promoter_records.findMany({
            where: {
                fiscal_year_id: fiscalYearId,
                client_broker_mapping: {
                    client_name: selectUser,
                },
            },
            select: {
                symbol: true,
                quantity: true,
                effective_rate: true,
                fund_id: true,
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

        // Combine maturity investments by fund_id and symbol
        const combinedMaturityInvestments = combinePromoterRecordsByFund(maturityInvestments);

    // Get all symbols for batch LTP fetching
    const tradingSymbols = combinedTradingInvestments.map(inv => inv.symbol);
    const ltpMap = await getBatchMarketSnapshotLTP(tradingSymbols, fiscalYearId);

    // Calculate trading sector values using market snapshots
    const tradingSectorMap = new Map<string, number>();
    let tradingTotal = 0;

    for (const investment of combinedTradingInvestments) {
        const sectorName = investment.stock_fulls.sectors.sector_name;
        const currentLTP = ltpMap.get(investment.symbol) || 0;
        const marketValue = sanitizeNumeric(investment.closing_quantity) * currentLTP;
        
        tradingTotal += marketValue;
        
        if (tradingSectorMap.has(sectorName)) {
            tradingSectorMap.set(sectorName, tradingSectorMap.get(sectorName)! + marketValue);
        } else {
            tradingSectorMap.set(sectorName, marketValue);
        }
    }

        // Calculate maturity sector values
        const maturitySectorMap = new Map<string, number>();
        let maturityTotal = 0;

        for (const investment of combinedMaturityInvestments) {
            const sectorName = investment.stock_fulls.sectors.sector_name;
            const marketValue = sanitizeNumeric(investment.quantity) * sanitizeNumeric(investment.effective_rate);
            
            maturityTotal += marketValue;
            
            if (maturitySectorMap.has(sectorName)) {
                maturitySectorMap.set(sectorName, maturitySectorMap.get(sectorName)! + marketValue);
            } else {
                maturitySectorMap.set(sectorName, marketValue);
            }
        }

        // Create comprehensive sector data for all sectors
        const tradingData = allSectors.map(sector => {
            const sectorName = sector.sector_name;
            const value = tradingSectorMap.get(sectorName) || 0;
            return {
                sector: sectorName,
                value: value,
                percentage: calculatePercentage(value, tradingTotal)
            };
        });

        const maturityData = allSectors.map(sector => {
            const sectorName = sector.sector_name;
            const value = maturitySectorMap.get(sectorName) || 0;
            return {
                sector: sectorName,
                value: value,
                percentage: calculatePercentage(value, maturityTotal)
            };
        });

        return {
            trading: {
                data: tradingData,
                total: tradingTotal,
                count: combinedTradingInvestments.length
            },
            maturity: {
                data: maturityData,
                total: maturityTotal,
                count: combinedMaturityInvestments.length
            },
            allSectors: allSectors.map(s => s.sector_name)
        };
    } catch (error) {
        console.error(`Error getting investment breakdown for user ${selectUser} in fiscal year ${fiscalYearId}:`, error);
        return {
            trading: { data: [], total: 0, count: 0 },
            maturity: { data: [], total: 0, count: 0 },
            allSectors: []
        };
    }
}

// Get portfolio summary by sector using fiscal year balance
export async function getSectorPortfolioSummaryFiscal(selectUser: string, fiscalYearId: number) {
    try {
        // Get all fiscal year balances for the user and fiscal year
        const fiscalBalances = await prisma.fiscal_year_balance.findMany({
            where: {
                fiscal_year_id: fiscalYearId,
                client_broker_mapping: {
                    client_name: selectUser,
                },
            },
            select: {
                symbol: true,
                closing_quantity: true,
                effective_rate: true,
                fund_id: true,
                fiscal_year_id: true,
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

        // Combine fiscal balances by fund_id, fiscal_year_id, and symbol
        const combinedFiscalBalances = combineHoldingsByFund(fiscalBalances);

        // Get realized gains from sell_records for this fiscal year
        const sellRecords = await prisma.sell_records.findMany({
            where: {
                fiscal_year_id: fiscalYearId,
                client_broker_mapping: {
                    client_name: selectUser,
                },
            },
            include: {
                stock_fulls: {
                    include: {
                        sectors: true
                    }
                }
            }
        });

        // Get promoter records for maturity holdings
        const promoterRecords = await prisma.promoter_records.findMany({
            where: {
                fiscal_year_id: fiscalYearId,
                client_broker_mapping: {
                    client_name: selectUser,
                },
            },
            select: {
                symbol: true,
                quantity: true,
                effective_rate: true,
                fund_id: true,
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

        // Combine promoter records by fund_id and symbol
        const combinedPromoterRecords = combinePromoterRecordsByFund(promoterRecords);

    // Batch fetch LTP for all symbols
    const allSymbols = [
        ...combinedFiscalBalances.map(b => b.symbol),
        ...combinedPromoterRecords.map(p => p.symbol)
    ];
    const ltpMap = await getBatchMarketSnapshotLTP(allSymbols, fiscalYearId);

    // Group data by sector
    const sectorMap = new Map();
    
    // Process fiscal year balances (held for trading)
    for (const balance of combinedFiscalBalances) {
        const sectorName = balance.stock_fulls.sectors.sector_name;
        const currentLTP = ltpMap.get(balance.symbol) || 0;
        const quantity = sanitizeNumeric(balance.closing_quantity);
        const effectiveRate = sanitizeNumeric(balance.effective_rate);
        const marketValue = quantity * currentLTP;
        const costValue = quantity * effectiveRate;
        const unrealizedGain = marketValue - costValue;

            if (!sectorMap.has(sectorName)) {
                sectorMap.set(sectorName, {
                    sector: sectorName,
                    heldForTrading: 0,
                    heldForMaturity: 0,
                    realizedGain: 0,
                    unrealizedGain: 0
                });
            }

            const sector = sectorMap.get(sectorName);
            sector.heldForTrading += marketValue;
            sector.unrealizedGain += unrealizedGain;
        }

        // Process promoter records (held for maturity)
        for (const promoter of combinedPromoterRecords) {
            const sectorName = promoter.stock_fulls.sectors.sector_name;
            const maturityValue = sanitizeNumeric(promoter.quantity) * sanitizeNumeric(promoter.effective_rate);

            if (!sectorMap.has(sectorName)) {
                sectorMap.set(sectorName, {
                    sector: sectorName,
                    heldForTrading: 0,
                    heldForMaturity: 0,
                    realizedGain: 0,
                    unrealizedGain: 0
                });
            }

            const sector = sectorMap.get(sectorName);
            sector.heldForMaturity += maturityValue;
        }

        // Process sell records (realized gains)
        for (const sell of sellRecords) {
            const sectorName = sell.stock_fulls.sectors.sector_name;
            const realizedGain = sanitizeNumeric(sell.profit_loss);

            if (!sectorMap.has(sectorName)) {
                sectorMap.set(sectorName, {
                    sector: sectorName,
                    heldForTrading: 0,
                    heldForMaturity: 0,
                    realizedGain: 0,
                    unrealizedGain: 0
                });
            }

            const sector = sectorMap.get(sectorName);
            sector.realizedGain += realizedGain;
        }

        // Calculate totals and percentages
        const sectors = Array.from(sectorMap.values());
        const totalPortfolioValue = sectors.reduce((sum, sector) => 
            sum + sector.heldForTrading + sector.heldForMaturity, 0);
        const totalHeldForTrading = sectors.reduce((sum, sector) => sum + sector.heldForTrading, 0);
        const totalHeldForMaturity = sectors.reduce((sum, sector) => sum + sector.heldForMaturity, 0);
        const totalRealizedGain = sectors.reduce((sum, sector) => sum + sector.realizedGain, 0);
        const totalUnrealizedGain = sectors.reduce((sum, sector) => sum + sector.unrealizedGain, 0);

        // Add percentages to each sector
        sectors.forEach(sector => {
            const sectorTotalValue = sector.heldForTrading + sector.heldForMaturity;
            sector.weightagePercent = calculatePercentage(sectorTotalValue, totalPortfolioValue);
            sector.sectorGainPercent = sectorTotalValue > 0 ? 
                calculatePercentage((sector.realizedGain + sector.unrealizedGain), sectorTotalValue) : 0;
        });

        return {
            totalPortfolioValue,
            totalHeldForTrading,
            totalHeldForMaturity,
            totalRealizedGain,
            totalUnrealizedGain,
            sectors: sectors.sort((a, b) => (b.heldForTrading + b.heldForMaturity) - (a.heldForTrading + a.heldForMaturity))
        };
    } catch (error) {
        console.error(`Error getting sector portfolio summary for user ${selectUser} in fiscal year ${fiscalYearId}:`, error);
        return {
            totalPortfolioValue: 0,
            totalHeldForTrading: 0,
            totalHeldForMaturity: 0,
            totalRealizedGain: 0,
            totalUnrealizedGain: 0,
            sectors: []
        };
    }
}

// Get realized gains from sell_records for a specific fiscal year
export async function getRealizedGainsFiscal(selectUser: string, fiscalYearId: number) {
    try {
        if (!selectUser || selectUser.trim() === '') {
            console.error('No user selected for getRealizedGainsFiscal');
            return {
                total_realized_gain: 0,
                sell_records: [],
                error: 'User not specified'
            };
        }

        const sellRecords = await prisma.sell_records.findMany({
            where: {
                fiscal_year_id: fiscalYearId,
                client_broker_mapping: {
                    client_name: selectUser,
                },
            },
            select: {
                symbol: true,
                quantity: true,
                price: true,
                profit_loss: true,
                transaction_date: true,
                stock_fulls: {
                    select: {
                        full_form: true,
                    }
                }
            },
            orderBy: {
                transaction_date: 'desc'
            }
        });

        let totalRealizedGain = 0;
        const processedRecords = sellRecords.map(record => {
            const profitLoss = sanitizeNumeric(record.profit_loss);
            totalRealizedGain += profitLoss;
            
            return {
                ...record,
                quantity: sanitizeNumeric(record.quantity),
                price: sanitizeNumeric(record.price),
                profit_loss: profitLoss
            };
        });

        return {
            total_realized_gain: totalRealizedGain,
            sell_records: processedRecords
        };
    } catch (error) {
        console.error(`Error getting realized gains for user ${selectUser} in fiscal year ${fiscalYearId}:`, error);
        return {
            total_realized_gain: 0,
            sell_records: [],
            error: error instanceof Error ? error.message : 'Failed to get realized gains'
        };
    }
}

// Get stock investment breakdown by individual stocks using fiscal year balance  
export async function getStockInvestmentBreakdownFiscal(selectUser: string, fiscalYearId: number) {
    try {
        // Get trading investments (from fiscal_year_balance)
        const tradingInvestments = await prisma.fiscal_year_balance.findMany({
            where: {
                fiscal_year_id: fiscalYearId,
                client_broker_mapping: {
                    client_name: selectUser,
                },
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

        // Combine trading investments by fund_id, fiscal_year_id, and symbol
        const combinedTradingInvestments = combineHoldingsByFund(tradingInvestments);

        // Get maturity investments (from promoter_records for the same fiscal year)
        const maturityInvestments = await prisma.promoter_records.findMany({
            where: {
                fiscal_year_id: fiscalYearId,
                client_broker_mapping: {
                    client_name: selectUser,
                },
            },
            select: {
                symbol: true,
                quantity: true,
                effective_rate: true,
                fund_id: true,
                stock_fulls: {
                    select: {
                        full_form: true
                    }
                }
            }
        });

        // Combine maturity investments by fund_id and symbol
        const combinedMaturityInvestments = combinePromoterRecordsByFund(maturityInvestments);

        // Get all symbols for batch LTP fetching
        const tradingSymbols = combinedTradingInvestments.map(inv => inv.symbol);
        const ltpMap = await getBatchMarketSnapshotLTP(tradingSymbols, fiscalYearId);

        // Calculate trading stock values using market snapshots
        const tradingStockMap = new Map<string, number>();
        let tradingTotal = 0;

        for (const investment of combinedTradingInvestments) {
            const symbol = investment.symbol;
            const currentLTP = ltpMap.get(symbol) || 0;
            const marketValue = sanitizeNumeric(investment.closing_quantity) * currentLTP;
            
            tradingTotal += marketValue;
            
            // Combine values for same symbol if they exist
            if (tradingStockMap.has(symbol)) {
                tradingStockMap.set(symbol, tradingStockMap.get(symbol)! + marketValue);
            } else {
                tradingStockMap.set(symbol, marketValue);
            }
        }

        // Calculate maturity stock values
        const maturityStockMap = new Map<string, number>();
        let maturityTotal = 0;

        for (const investment of combinedMaturityInvestments) {
            const symbol = investment.symbol;
            const marketValue = sanitizeNumeric(investment.quantity) * sanitizeNumeric(investment.effective_rate);
            
            maturityTotal += marketValue;
            
            // Combine values for same symbol if they exist
            if (maturityStockMap.has(symbol)) {
                maturityStockMap.set(symbol, maturityStockMap.get(symbol)! + marketValue);
            } else {
                maturityStockMap.set(symbol, marketValue);
            }
        }

        // Create trading data array
        const tradingData = Array.from(tradingStockMap.entries()).map(([symbol, value]) => ({
            symbol,
            value,
            percentage: calculatePercentage(value, tradingTotal)
        })).sort((a, b) => b.value - a.value);

        // Create maturity data array 
        const maturityData = Array.from(maturityStockMap.entries()).map(([symbol, value]) => ({
            symbol,
            value,
            percentage: calculatePercentage(value, maturityTotal)
        })).sort((a, b) => b.value - a.value);

        return {
            trading: {
                data: tradingData,
                total: tradingTotal,
                count: combinedTradingInvestments.length
            },
            maturity: {
                data: maturityData,
                total: maturityTotal,
                count: combinedMaturityInvestments.length
            }
        };
    } catch (error) {
        console.error(`Error getting stock investment breakdown for user ${selectUser} in fiscal year ${fiscalYearId}:`, error);
        return {
            trading: { data: [], total: 0, count: 0 },
            maturity: { data: [], total: 0, count: 0 }
        };
    }
}

// Get scrip count from fiscal year balance
export async function getScripCountFiscal(selectUser: string, fiscalYearId: number) {
    try {
        // Get all fiscal year balances and then count unique after combining
        const fiscalBalances = await prisma.fiscal_year_balance.findMany({
            where: {
                fiscal_year_id: fiscalYearId,
                client_broker_mapping: {
                    client_name: selectUser,
                },
            },
            select: {
                symbol: true,
                closing_quantity: true,
                effective_rate: true,
                fund_id: true,
                fiscal_year_id: true
            }
        });
        
        // Combine holdings by fund_id, fiscal_year_id, and symbol
        const combinedHoldings = combineHoldingsByFund(fiscalBalances);
        
        return combinedHoldings.length;
    } catch (error) {
        console.error(`Error getting scrip count for user ${selectUser} in fiscal year ${fiscalYearId}:`, error);
        return 0;
    }
}

// Export wrapped functions that automatically update market snapshots when called
export const getTotalInvestmentFiscal = withMarketSnapshotUpdate(_getTotalInvestmentFiscal);
export const getUnrealizedGainsFiscal = withMarketSnapshotUpdate(_getUnrealizedGainsFiscal);
