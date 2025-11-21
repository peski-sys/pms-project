'use server'

import { prisma } from '@/lib/db'
import { Prisma } from '@/generated/prisma'

export interface StockDistribution {
  client_id: string
  client_name: string
  opening_quantity: number
  added_quantity: number
  total_quantity: number
  effective_rate: number
  total_value: number
}

export interface TransferClient {
  client_id: string
  quantity: number
  transfer_type: 'SOURCE' | 'DESTINATION'
}

/**
 * Get current fiscal year
 */
export async function getCurrentFiscalYear() {
  try {
    const fiscalYears = await prisma.fiscal_years.findMany({
      orderBy: {
        fiscal_year_id: 'desc'
      }
    })
    
    if (fiscalYears.length === 0) {
      return {
        success: false,
        error: 'No fiscal years found'
      }
    }
    
    // Find fiscal year where today falls between start_date and end_date
    const today = new Date()
    const currentFiscalYear = fiscalYears.find(fiscal => {
      const startDate = new Date(fiscal.start_date)
      const endDate = new Date(fiscal.end_date)
      return today >= startDate && today <= endDate
    })
    
    if (currentFiscalYear) {
      return {
        success: true,
        fiscal_year_id: currentFiscalYear.fiscal_year_id,
        fiscal_year: currentFiscalYear.year_label
      }
    }
    
    // If no current fiscal year found, return the most recent one
    return {
      success: true,
      fiscal_year_id: fiscalYears[0].fiscal_year_id,
      fiscal_year: fiscalYears[0].year_label
    }
  } catch (error) {
    console.error('Error fetching current fiscal year:', error)
    return {
      success: false,
      error: 'Failed to fetch current fiscal year'
    }
  }
}

/**
 * Get stock distribution for a fund/fiscal year/symbol
 */
export async function getStockDistribution(
  fundId: number,
  fiscalYearId: number,
  symbol: string
): Promise<{ success: boolean; data?: StockDistribution[]; error?: string }> {
  try {
    const distribution = await prisma.$queryRaw<StockDistribution[]>`
      SELECT * FROM get_stock_distribution(${fundId}, ${fiscalYearId}, ${symbol})
    `
    
    return {
      success: true,
      data: distribution.map(d => ({
        ...d,
        opening_quantity: Number(d.opening_quantity),
        added_quantity: Number(d.added_quantity),
        total_quantity: Number(d.total_quantity),
        effective_rate: Number(d.effective_rate),
        total_value: Number(d.total_value)
      }))
    }
  } catch (error) {
    console.error('Error fetching stock distribution:', error)
    return {
      success: false,
      error: 'Failed to fetch stock distribution'
    }
  }
}

/**
 * Get total fund holdings for a symbol
 */
