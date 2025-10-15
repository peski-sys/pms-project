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

// Batch LTP fetching for multiple symbols
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
    
    // Fetch uncached symbols in parallel
    if (uncachedSymbols.length > 0) {
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