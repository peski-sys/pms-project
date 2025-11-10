"use server"

import { prisma } from '@/lib/db';
import { getBatchLTP, sanitizeNumeric, calculatePercentage, transformHolding } from '@/lib/apiUtils';
import { getBatchMarketSnapshotLTP } from '@/lib/marketSnapshotUtils';
import { withMarketSnapshotUpdate } from '@/lib/marketSnapshotAutoUpdate';
import { FinancialCalculator } from '@/lib/decimalUtils';
import { toast } from 'sonner';
import { getServerSession } from "next-auth";
import { authConfig } from "@/lib/auth-config";

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

// Helper function to combine holdings by fund_id, fiscal_year_id, and symbol
function combineHoldingsByFund(holdings: any[]): any[] {
    const combinedMap = new Map<string, any>();
    
    holdings.forEach(holding => {
        const key = `${holding.fund_id}_${holding.fiscal_year_id || 'null'}_${holding.symbol}`;
        const quantity = sanitizeNumeric(holding.closing_quantity || 0);
        const rate = sanitizeNumeric(holding.effective_rate || 0);
        const totalValue = FinancialCalculator.multiply(quantity, rate);
        
        if (combinedMap.has(key)) {
            const existing = combinedMap.get(key);
            const existingQuantity = existing.closing_quantity;
            const existingTotalValue = existing.total_cost_value;
            const newTotalQuantity = existingQuantity + quantity;
            const newTotalCostValue = FinancialCalculator.add(existingTotalValue, totalValue);
            
            // Calculate weighted average cost price with decimal precision
            const newAverageRate = newTotalQuantity > 0 ? FinancialCalculator.divide(newTotalCostValue, newTotalQuantity) : 0;
            
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

const microservice_url = process.env.MICROSERVICE_URL

type onlyIndividual = {
    rank: number,
    symbol: string,
    fullForm: string
    ltp: number,
    change: number,
}

type gainLossType = {
    topGainers: onlyIndividual[],
    topLosers: onlyIndividual[],
}

async function _getTotalInvestment(selectUser: string) {
    try {
        if (!selectUser || selectUser.trim() === '') {
            console.log('No user selected for getTotalInvestment');
            return { _sum: { total_value: 0 }, error: 'User not specified' };
        }

        // Get current fiscal year
        const currentDate = new Date();
        const currentFiscalYear = await prisma.fiscal_years.findFirst({
            where: {
                start_date: { lte: currentDate },
                end_date: { gte: currentDate }
            }
        });

        if (!currentFiscalYear) {
            console.log('No current fiscal year found');
            return { _sum: { total_value: 0 }, error: 'No current fiscal year' };
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
            return { _sum: { total_value: 0 }, error: 'No fund mapping found' };
        }

        // Get trading investments from fiscal_year_balance with source_type='TRADING'
        const tradingBalances = await prisma.fiscal_year_balance.findMany({
            where: {
                fiscal_year_id: currentFiscalYear.fiscal_year_id,
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
            const costValue = FinancialCalculator.multiply(closingQty, effectiveRate);
            tradingTotal = FinancialCalculator.add(tradingTotal, costValue);
        });

        // Get promoter investments from promoter_records table (cost value)
        const promoterRecords = await prisma.promoter_records.findMany({
            where: {
                fiscal_year_id: currentFiscalYear.fiscal_year_id,
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
            const costValue = FinancialCalculator.multiply(quantity, effectiveRate);
            promoterTotal = FinancialCalculator.add(promoterTotal, costValue);
        });

        // Get IPO staging records from fiscal_year_balance_staging (cost value)
        const ipoStagingRecords = await prisma.fiscal_year_balance_staging.findMany({
            where: {
                fiscal_year_id: currentFiscalYear.fiscal_year_id,
                fund_id: clientMapping.fund_id
            },
            select: {
                closing_quantity: true,
                effective_rate: true
            }
        });

        // Calculate total from IPO staging records (quantity * effective rate)
        let ipoStagingTotal = 0;
        ipoStagingRecords.forEach(record => {
            const quantity = sanitizeNumeric(record.closing_quantity);
            const rate = sanitizeNumeric(record.effective_rate);
            const costValue = FinancialCalculator.multiply(quantity, rate);
            ipoStagingTotal = FinancialCalculator.add(ipoStagingTotal, costValue);
        });

        // Total Investment = trading total + promoter total + ipo_allotment_staging total_value
        const totalInvestment = FinancialCalculator.add(
            FinancialCalculator.add(tradingTotal, promoterTotal), 
            ipoStagingTotal
        );
        
        return {
            _sum: {
                total_value: totalInvestment
            }
        };
    } catch (error) {
        console.log(`Error getting total investment for user ${selectUser}`);
        return {
            _sum: { total_value: 0 },
            error: error instanceof Error ? error.message : 'Failed to get total investment'
        };
    }
}
export async function getCurrentSessionUser() {
  const session = await getServerSession(authConfig);
  const userObject = session?.user;

  const adminPermission = await prisma.users.findUnique({
    where: {
        user_email: userObject.email
    },
    select: {
        is_admin: true,
    }
  })

  return adminPermission?.is_admin
}

export async function realisedProfitLoss(selectUser: string) {
    try {
        if (!selectUser || selectUser.trim() === '') {
            console.log('No user selected for realised profit/loss');
            return { _sum: { profit_loss: 0 }, error: 'User not specified' };
        }

        // Get current fiscal year
        const currentDate = new Date();
        const currentFiscalYear = await prisma.fiscal_years.findFirst({
            where: {
                start_date: { lte: currentDate },
                end_date: { gte: currentDate }
            }
        });

        if (!currentFiscalYear) {
            return { _sum: { profit_loss: 0 }, error: 'No current fiscal year found' };
        }

        const realised_gain_data = await prisma.sell_records.aggregate({
            where: {
                fiscal_year_id: currentFiscalYear.fiscal_year_id,
                client_broker_mapping: {
                    client_name: selectUser,
                },
            },
            _sum: {
                profit_loss: true
            }
        });
        
        return {
            _sum: {
                profit_loss: sanitizeNumeric(realised_gain_data._sum.profit_loss)
            }
        };
    } catch (error) {
        console.log(`Error getting realised profit/loss for user ${selectUser}`);
        return {
            _sum: { profit_loss: 0 },
            error: error instanceof Error ? error.message : 'Failed to get realised profit/loss'
        };
    }
}

export async function getClients() {

    const clients = await prisma.client_broker_mapping.findMany({
        select: {
            client_name: true,
            client_broker: true,
            client_id: true,
        }
    })

    return clients

}


export async function getUsers() {
    try {
        console.log('Fetching users from client_broker_mapping table...');
        const get_total_users = await prisma.client_broker_mapping.findMany({
            distinct: ["client_name"],
            select: {
                client_name: true,
                client_id: true,
                client_broker: true,
                recorded_at: true,
            },
        });
        
        console.log(`Found ${get_total_users.length} users:`, get_total_users.map(u => u.client_name));
        return get_total_users;
    } catch (error) {
        console.error('Failed to fetch users:', error);
        return [];
    }
}


// Internal function - wrapped with market snapshot update
async function _dashboardHoldings(selectUser: string) {
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

    // Get fiscal year balances for current fiscal year
    const fiscalBalances = await prisma.fiscal_year_balance.findMany({
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
            client_id: true,
            fund_id: true,
            fiscal_year_id: true,
            client_broker_mapping: {
                select: {
                    client_name: true,
                },
            },
            stock_fulls: {
                select: {
                    full_form: true,
                }
            }
        }
    });
    
    // Combine holdings by fund_id, fiscal_year_id, and symbol
    const combinedHoldings = combineHoldingsByFund(fiscalBalances);
    
    // Transform combined fiscal year balance data to match symbol_holdings format
    const transformed = combinedHoldings.map(balance => {
        const quantity = sanitizeNumeric(balance.closing_quantity || 0);
        const costPrice = sanitizeNumeric(balance.effective_rate || 0);
        const totalValue = quantity * costPrice;
        
        return {
            symbol: balance.symbol || '',
            quantity: quantity,
            price_per_share: costPrice,
            total_value: totalValue.toFixed(0),
            demat: quantity, // Assume all are demat for fiscal year
            non_demat: 0,
            client_id: `${balance.fund_id}`, // Use fund_id as identifier since we combined by fund
            fund_id: balance.fund_id || 0,
            client_broker_mapping: balance.client_broker_mapping || { client_name: selectUser },
            stock_fulls: balance.stock_fulls || { full_form: '' }
        };
    });
    
    return transformed;
}

// Internal function - wrapped with market snapshot update
async function _scripCount(selectUser: string) {
    // Get current fiscal year
    const currentDate = new Date();
    const currentFiscalYear = await prisma.fiscal_years.findFirst({
        where: {
            start_date: { lte: currentDate },
            end_date: { gte: currentDate }
        }
    });

    if (!currentFiscalYear) {
        return 0;
    }

    // Get all fiscal year balances and then count unique after combining
    const fiscalBalances = await prisma.fiscal_year_balance.findMany({
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
            fiscal_year_id: true
        }
    });
    
    // Combine holdings by fund_id, fiscal_year_id, and symbol
    const combinedHoldings = combineHoldingsByFund(fiscalBalances);
    
    return combinedHoldings.length;
}

export async function getLatestLTP() {
    try {
        // Import and trigger the market snapshots update
        const { updateMarketSnapshotsLTP } = await import('@/lib/marketSnapshotAutoUpdate');
        await updateMarketSnapshotsLTP();
        
        toast.success('Market snapshots updated successfully');
        return { success: true, message: 'Market snapshots updated' };
    } catch (error) {
        console.log('Failed to update market snapshots');
        return { 
            success: false, 
            message: 'Failed to update market snapshots',
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

// Get unrealized gains/losses with current LTP using batch fetching
// Internal function - wrapped with market snapshot update
async function _getUnrealizedGains(selectUser: string) {
    try {
        if (!selectUser || selectUser.trim() === '') {
            console.log('No user selected for unrealized gains');
            return {
                total_unrealized_gain: 0,
                total_market_value: 0,
                holdings: [],
                error: 'User not specified'
            };
        }

        // Get current fiscal year
        const currentDate = new Date();
        const currentFiscalYear = await prisma.fiscal_years.findFirst({
            where: {
                start_date: { lte: currentDate },
                end_date: { gte: currentDate }
            }
        });

        if (!currentFiscalYear) {
            return {
                total_unrealized_gain: 0,
                total_market_value: 0,
                holdings: []
            };
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
            return {
                total_unrealized_gain: 0,
                total_market_value: 0,
                holdings: []
            };
        }

        // Combine holdings by fund_id, fiscal_year_id, and symbol
        const combinedHoldings = combineHoldingsByFund(holdings);

        // Batch fetch LTP for all symbols using market snapshots
        const symbols = combinedHoldings.map(h => h.symbol);
        const ltpMap = await getBatchMarketSnapshotLTP(symbols, currentFiscalYear.fiscal_year_id);

        let totalUnrealizedGain = 0;
        let totalMarketValue = 0;
        const holdingsWithUnrealized = [];

        for (const holding of combinedHoldings) {
            try {
                const currentLTP = ltpMap.get(holding.symbol) || 0;
                const quantity = sanitizeNumeric(holding.closing_quantity);
                const effectiveRate = sanitizeNumeric(holding.effective_rate);
                const totalValue = quantity * effectiveRate; // Cost value
                const marketValue = quantity * currentLTP;
                const unrealizedGain = marketValue - totalValue;
                
                totalUnrealizedGain += unrealizedGain;
                totalMarketValue += marketValue;
                
                holdingsWithUnrealized.push({
                    ...holding,
                    client_id: `${holding.fund_id}`, // Use fund_id as identifier since we combined by fund
                    closing_quantity: quantity,
                    effective_rate: effectiveRate,
                    price_per_share: effectiveRate,
                    quantity,
                    total_value: totalValue,
                    current_ltp: currentLTP,
                    market_value: marketValue,
                    unrealized_gain: unrealizedGain,
                    unrealized_gain_percent: calculatePercentage(unrealizedGain, totalValue)
                });
            } catch (holdingError) {
                console.log(`Error processing holding for ${holding.symbol}`);
                // Continue with other holdings
            }
        }

        return {
            total_unrealized_gain: totalUnrealizedGain,
            total_market_value: totalMarketValue,
            holdings: holdingsWithUnrealized
        };
    } catch (error) {
        console.log(`Error getting unrealized gains for user ${selectUser}`);
        return {
            total_unrealized_gain: 0,
            total_market_value: 0,
            holdings: [],
            error: error instanceof Error ? error.message : 'Failed to get unrealized gains'
        };
    }
}

// Get investment breakdown by sectors (trading vs maturity) with batch LTP
export async function getInvestmentBreakdown(selectUser: string) {
    // Get all sectors from the database
    const allSectors = await prisma.sectors.findMany({
        select: {
            sector_name: true
        },
        orderBy: {
            sector_name: 'asc'
        }
    });

    // Get current fiscal year
    const currentDate = new Date();
    const currentFiscalYear = await prisma.fiscal_years.findFirst({
        where: {
            start_date: { lte: currentDate },
            end_date: { gte: currentDate }
        }
    });

    if (!currentFiscalYear) {
        return {
            trading: { data: [], total: 0, count: 0 },
            maturity: { data: [], total: 0, count: 0 },
            allSectors: []
        };
    }

    // Get trading investments (from fiscal_year_balance) with selective fields
    const tradingInvestments = await prisma.fiscal_year_balance.findMany({
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

    // Get maturity investments from fiscal_year_balance with source_type='PROMOTER'
    const maturityInvestments = await prisma.fiscal_year_balance.findMany({
        where: {
            fiscal_year_id: currentFiscalYear.fiscal_year_id,
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

    // Get IPO staging records from fiscal_year_balance_staging
    const ipoStagingInvestments = await prisma.fiscal_year_balance_staging.findMany({
        where: {
            fiscal_year_id: currentFiscalYear.fiscal_year_id,
            fund_id: clientMapping.fund_id
        },
        select: {
            symbol: true,
            closing_quantity: true,
            effective_rate: true,
            fund_id: true
        }
    });

    const ipoSymbols = Array.from(new Set(ipoStagingInvestments.map(record => record.symbol))); 
    const ipoStockDetails = ipoSymbols.length > 0
        ? await prisma.stock_fulls.findMany({
            where: {
                symbol: {
                    in: ipoSymbols
                }
            },
            select: {
                symbol: true,
                sector_id: true,
                promoter_sector_id: true,
                sectors: {
                    select: {
                        sector_name: true
                    }
                }
            }
        })
        : [];

    const ipoStockMap = new Map(ipoStockDetails.map(detail => [detail.symbol, detail]));

    // Combine maturity investments by fund_id, fiscal_year_id, and symbol
    const combinedMaturityInvestments = combineHoldingsByFund(maturityInvestments);
    
    // Add IPO staging records to maturity investments
    const ipoStagingMapped = ipoStagingInvestments.map(record => ({
        symbol: record.symbol,
        closing_quantity: sanitizeNumeric(record.closing_quantity),
        effective_rate: sanitizeNumeric(record.effective_rate),
        fund_id: record.fund_id,
        fiscal_year_id: currentFiscalYear.fiscal_year_id,
        stock_fulls: ipoStockMap.get(record.symbol) || {
            sector_id: 0,
            promoter_sector_id: null,
            sectors: { sector_name: "Unclassified" }
        }
    }));
    
    const combinedMaturityWithIPO = [...combinedMaturityInvestments, ...ipoStagingMapped];

    // Get all unique symbols for batch LTP fetching
    const allSymbols = [
        ...combinedTradingInvestments.map(inv => inv.symbol),
        ...combinedMaturityWithIPO.map(inv => inv.symbol)
    ];
    const ltpMap = await getBatchMarketSnapshotLTP(allSymbols, currentFiscalYear.fiscal_year_id);

    // Get promoter sector map for efficient sector name lookup
    const promoterSectorMap = await getPromoterSectorMap();

    // Group trading investments by sector (using cost value for IFRS compliance)
    const tradingSectorMap = new Map<string, number>();
    let tradingTotal = 0;

    for (const investment of combinedTradingInvestments) {
        const sectorName = getCorrectSectorName(investment.stock_fulls, promoterSectorMap);
        const costValue = FinancialCalculator.multiply(sanitizeNumeric(investment.closing_quantity), sanitizeNumeric(investment.effective_rate));
        
        tradingTotal = FinancialCalculator.add(tradingTotal, costValue);
        
        if (tradingSectorMap.has(sectorName)) {
            tradingSectorMap.set(sectorName, FinancialCalculator.add(tradingSectorMap.get(sectorName)!, costValue));
        } else {
            tradingSectorMap.set(sectorName, costValue);
        }
    }

    // Group maturity investments by sector (using cost value for IFRS compliance)
    const maturitySectorMap = new Map<string, number>();
    let maturityTotal = 0;

    for (const investment of combinedMaturityWithIPO) {
        const sectorName = getCorrectSectorName(investment.stock_fulls, promoterSectorMap);
        const costValue = FinancialCalculator.multiply(sanitizeNumeric(investment.closing_quantity), sanitizeNumeric(investment.effective_rate));
        
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
            data: tradingData, // All sectors, not just top 5
            total: tradingTotal,
            count: combinedTradingInvestments.length
        },
        maturity: {
            data: maturityData, // All sectors, not just top 5
            total: maturityTotal,
            count: combinedMaturityWithIPO.length  // Includes IPO staging records
        },
        allSectors: allSectors.map(s => s.sector_name) // List of all sectors
    };
}

// Get investment breakdown by individual stocks with batch LTP
export async function getStockInvestmentBreakdown(selectUser: string) {
    // Get current fiscal year
    const currentDate = new Date();
    const currentFiscalYear = await prisma.fiscal_years.findFirst({
        where: {
            start_date: { lte: currentDate },
            end_date: { gte: currentDate }
        }
    });

    if (!currentFiscalYear) {
        return {
            trading: { data: [], total: 0, count: 0 },
            maturity: { data: [], total: 0, count: 0 }
        };
    }

    // Get trading investments (from fiscal_year_balance) with selective fields
    const tradingInvestments = await prisma.fiscal_year_balance.findMany({
        where: {
            fiscal_year_id: currentFiscalYear.fiscal_year_id,
            client_broker_mapping: {
                client_name: selectUser,
            },
            source_type: "TRADING"
        },
        select: {
            symbol: true,
            closing_quantity: true,
            effective_rate: true,
            fund_id: true,
            fiscal_year_id: true
        }
    });

    // Combine trading investments by fund_id, fiscal_year_id, and symbol
    const combinedTradingInvestments = combineHoldingsByFund(tradingInvestments);

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
            maturity: { data: [], total: 0, count: 0 }
        };
    }

    // Get maturity investments from fiscal_year_balance with source_type='PROMOTER'
    const maturityInvestments = await prisma.fiscal_year_balance.findMany({
        where: {
            fiscal_year_id: currentFiscalYear.fiscal_year_id,
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
            fiscal_year_id: true
        }
    });

    // Get IPO staging records from fiscal_year_balance_staging
    const ipoStagingInvestments = await prisma.fiscal_year_balance_staging.findMany({
        where: {
            fiscal_year_id: currentFiscalYear.fiscal_year_id,
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
        closing_quantity: sanitizeNumeric(record.closing_quantity),
        effective_rate: sanitizeNumeric(record.effective_rate),
        fund_id: record.fund_id,
        fiscal_year_id: currentFiscalYear.fiscal_year_id
    }));
    
    const combinedMaturityWithIPO = [...combinedMaturityInvestments, ...ipoStagingMapped];

    const tradingData = [];
    let tradingTotal = 0;

    for (const investment of combinedTradingInvestments) {
        const costValue = FinancialCalculator.multiply(sanitizeNumeric(investment.closing_quantity), sanitizeNumeric(investment.effective_rate));
        tradingTotal = FinancialCalculator.add(tradingTotal, costValue);
        
        tradingData.push({
            symbol: investment.symbol,
            value: costValue,
            percentage: 0 // Will calculate after getting total
        });
    }

    const maturityData = [];
    let maturityTotal = 0;

    for (const investment of combinedMaturityWithIPO) {
        const costValue = FinancialCalculator.multiply(sanitizeNumeric(investment.closing_quantity), sanitizeNumeric(investment.effective_rate));
        maturityTotal = FinancialCalculator.add(maturityTotal, costValue);
        
        maturityData.push({
            symbol: investment.symbol,
            value: costValue,
            percentage: 0 // Will calculate after getting total
        });
    }

    // Calculate percentages
    tradingData.forEach(item => {
        item.percentage = calculatePercentage(item.value, tradingTotal);
    });

    maturityData.forEach(item => {
        item.percentage = calculatePercentage(item.value, maturityTotal);
    });

    return {
        trading: {
            data: tradingData.sort((a, b) => b.value - a.value), // All stocks sorted by value
            total: tradingTotal,
            count: combinedTradingInvestments.length
        },
        maturity: {
            data: maturityData.sort((a, b) => b.value - a.value), // All stocks sorted by value
            total: maturityTotal,
            count: combinedMaturityWithIPO.length
        }
    };
}

// Get sector allocation with batch LTP
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
            source_type: "TRADING"
        },
        select: {
            symbol: true,
            closing_quantity: true,
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

    // Combine holdings by fund_id, fiscal_year_id, and symbol
    const combinedHoldings = combineHoldingsByFund(holdings);

    // Batch fetch LTP for all symbols
    const symbols = combinedHoldings.map(h => h.symbol);
    const ltpMap = await getBatchMarketSnapshotLTP(symbols, currentFiscalYear.fiscal_year_id);

    // Get promoter sector map for efficient sector name lookup
    const promoterSectorMap = await getPromoterSectorMap();

    const sectorMap = new Map<string, number>();
    let totalValue = 0;

    for (const holding of combinedHoldings) {
        const sectorName = getCorrectSectorName(holding.stock_fulls, promoterSectorMap);
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
        percentage: calculatePercentage(value, totalValue)
    }));

    return sectorAllocation.sort((a, b) => b.value - a.value);
}

// Get comprehensive portfolio analysis with batch LTP
export async function getComprehensivePortfolio(selectUser: string) {
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
            fund_id: true,
            fiscal_year_id: true,
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

    // Combine holdings by fund_id, fiscal_year_id, and symbol
    const combinedHoldings = combineHoldingsByFund(holdings);

    // Get realized gains for each stock from current fiscal year
    const realizedGains = await prisma.sell_records.groupBy({
        by: ['symbol'],
        where: {
            fiscal_year_id: currentFiscalYear.fiscal_year_id,
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

    // Batch fetch LTP for all symbols
    const symbols = combinedHoldings.map(h => h.symbol);
    const ltpMap = await getBatchMarketSnapshotLTP(symbols, currentFiscalYear.fiscal_year_id);

    const portfolioData = [];

    for (const holding of combinedHoldings) {
        const currentLTP = ltpMap.get(holding.symbol) || 0;
        const quantity = sanitizeNumeric(holding.closing_quantity);
        const effectiveRate = sanitizeNumeric(holding.effective_rate);
        const bookValue = FinancialCalculator.multiply(quantity, effectiveRate);
        const marketValue = FinancialCalculator.multiply(quantity, currentLTP);
        const unrealizedPnL = FinancialCalculator.subtract(marketValue, bookValue);
        const pnlPercent = calculatePercentage(unrealizedPnL, bookValue);
        const realizedPnL = realizedGainsMap.get(holding.symbol) || 0;

        portfolioData.push({
            companyName: holding.stock_fulls.full_form,
            code: holding.symbol,
            sector: holding.stock_fulls.sectors.sector_name,
            quantity,
            bookValue,
            pricePerShare: effectiveRate,
            marketRate: currentLTP,
            unrealisedPnL: unrealizedPnL,
            pnlPercent,
            realisedPnL: realizedPnL
        });
    }

    return portfolioData;
}

// Get dividend information
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
        include: {
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
        dividendAmount: Number(dividend.amount)
    }));

    return dividendData;
}

// Get sector-wise portfolio summary with realized/unrealized gains using batch LTP
export async function getSectorPortfolioSummary(selectUser: string) {
    // Get current fiscal year
    const currentDate = new Date();
    const currentFiscalYear = await prisma.fiscal_years.findFirst({
        where: {
            start_date: { lte: currentDate },
            end_date: { gte: currentDate }
        }
    });

    if (!currentFiscalYear) {
        return {
            totalPortfolioValue: 0,
            totalHeldForTrading: 0,
            totalHeldForMaturity: 0,
            totalRealizedGain: 0,
            totalUnrealizedGain: 0,
            sectors: []
        };
    }

    // Get holdings with sector information - selective fields only
    const holdings = await prisma.fiscal_year_balance.findMany({
        where: {
            fiscal_year_id: currentFiscalYear.fiscal_year_id,
            client_broker_mapping: {
                client_name: selectUser,
            },
            source_type: "TRADING"
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

    // Combine holdings by fund_id, fiscal_year_id, and symbol
    const combinedHoldings = combineHoldingsByFund(holdings);

    // Get realized gains by sector - selective fields only
    const realizedGains = await prisma.sell_records.findMany({
        where: {
            fiscal_year_id: currentFiscalYear.fiscal_year_id,
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

    // Get maturity holdings for complete portfolio view - selective fields only
    const maturityHoldings = await prisma.promoter_records.findMany({
        where: {
            fiscal_year_id: currentFiscalYear.fiscal_year_id,
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

    // Combine maturity holdings by fund_id and symbol
    const combinedMaturityHoldings = combinePromoterRecordsByFund(maturityHoldings);

    // Batch fetch LTP for all unique symbols
    const allSymbols = [
        ...combinedHoldings.map(h => h.symbol),
        ...combinedMaturityHoldings.map(h => h.symbol)
    ];
    const ltpMap = await getBatchMarketSnapshotLTP(allSymbols, currentFiscalYear.fiscal_year_id);

    // Get promoter sector map for efficient sector name lookup
    const promoterSectorMap = await getPromoterSectorMap();

    const sectorSummary = new Map<string, {
        sector: string,
        heldForTrading: number,
        heldForMaturity: number,
        realizedGain: number,
        unrealizedGain: number
    }>();
    
    let totalHeldForTrading = 0;
    let totalHeldForMaturity = 0;
    let totalRealizedGain = 0;
    let totalUnrealizedGain = 0;

    // Process trading holdings (use cost value for heldForTrading; compute unrealized gain using LTP - cost)
    for (const holding of combinedHoldings) {
        const sectorName = getCorrectSectorName(holding.stock_fulls, promoterSectorMap);
        const quantity = sanitizeNumeric(holding.closing_quantity);
        const effectiveRate = sanitizeNumeric(holding.effective_rate);
        const costValue = quantity * effectiveRate;

        // Fetch LTP only to compute unrealized gain
        const currentLTP = ltpMap.get(holding.symbol) || 0;
        const marketValue = quantity * currentLTP;
        const unrealizedGain = marketValue - costValue;
        
        totalHeldForTrading += costValue;
        totalUnrealizedGain += unrealizedGain;

        if (!sectorSummary.has(sectorName)) {
            sectorSummary.set(sectorName, {
                sector: sectorName,
                heldForTrading: 0,
                heldForMaturity: 0,
                realizedGain: 0,
                unrealizedGain: 0
            });
        }

        const sectorData = sectorSummary.get(sectorName)!;
        sectorData.heldForTrading += costValue;
        sectorData.unrealizedGain += unrealizedGain;
    }

    // Process maturity holdings (use cost value)
    for (const holding of combinedMaturityHoldings) {
        const sectorName = getCorrectSectorName(holding.stock_fulls, promoterSectorMap);
        const costValue = sanitizeNumeric(holding.quantity) * sanitizeNumeric(holding.effective_rate);
        
        totalHeldForMaturity += costValue;

        if (!sectorSummary.has(sectorName)) {
            sectorSummary.set(sectorName, {
                sector: sectorName,
                heldForTrading: 0,
                heldForMaturity: 0,
                realizedGain: 0,
                unrealizedGain: 0
            });
        }

        const sectorData = sectorSummary.get(sectorName)!;
        sectorData.heldForMaturity += costValue;
    }

    // Process realized gains
    for (const sale of realizedGains) {
        const sectorName = getCorrectSectorName(sale.stock_fulls, promoterSectorMap);
        const realizedGain = sanitizeNumeric(sale.profit_loss);
        
        totalRealizedGain += realizedGain;

        if (sectorSummary.has(sectorName)) {
            const sectorData = sectorSummary.get(sectorName)!;
            sectorData.realizedGain += realizedGain;
        }
    }

    // Calculate percentages and create final array
    const totalPortfolioValue = totalHeldForTrading + totalHeldForMaturity;
    const sectorArray = Array.from(sectorSummary.values()).map(sector => {
        const totalSectorValue = sector.heldForTrading + sector.heldForMaturity;
        const weightagePercent = calculatePercentage(totalSectorValue, totalPortfolioValue);
        const sectorGainLoss = sector.realizedGain + sector.unrealizedGain;
        const sectorGainPercent = calculatePercentage(sectorGainLoss, totalSectorValue);

        return {
            ...sector,
            weightagePercent,
            sectorGainPercent
        };
    });

    // Sort by weightage (highest first)
    sectorArray.sort((a, b) => b.weightagePercent - a.weightagePercent);

    return {
        totalPortfolioValue,
        totalHeldForTrading,
        totalHeldForMaturity,
        totalRealizedGain,
        totalUnrealizedGain,
        sectors: sectorArray
    };
}

// Get investment highlights data (IFRS-compliant)
export async function getInvestmentHighlights(selectUser: string) {
    // Get current fiscal year
    const currentDate = new Date();
    const currentFiscalYear = await prisma.fiscal_years.findFirst({
        where: {
            start_date: { lte: currentDate },
            end_date: { gte: currentDate }
        }
    });

    if (!currentFiscalYear) {
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
            fiscal_year_id: currentFiscalYear.fiscal_year_id,
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
        const costValue = FinancialCalculator.multiply(closingQty, effectiveRate);
        tradingValue = FinancialCalculator.add(tradingValue, costValue);
    }

    // Get promoter investments from promoter_records table (cost value)
    const promoterRecords = await prisma.promoter_records.findMany({
        where: {
            fiscal_year_id: currentFiscalYear.fiscal_year_id,
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
        const costValue = FinancialCalculator.multiply(quantity, effectiveRate);
        promoterValue = FinancialCalculator.add(promoterValue, costValue);
    }

    // Get IPO staging records from fiscal_year_balance_staging (cost value)
    const ipoStagingRecords = await prisma.fiscal_year_balance_staging.findMany({
        where: {
            fiscal_year_id: currentFiscalYear.fiscal_year_id,
            fund_id: clientMapping.fund_id
        },
        select: {
            closing_quantity: true,
            effective_rate: true
        }
    });

    // Calculate IPO staging total using quantity * effective rate
    let ipoStagingValue = 0;
    for (const record of ipoStagingRecords) {
        const quantity = sanitizeNumeric(record.closing_quantity);
        const rate = sanitizeNumeric(record.effective_rate);
        const costValue = FinancialCalculator.multiply(quantity, rate);
        ipoStagingValue = FinancialCalculator.add(ipoStagingValue, costValue);
    }

    // Calculate totals
    const maturityValue = FinancialCalculator.add(promoterValue, ipoStagingValue);
    const totalInvestment = FinancialCalculator.add(tradingValue, maturityValue);
    
    // Get realized gains (only for trading securities)
    const realizedGains = await prisma.sell_records.aggregate({
        where: {
            fiscal_year_id: currentFiscalYear.fiscal_year_id,
            client_broker_mapping: {
                client_name: selectUser,
            },
        },
        _sum: {
            profit_loss: true
        }
    });
    
    // Get unrealized gains (only for trading securities)
    const unrealizedData = await getUnrealizedGains(selectUser);
    
    // Get dividend income filtered by current fiscal year
    const dividends = await prisma.cash_records.aggregate({
        where: {
            fiscal_year_id: currentFiscalYear.fiscal_year_id,
            client_broker_mapping: {
                client_name: selectUser,
            },
        },
        _sum: {
            amount: true
        }
    });
    
    const dividendIncome = Number(dividends._sum.amount || 0);
    const realizedGain = Number(realizedGains._sum.profit_loss || 0);
    const unrealizedGain = unrealizedData.total_unrealized_gain;
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
}

// Export wrapped functions that automatically update market snapshots when called
export const getTotalInvestment = withMarketSnapshotUpdate(_getTotalInvestment);
export const dashboardHoldings = withMarketSnapshotUpdate(_dashboardHoldings);
export const scripCount = withMarketSnapshotUpdate(_scripCount);
export const getUnrealizedGains = withMarketSnapshotUpdate(_getUnrealizedGains);

