import { prisma } from '@/lib/db'
import { getBatchLTP } from '@/lib/apiUtils'

/**
 * Get current fiscal year ID based on current date
 */
async function getCurrentFiscalYearId(): Promise<number | null> {
    try {
        const currentDate = new Date()
        
        const fiscalYear = await prisma.fiscal_years.findFirst({
            where: {
                start_date: {
                    lte: currentDate
                },
                end_date: {
                    gte: currentDate
                }
            },
            select: {
                fiscal_year_id: true
            }
        })
        
        return fiscalYear?.fiscal_year_id || null
    } catch (error) {
        console.error('Error getting current fiscal year:', error)
        return null
    }
}

/**
 * Update market snapshots with latest LTP data
 * This function updates the existing market_snapshots table only
 */
export async function updateMarketSnapshotsLTP(): Promise<void> {
    try {
        console.log('Starting market snapshots LTP update...')
        
        const currentFiscalYearId = await getCurrentFiscalYearId()
        if (!currentFiscalYearId) {
            console.log('No current fiscal year found, skipping market snapshots LTP update')
            return
        }

        // Get all unique symbols from fiscal_year_balance
        const fiscalYearSymbols = await prisma.fiscal_year_balance.findMany({
            select: {
                symbol: true
            },
            distinct: ['symbol']
        })

        // Get all unique symbols from symbol_holdings
        const holdingsSymbols = await prisma.symbol_holdings.findMany({
            select: {
                symbol: true
            },
            distinct: ['symbol']
        })

        // Combine and deduplicate symbols
        const allSymbolsSet = new Set([
            ...fiscalYearSymbols.map((s: any) => s.symbol as string),
            ...holdingsSymbols.map((s: any) => s.symbol as string)
        ])
        const allSymbols = Array.from(allSymbolsSet)

        if (allSymbols.length === 0) {
            console.log('No symbols found to update market snapshots')
            return
        }

        console.log(`Updating market snapshots for ${allSymbols.length} symbols`)

        // Fetch current LTP for all symbols
        const ltpMap = await getBatchLTP(allSymbols)

        // Update or insert market snapshots
        const updatePromises = allSymbols.map(async (symbol: string) => {
            const ltp = ltpMap.get(symbol) || 0
            
            try {
                // Try to update existing record first
                const updated = await prisma.market_snapshots.updateMany({
                    where: {
                        symbol: symbol,
                        fiscal_year_id: currentFiscalYearId
                    },
                    data: {
                        ltp: ltp,
                        snapshot_date: new Date(),
                        recorded_at: new Date()
                    }
                })

                // If no record was updated (count = 0), create a new one
                if (updated.count === 0) {
                    await prisma.market_snapshots.create({
                        data: {
                            symbol: symbol,
                            fiscal_year_id: currentFiscalYearId,
                            ltp: ltp,
                            snapshot_date: new Date(),
                            recorded_at: new Date()
                        }
                    })
                    console.log(`Created new market snapshot for ${symbol} with LTP ${ltp}`)
                } else {
                    console.log(`Updated market snapshot for ${symbol} with LTP ${ltp}`)
                }
            } catch (error) {
                console.error(`Error updating/creating market snapshot for symbol ${symbol}:`, error)
            }
        })

        await Promise.all(updatePromises)
        console.log('Market snapshots LTP update completed successfully')

    } catch (error) {
        console.error('Error in updateMarketSnapshotsLTP:', error)
    }
}

/**
 * Lightweight wrapper function to integrate with existing API calls
 * This runs the update in the background without blocking the main API response
 */
export function withMarketSnapshotUpdate<T extends (...args: any[]) => Promise<any>>(
    apiFunction: T
): T {
    const wrappedFunction = async (...args: any[]) => {
        // Trigger market snapshot update in the background (don't await to avoid blocking)
        updateMarketSnapshotsLTP().catch(error => 
            console.error('Background market snapshot update failed:', error)
        )

        // Execute the original API function immediately
        return await apiFunction(...args)
    }

    return wrappedFunction as T
}

/**
 * Get LTP from market snapshots for a specific symbol and fiscal year
 * This is a helper function to retrieve the stored LTP data
 */
export async function getLTPFromMarketSnapshot(symbol: string, fiscalYearId: number): Promise<number> {
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
        })

        return snapshot ? Number(snapshot.ltp) : 0
    } catch (error) {
        console.error(`Error getting LTP from market snapshot for ${symbol}:`, error)
        return 0
    }
}

/**
 * Batch get LTP from market snapshots for multiple symbols
 */
export async function getBatchLTPFromMarketSnapshots(symbols: string[], fiscalYearId: number): Promise<Map<string, number>> {
    const results = new Map<string, number>()
    
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
        })

        snapshots.forEach(snapshot => {
            results.set(snapshot.symbol, Number(snapshot.ltp))
        })

        // For symbols not found in snapshots, return 0
        symbols.forEach(symbol => {
            if (!results.has(symbol)) {
                results.set(symbol, 0)
            }
        })

    } catch (error) {
        console.error('Error getting batch LTP from market snapshots:', error)
        // Return map with all symbols set to 0 on error
        symbols.forEach(symbol => {
            results.set(symbol, 0)
        })
    }

    return results
}