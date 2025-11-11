"use server"

import { prisma } from '@/lib/db';
import { sanitizeNumeric, calculatePercentage } from '@/lib/apiUtils';
import { getMarketSnapshotLTP, getBatchMarketSnapshotLTP } from '@/lib/marketSnapshotUtils';
import { withMarketSnapshotUpdate } from '@/lib/marketSnapshotAutoUpdate';
import { FinancialCalculator } from '@/lib/decimalUtils';

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

// Helper function to batch fetch promoter sectors and create a map
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
            return { total_investment: 0, error: 'No fund mapping found' };
        }

        // Get trading investments from fiscal_year_balance with source_type='TRADING'
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
            }
        });

        // Calculate total from trading balances (cost value)
        let tradingTotal = 0;
        tradingBalances.forEach(balance => {
            const closingQty = sanitizeNumeric(balance.closing_quantity);
            const effectiveRate = sanitizeNumeric(balance.effective_rate);
            const costValue = closingQty * effectiveRate;
            tradingTotal += costValue;
        });

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

        // Calculate total from promoter records (cost value)
        let promoterTotal = 0;
        promoterRecords.forEach(record => {
            const quantity = sanitizeNumeric(record.quantity);
            const effectiveRate = sanitizeNumeric(record.effective_rate);
            const costValue = quantity * effectiveRate;
            promoterTotal += costValue;
        });

        // Get IPO allotment staging records from fiscal_year_balance_staging
        const ipoStagingRecords = await prisma.fiscal_year_balance_staging.findMany({
            where: {
                fiscal_year_id: fiscalYearId,
                fund_id: clientMapping.fund_id
            },
            select: {
                closing_quantity: true,
                effective_rate: true
            }
        });

        // Calculate total from IPO staging records
        let ipoStagingTotal = 0;
        ipoStagingRecords.forEach(record => {
            const quantity = sanitizeNumeric(record.closing_quantity);
            const rate = sanitizeNumeric(record.effective_rate);
            const totalValue = quantity * rate;
            ipoStagingTotal += totalValue;
        });

        // Total Investment = trading total + promoter total + fiscal_year_balance_staging total_value
        const totalInvestment = tradingTotal + promoterTotal + ipoStagingTotal;

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
                source_type: "TRADING",
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
        // Get all sectors from the database, excluding sector_id=14
        const allSectors = await prisma.sectors.findMany({
            where: {
                sector_id: {
                    not: 14
                }
            },
            select: {
                sector_name: true
            },
            orderBy: {
                sector_name: 'asc'
            }
        });

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
                trading: { data: [], total: 0, count: 0 },
                maturity: { data: [], total: 0, count: 0 },
                allSectors: []
            };
        }

        // Get trading investments (from fiscal_year_balance with source_type='TRADING')
        const tradingInvestments = await prisma.fiscal_year_balance.findMany({
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
                fund_id: true,
                fiscal_year_id: true,
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

        // Combine trading investments by fund_id, fiscal_year_id, and symbol
        const combinedTradingInvestments = combineHoldingsByFund(tradingInvestments);

        // Get maturity investments from fiscal_year_balance with source_type='PROMOTER'
        const maturityInvestments = await prisma.fiscal_year_balance.findMany({
            where: {
                fiscal_year_id: fiscalYearId,
                client_broker_mapping: {
                    client_name: selectUser,
                },
                source_type: "PROMOTER",
            },
            select: {
                symbol: true,
                closing_quantity: true,
                effective_rate: true,
                fund_id: true,
                fiscal_year_id: true,
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

        // Get IPO allotment staging records for maturity from fiscal_year_balance_staging
        const ipoStagingInvestments = await prisma.fiscal_year_balance_staging.findMany({
            where: {
                fiscal_year_id: fiscalYearId,
                fund_id: clientMapping.fund_id
            },
            select: {
                symbol: true,
                closing_quantity: true,
                effective_rate: true,
                fund_id: true
            }
        });

        // Combine maturity investments by fund_id, fiscal_year_id, and symbol
        const combinedMaturityInvestments = combineHoldingsByFund(maturityInvestments);
        
        // Add IPO staging records to maturity investments
        const ipoStagingMapped = ipoStagingInvestments.map(record => ({
            symbol: record.symbol,
            closing_quantity: record.closing_quantity,
            effective_rate: record.effective_rate,
            fund_id: record.fund_id,
            fiscal_year_id: fiscalYearId
        }));
        
        const combinedMaturityWithIPO = [...combinedMaturityInvestments, ...ipoStagingMapped];

    // Get promoter sector map for efficient sector name lookup
    const promoterSectorMap = await getPromoterSectorMap();

    // Calculate trading sector values using cost value (for IFRS compliance)
    const tradingSectorMap = new Map<string, number>();
    let tradingTotal = 0;

    for (const investment of combinedTradingInvestments) {
        const sectorName = getCorrectSectorName(investment.stock_fulls, promoterSectorMap);
        const costValue = FinancialCalculator.multiply(
            sanitizeNumeric(investment.closing_quantity), 
            sanitizeNumeric(investment.effective_rate)
        );
        
        tradingTotal = FinancialCalculator.add(tradingTotal, costValue);
        
        if (tradingSectorMap.has(sectorName)) {
            tradingSectorMap.set(sectorName, FinancialCalculator.add(tradingSectorMap.get(sectorName)!, costValue));
        } else {
            tradingSectorMap.set(sectorName, costValue);
        }
    }

        // Calculate maturity sector values using cost value (for IFRS compliance)
        // Includes IPO staging records with their effective_rate
        const maturitySectorMap = new Map<string, number>();
        let maturityTotal = 0;

        for (const investment of combinedMaturityWithIPO) {
            const sectorName = getCorrectSectorName(investment.stock_fulls, promoterSectorMap);
            // Use effective_rate from IPO staging records (already included in combinedMaturityWithIPO)
            const costValue = FinancialCalculator.multiply(
                sanitizeNumeric(investment.closing_quantity), 
                sanitizeNumeric(investment.effective_rate)
            );
            
            maturityTotal = FinancialCalculator.add(maturityTotal, costValue);
            
            if (maturitySectorMap.has(sectorName)) {
                maturitySectorMap.set(sectorName, FinancialCalculator.add(maturitySectorMap.get(sectorName)!, costValue));
            } else {
                maturitySectorMap.set(sectorName, costValue);
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
                count: combinedMaturityWithIPO.length
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
                source_type: true,
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
            select: {
                symbol: true,
                profit_loss: true,
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

        // Get fund_id for IPO staging records
        const clientMapping = await prisma.client_broker_mapping.findFirst({
            where: {
                client_name: selectUser
            },
            select: {
                fund_id: true
            }
        });

        // Get IPO allotment staging records for maturity from fiscal_year_balance_staging
        const ipoStagingRecords = clientMapping ? await prisma.fiscal_year_balance_staging.findMany({
            where: {
                fiscal_year_id: fiscalYearId,
                fund_id: clientMapping.fund_id
            },
            select: {
                symbol: true,
                closing_quantity: true,
                effective_rate: true,
                fund_id: true
            }
        }) : [];

    // Get promoter sector map for efficient sector name lookup
    const promoterSectorMap = await getPromoterSectorMap();

    // Batch fetch stock_fulls data for IPO staging records (to get sector info)
    const ipoSymbols = ipoStagingRecords.map(r => r.symbol);
    const stockFullsMap = new Map();
    if (ipoSymbols.length > 0) {
        const stockFullsData = await prisma.stock_fulls.findMany({
            where: { symbol: { in: ipoSymbols } },
            select: {
                symbol: true,
                sector_id: true,
                promoter_sector_id: true,
                sectors: {
                    select: { sector_name: true }
                }
            }
        });
        stockFullsData.forEach(sf => stockFullsMap.set(sf.symbol, sf));
    }

    // Batch fetch LTP for all symbols (for unrealized gain calculation)
    const allSymbols = [
        ...combinedFiscalBalances.map(b => b.symbol)
    ];
    const ltpMap = await getBatchMarketSnapshotLTP(allSymbols, fiscalYearId);

    // Group data by sector
    const sectorMap = new Map();
    
    // Process fiscal year balances (both trading and maturity from fiscal_year_balance)
    for (const balance of combinedFiscalBalances) {
        const sectorName = getCorrectSectorName(balance.stock_fulls, promoterSectorMap);
        const quantity = sanitizeNumeric(balance.closing_quantity);
        const effectiveRate = sanitizeNumeric(balance.effective_rate);
        const costValue = quantity * effectiveRate;
        
        // Calculate unrealized gain only for trading
        let unrealizedGain = 0;
        if (balance.source_type === 'TRADING') {
            const currentLTP = ltpMap.get(balance.symbol) || 0;
            const marketValue = quantity * currentLTP;
            unrealizedGain = marketValue - costValue;
        }

            if (!sectorMap.has(sectorName)) {
                sectorMap.set(sectorName, {
                    sector: sectorName,
                    heldForTrading: 0,
                    heldForMaturity: 0,
                    tradingCostValue: 0,
                    maturityCostValue: 0,
                    realizedGain: 0,
                    unrealizedGain: 0
                });
            }

            const sector = sectorMap.get(sectorName);
            // Separate by source_type: TRADING vs PROMOTER
            if (balance.source_type === 'TRADING') {
                sector.heldForTrading += costValue; // Use cost value (effective_rate)
                sector.tradingCostValue += costValue; // Track cost value for G/L% calculation
                sector.unrealizedGain += unrealizedGain;
            } else if (balance.source_type === 'PROMOTER') {
                // Maturity holdings from fiscal_year_balance with source_type='PROMOTER'
                sector.heldForMaturity += costValue; // Use cost value for maturity
                sector.maturityCostValue += costValue; // Track cost value for G/L% calculation
            }
        }

        // Process IPO staging records (maturity holdings)
        for (const ipoRecord of ipoStagingRecords) {
            const stockFulls = stockFullsMap.get(ipoRecord.symbol);
            if (!stockFulls) continue; // Skip if stock info not found
            
            const sectorName = getCorrectSectorName(stockFulls, promoterSectorMap);
            const maturityValue = sanitizeNumeric(ipoRecord.closing_quantity) * sanitizeNumeric(ipoRecord.effective_rate);

            if (!sectorMap.has(sectorName)) {
                sectorMap.set(sectorName, {
                    sector: sectorName,
                    heldForTrading: 0,
                    heldForMaturity: 0,
                    tradingCostValue: 0,
                    maturityCostValue: 0,
                    realizedGain: 0,
                    unrealizedGain: 0
                });
            }

            const sector = sectorMap.get(sectorName);
            sector.heldForMaturity += maturityValue;
            sector.maturityCostValue += maturityValue; // Track cost value for G/L% calculation
        }

        // Process sell records (realized gains)
        for (const sell of sellRecords) {
            const sectorName = getCorrectSectorName(sell.stock_fulls, promoterSectorMap);
            const realizedGain = sanitizeNumeric(sell.profit_loss);

            if (!sectorMap.has(sectorName)) {
                sectorMap.set(sectorName, {
                    sector: sectorName,
                    heldForTrading: 0,
                    heldForMaturity: 0,
                    tradingCostValue: 0,
                    maturityCostValue: 0,
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
            const sectorTotalCostValue = sector.tradingCostValue + sector.maturityCostValue;
            sector.weightagePercent = calculatePercentage(sectorTotalValue, totalPortfolioValue);
            // Calculate G/L% based on cost value, not market value
            sector.sectorGainPercent = sectorTotalCostValue > 0 ? 
                calculatePercentage((sector.realizedGain + sector.unrealizedGain), sectorTotalCostValue) : 0;
            // Remove internal tracking fields before returning
            delete sector.tradingCostValue;
            delete sector.maturityCostValue;
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
