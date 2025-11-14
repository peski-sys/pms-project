const microservice_url = process.env.MICROSERVICE_URL

// Cache for LTP calls to reduce redundant API requests
const ltpCache = new Map<string, { value: number; timestamp: number }>();
const CACHE_DURATION = 60000; // 1 minute cache

// Helper function to get current LTP from microservice with caching
export async function getCurrentLTP(symbol: string): Promise<number> {
    const now = Date.now();
    const cached = ltpCache.get(symbol);
    
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
        return cached.value;
    }

    try {
        const response = await fetch(`${microservice_url}/stock/${symbol}`);
        const data = await response.json();
        const ltp = data.ltp || 0;
        
        // Cache the result
        ltpCache.set(symbol, { value: ltp, timestamp: now });
        return ltp;
    } catch (error) {
        console.error(`Error fetching LTP for ${symbol}:`, error);
        return 0;
    }
}

// Batch LTP fetching for multiple symbols - OPTIMIZED
export async function getBatchLTP(symbols: string[]): Promise<Map<string, number>> {
    const uniqueSymbols = [...new Set(symbols)];
    const results = new Map<string, number>();
    
    // Check cache first
    const uncachedSymbols: string[] = [];
    const now = Date.now();
    
    for (const symbol of uniqueSymbols) {
        const cached = ltpCache.get(symbol);
        if (cached && (now - cached.timestamp) < CACHE_DURATION) {
            results.set(symbol, cached.value);
        } else {
            uncachedSymbols.push(symbol);
        }
    }
    
    console.log(`Cache hits: ${uniqueSymbols.length - uncachedSymbols.length}, Cache misses: ${uncachedSymbols.length}`);
    
    // Fetch uncached symbols using batch endpoint
    if (uncachedSymbols.length > 0) {
        try {
            // Use the new batch endpoint for better performance
            const response = await fetch(`${microservice_url}/batchStockPrices/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    symbols: uncachedSymbols
                })
            });
            
            if (!response.ok) {
                throw new Error(`Batch request failed: ${response.status}`);
            }
            
            const batchData = await response.json();
            
            // Process batch results and cache them
            for (const symbol of uncachedSymbols) {
                const ltp = batchData[symbol]?.ltp || 0;
                
                // Cache the result
                ltpCache.set(symbol, { value: ltp, timestamp: now });
                results.set(symbol, ltp);
            }
            
            console.log(`Batch fetched ${uncachedSymbols.length} symbols successfully`);
            
        } catch (error) {
            console.error('Batch LTP fetch failed, falling back to individual requests:', error);
            
            // Fallback to individual requests if batch fails
            const promises = uncachedSymbols.map(async (symbol) => {
                try {
                    const response = await fetch(`${microservice_url}/stock/${symbol}`);
                    const data = await response.json();
                    const ltp = data.ltp || 0;
                    
                    // Cache the result
                    ltpCache.set(symbol, { value: ltp, timestamp: now });
                    return { symbol, ltp };
                } catch (error) {
                    console.error(`Error fetching LTP for ${symbol}:`, error);
                    return { symbol, ltp: 0 };
                }
            });
            
            const fetchResults = await Promise.all(promises);
            fetchResults.forEach(({ symbol, ltp }) => {
                results.set(symbol, ltp);
            });
        }
    }
    
    return results;
}

// Import enhanced decimal utilities
import { FinancialCalculator } from './decimalUtils';

// Utility function to sanitize numeric fields consistently with decimal precision
export function sanitizeNumeric(value: any): number {
    return FinancialCalculator.sanitizeNumeric(value);
}

// Utility function to calculate percentages safely with decimal precision
export function calculatePercentage(part: number, total: number): number {
    return FinancialCalculator.percentage(part, total);
}

// Utility function to aggregate sector data
export function aggregateSectorData<T>(
    data: T[], 
    getSector: (item: T) => string, 
    getValue: (item: T) => number
): Map<string, number> {
    const sectorMap = new Map<string, number>();
    
    data.forEach(item => {
        const sector = getSector(item);
        const value = getValue(item);
        
        if (sectorMap.has(sector)) {
            sectorMap.set(sector, sectorMap.get(sector)! + value);
        } else {
            sectorMap.set(sector, value);
        }
    });
    
    return sectorMap;
}

// Standard data transformation for holdings
export function transformHolding(holding: any) {
    return {
        ...holding,
        cost_price: sanitizeNumeric(holding.cost_price),
        quantity: sanitizeNumeric(holding.quantity),
        total_value: sanitizeNumeric(holding.total_value),
    };
}