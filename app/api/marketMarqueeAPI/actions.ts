'use server'

import { prisma } from '@/lib/db'

export type MarketSnapshot = {
  symbol: string
  ltp: number
}

/**
 * Get current fiscal year based on today's date
 */
export async function getCurrentFiscalYear() {
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
        fiscal_year_id: true,
        year_label: true
      }
    })
    
    return fiscalYear
  } catch (error) {
    console.error('Error fetching current fiscal year:', error)
    return null
  }
}

/**
 * Get market snapshots for marquee display
 */
export async function getMarketSnapshotsForMarquee(): Promise<MarketSnapshot[]> {
  try {
    // Get current fiscal year
    const currentFiscalYear = await getCurrentFiscalYear()
    
    if (!currentFiscalYear) {
      console.error('No current fiscal year found')
      return []
    }
    
    // Fetch market snapshots for current fiscal year
    const snapshots = await prisma.market_snapshots.findMany({
      where: {
        fiscal_year_id: currentFiscalYear.fiscal_year_id,
        ltp: {
          gt: 0 // Only include stocks with valid LTP
        }
      },
      select: {
        symbol: true,
        ltp: true
      },
      orderBy: {
        symbol: 'asc'
      },
      take: 50 // Limit to 50 stocks for performance
    })
    
    return snapshots.map((snapshot: { symbol: string; ltp: any }) => ({
      symbol: snapshot.symbol,
      ltp: Number(snapshot.ltp) // Convert Decimal to number
    }))
  } catch (error) {
    console.error('Error fetching market snapshots for marquee:', error)
    return []
  }
}
