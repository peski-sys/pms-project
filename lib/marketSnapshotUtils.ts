import { prisma } from '@/lib/db';
import { sanitizeNumeric } from '@/lib/apiUtils';

/**
 * Get LTP (Last Traded Price) for a specific symbol in a fiscal year from market snapshots
 */
export async function getMarketSnapshotLTP(symbol: string, fiscalYearId: number): Promise<number> {
    try {
        const snapshot = await prisma.market_snapshots.findUnique({
            where: {
                symbol_fiscal_year_id: {
                    symbol: symbol,
                    fiscal_year_id: fiscalYearId
                }
            },
            select: {
                ltp: true
            }
        });

        return snapshot ? sanitizeNumeric(snapshot.ltp) : 0;
    } catch (error) {
        console.error(`Error fetching LTP for ${symbol} in fiscal year ${fiscalYearId}:`, error);
        return 0;
    }
}

/**
 * Get LTP for multiple symbols in a specific fiscal year (batch fetch)
 */
export async function getBatchMarketSnapshotLTP(symbols: string[], fiscalYearId: number): Promise<Map<string, number>> {
    const ltpMap = new Map<string, number>();
    
    try {
        const snapshots = await prisma.market_snapshots.findMany({
            where: {
                symbol: {
                    in: symbols
                },
                fiscal_year_id: fiscalYearId
            },
            select: {
                symbol: true,
                ltp: true
            }
        });

        snapshots.forEach(snapshot => {
            ltpMap.set(snapshot.symbol, sanitizeNumeric(snapshot.ltp));
        });

        // Set 0 for symbols that don't have snapshots
        symbols.forEach(symbol => {
            if (!ltpMap.has(symbol)) {
                ltpMap.set(symbol, 0);
            }
        });

        return ltpMap;
    } catch (error) {
        console.error(`Error batch fetching LTP for fiscal year ${fiscalYearId}:`, error);
        // Return map with all symbols set to 0 on error
        symbols.forEach(symbol => {
            ltpMap.set(symbol, 0);
        });
        return ltpMap;
    }
}

/**
 * Get all market snapshots for a specific fiscal year
 */
export async function getAllMarketSnapshotsForFiscalYear(fiscalYearId: number) {
    try {
        const snapshots = await prisma.market_snapshots.findMany({
            where: {
                fiscal_year_id: fiscalYearId
            },
            select: {
                symbol: true,
                ltp: true,
                fiscal_year_id: true
            },
            orderBy: {
                symbol: 'asc'
            }
        });

        return snapshots.map(snapshot => ({
            symbol: snapshot.symbol,
            ltp: sanitizeNumeric(snapshot.ltp),
            fiscal_year_id: snapshot.fiscal_year_id
        }));
    } catch (error) {
        console.error(`Error fetching all market snapshots for fiscal year ${fiscalYearId}:`, error);
        return [];
    }
}

/**
 * Check if market snapshot exists for a symbol in a fiscal year
 */
export async function hasMarketSnapshot(symbol: string, fiscalYearId: number): Promise<boolean> {
    try {
        const snapshot = await prisma.market_snapshots.findUnique({
            where: {
                symbol_fiscal_year_id: {
                    symbol: symbol,
                    fiscal_year_id: fiscalYearId
                }
            },
            select: {
                symbol: true
            }
        });

        return !!snapshot;
    } catch (error) {
        console.error(`Error checking market snapshot for ${symbol} in fiscal year ${fiscalYearId}:`, error);
        return false;
    }
}

/**
 * Get market snapshot summary statistics for a fiscal year
 */
export async function getMarketSnapshotSummary(fiscalYearId: number) {
    try {
        const summaryData = await prisma.market_snapshots.aggregate({
            where: {
                fiscal_year_id: fiscalYearId
            },
            _count: {
                symbol: true
            },
            _avg: {
                ltp: true
            },
            _max: {
                ltp: true
            },
            _min: {
                ltp: true
            }
        });

        return {
            total_symbols: summaryData._count.symbol,
            average_ltp: sanitizeNumeric(summaryData._avg.ltp),
            max_ltp: sanitizeNumeric(summaryData._max.ltp),
            min_ltp: sanitizeNumeric(summaryData._min.ltp)
        };
    } catch (error) {
        console.error(`Error getting market snapshot summary for fiscal year ${fiscalYearId}:`, error);
        return {
            total_symbols: 0,
            average_ltp: 0,
            max_ltp: 0,
            min_ltp: 0
        };
    }
}