export async function getFundHoldings(
  fundId: number,
  fiscalYearId: number,
  symbol: string
): Promise<{ success: boolean; total_quantity?: number; error?: string }> {
  try {
    const result = await prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT SUM(opening_quantity + added_quantity) as total
      FROM fiscal_year_balance
      WHERE fund_id = ${fundId}
        AND fiscal_year_id = ${fiscalYearId}
        AND symbol = ${symbol}
    `
    
    const total = result[0]?.total ? Number(result[0].total) : 0
    
    return {
      success: true,
      total_quantity: total
    }
  } catch (error) {
    console.error('Error fetching fund holdings:', error)
    return {
      success: false,
      error: 'Failed to fetch fund holdings'
    }
  }
}

/**
 * Get list of stocks held by a fund in a fiscal year
 */
export async function getFundStocks(
  fundId: number,
  fiscalYearId: number
): Promise<{ success: boolean; stocks?: Array<{ symbol: string; total_quantity: number }>; error?: string }> {
  try {
    const stocks = await prisma.$queryRaw<Array<{ symbol: string; total_quantity: bigint }>>`
      SELECT 
        symbol,
        SUM(opening_quantity + added_quantity) as total_quantity
      FROM fiscal_year_balance
      WHERE fund_id = ${fundId}
        AND fiscal_year_id = ${fiscalYearId}
      GROUP BY symbol
      HAVING SUM(opening_quantity + added_quantity) > 0
      ORDER BY symbol
    `
    
    return {
      success: true,
      stocks: stocks.map(s => ({
        symbol: s.symbol,
        total_quantity: Number(s.total_quantity)
      }))
    }
  } catch (error) {
    console.error('Error fetching fund stocks:', error)
    return {
      success: false,
      error: 'Failed to fetch fund stocks'
    }
  }
}

/**
 * Process stock transfer
 */
export async function processStockTransfer(
  fundId: number,
  fiscalYearId: number,
  symbol: string,
  transfers: TransferClient[],
  initiatedBy?: string,
  remarks?: string
): Promise<{ success: boolean; transfer_id?: number; message?: string; error?: string }> {
  try {
    // Validate transfers
    const sourceQty = transfers
      .filter(t => t.transfer_type === 'SOURCE')
      .reduce((sum, t) => sum + t.quantity, 0)
    
    const destQty = transfers
      .filter(t => t.transfer_type === 'DESTINATION')
      .reduce((sum, t) => sum + t.quantity, 0)
    
    if (sourceQty !== destQty) {
      return {
        success: false,
        error: `Quantity mismatch: Source=${sourceQty}, Destination=${destQty}`
      }
    }
    
    if (sourceQty === 0) {
      return {
        success: false,
        error: 'No quantity to transfer'
      }
    }
    
    // Call the PostgreSQL function
    const result = await prisma.$queryRaw<Array<{
      success: boolean
      transfer_id?: number
      total_quantity?: number
      message?: string
      error?: string
    }>>`
      SELECT * FROM process_stock_transfer(
        ${fundId},
        ${fiscalYearId},
        ${symbol},
        ${JSON.stringify(transfers)}::jsonb,
        ${initiatedBy || null},
        ${remarks || null}
      )
    `
    
    const response = result[0]
    
    console.log('Stock transfer response:', response)
    
    if (!response.success) {
      console.error('Transfer failed from DB function:', response.error)
      return {
        success: false,
        error: response.error || 'Transfer failed'
      }
    }
    
    return {
      success: true,
      transfer_id: response.transfer_id,
      message: response.message || `Successfully transferred ${sourceQty} shares`
    }
  } catch (error) {
    console.error('Error processing stock transfer (exception):', error)
    console.error('Transfer details:', {
      fundId,
      fiscalYearId,
      symbol,
      transfers: JSON.stringify(transfers, null, 2)
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process transfer'
    }
  }
}

/**
 * Get transfer history for a symbol
 */
export async function getTransferHistory(
  fundId: number,
  fiscalYearId: number,
  symbol: string
): Promise<{ success: boolean; transfers?: any[]; error?: string }> {
  try {
    const transfers = await prisma.$queryRaw<any[]>`
      SELECT 
        str.transfer_id,
        str.symbol,
        str.transfer_date,
        str.total_quantity,
        str.status,
        str.remarks,
        str.initiated_by,
        json_agg(
          json_build_object(
            'client_id', std.client_id,
            'quantity', std.quantity,
            'transfer_type', std.transfer_type,
            'from_opening_qty', std.from_opening_qty,
            'from_added_qty', std.from_added_qty,
            'effective_rate', std.effective_rate
          ) ORDER BY std.transfer_type DESC, std.client_id
        ) as details
      FROM stock_transfer_records str
      JOIN stock_transfer_details std ON str.transfer_id = std.transfer_id
      WHERE str.fund_id = ${fundId}
        AND str.fiscal_year_id = ${fiscalYearId}
        AND str.symbol = ${symbol}
      GROUP BY str.transfer_id, str.symbol, str.transfer_date, str.total_quantity, str.status, str.remarks, str.initiated_by
      ORDER BY str.transfer_date DESC
      LIMIT 50
    `
    
    return {
      success: true,
      transfers
    }
  } catch (error) {
    console.error('Error fetching transfer history:', error)
    return {
      success: false,
      error: 'Failed to fetch transfer history'
    }
  }
}

/**
 * Get all clients for a fund
 */
export async function getClientsForFund(fundId: number): Promise<{
  success: boolean
  clients?: Array<{ client_id: string; client_name: string }>
  error?: string
}> {
  try {
    const clients = await prisma.client_broker_mapping.findMany({
      where: {
        fund_id: fundId
      },
      select: {
        client_id: true,
        client_name: true
      },
      orderBy: {
        client_name: 'asc'
      }
    })
    
    return {
      success: true,
      clients
    }
  } catch (error) {
    console.error('Error fetching clients:', error)
    return {
      success: false,
      error: 'Failed to fetch clients'
    }
  }
}
