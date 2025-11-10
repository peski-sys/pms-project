"use server"

import { prisma } from "@/lib/db";
import { getBatchLTP, sanitizeNumeric } from "@/lib/apiUtils";
import { getBatchLTPFromMarketSnapshots } from "@/lib/marketSnapshotAutoUpdate";
import { toast } from "sonner";

export type DematHoldingRow = {
  symbol: string;
  company: string;
  dp_name: string;
  boid: string;
  client_id: string;
  client_broker: number;
  demat: number;
  current_balance: number; // demat quantity or quantity
  cost_price: number;
  ltp: number;
  previous_closing_price: number; // as requested, same as ltp
  today_closing_price: number; // ltp
  value_prev_close: number;
  value_ltp: number;
  investment_value: number; // quantity * cost_price
  wacc: number; // using cost price as proxy
  price_margin_percent: number; // (ltp - cost)/cost * 100
  // Additional fields for updates
  fund_id: number;
  fiscal_year_id: number;
};

/**
 * Get current fiscal year ID based on current date
 */
async function getCurrentFiscalYearId(): Promise<number | null> {
  try {
    const currentDate = new Date();
    
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
    });
    
    return fiscalYear?.fiscal_year_id || null;
  } catch (error) {
    toast.error('Error getting current fiscal year');
    return null;
  }
}

/**
 * Get all fiscal years for dropdown selection
 */
export async function getFiscalYears() {
  try {
    const fiscalYears = await prisma.fiscal_years.findMany({
      orderBy: {
        start_date: 'desc'
      },
      select: {
        fiscal_year_id: true,
        year_label: true,
        start_date: true,
        end_date: true
      }
    });
    
    return fiscalYears;
  } catch (error) {
    toast.error('Error getting fiscal years');
    return [];
  }
}

/**
 * Update LTP in market_snapshots table
 */
export async function updateLTPForSymbol(
  symbol: string, 
  fiscalYearId: number, 
  newLTP: number
): Promise<{ success: boolean; message: string }> {
  try {
    // Validate inputs
    if (!symbol || fiscalYearId <= 0 || newLTP < 0) {
      return { success: false, message: 'Invalid input parameters' };
    }

    // Try to update existing record first
    const updated = await prisma.market_snapshots.updateMany({
      where: {
        symbol: symbol,
        fiscal_year_id: fiscalYearId
      },
      data: {
        ltp: newLTP,
        snapshot_date: new Date(),
        recorded_at: new Date()
      }
    });

    // If no record was updated (count = 0), create a new one
    if (updated.count === 0) {
      await prisma.market_snapshots.create({
        data: {
          symbol: symbol,
          fiscal_year_id: fiscalYearId,
          ltp: newLTP,
          snapshot_date: new Date(),
          recorded_at: new Date()
        }
      });
    }

    // Create audit log
    await prisma.audit_log.create({
      data: {
        performed_action: `Updated LTP for ${symbol} in FY ${fiscalYearId} to Rs. ${newLTP}`
      }
    });

    return { success: true, message: `LTP updated successfully for ${symbol}` };
  } catch (error) {
    console.error('Error updating LTP:', error);
    return { success: false, message: 'Failed to update LTP' };
  }
}

/**
 * Update WACC in symbol_holdings table
 */
export async function updateWACCForSymbol(
  symbol: string,
  fundId: number,
  fiscalYearId: number,
  newWACC: number
): Promise<{ success: boolean; message: string }> {
  try {
    // Validate inputs
    if (!symbol || fundId <= 0 || fiscalYearId <= 0 || newWACC < 0) {
      return { success: false, message: 'Invalid input parameters' };
    }

    // Try to update existing record first
    const updated = await prisma.symbol_holdings.updateMany({
      where: {
        symbol: symbol,
        fund_id: fundId,
        fiscal_year_id: fiscalYearId
      },
      data: {
        wacc: newWACC
      }
    });

    // If no record was updated, create a new one
    if (updated.count === 0) {
      await prisma.symbol_holdings.create({
        data: {
          symbol: symbol,
          fund_id: fundId,
          fiscal_year_id: fiscalYearId,
          wacc: newWACC,
          remarks: `WACC updated via Demat Holdings on ${new Date().toISOString()}`
        }
      });
    }

    // Create audit log
    await prisma.audit_log.create({
      data: {
        performed_action: `Updated WACC for ${symbol} (Fund: ${fundId}, FY: ${fiscalYearId}) to Rs. ${newWACC}`
      }
    });

    return { success: true, message: `WACC updated successfully for ${symbol}` };
  } catch (error) {
    console.error('Error updating WACC:', error);
    return { success: false, message: 'Failed to update WACC' };
  }
}

export async function getDematHoldings(clientName: string, fiscalYearId?: number): Promise<DematHoldingRow[]> {
  if (!clientName || clientName.trim() === "") return [];

  // Determine which fiscal year to use
  let targetFiscalYearId: number | undefined = fiscalYearId;
  if (!targetFiscalYearId) {
    const currentFY = await getCurrentFiscalYearId();
    targetFiscalYearId = currentFY ?? undefined;
  }

  if (!targetFiscalYearId) {
    console.error('No fiscal year available for demat holdings query');
    return [];
  }

  // Get holdings from fiscal_year_balance with all required joins
  const holdings = await prisma.fiscal_year_balance.findMany({
    where: {
      client_broker_mapping: {
        client_name: clientName,
      },
      fiscal_year_id: targetFiscalYearId,
      // Only include records where we have some demat quantity
      // demat: {
      //   gt: 0
      // }
    },
    select: {
      symbol: true,
      closing_quantity: true,
      demat: true,
      effective_rate: true,
      client_id: true,
      fund_id: true,
      fiscal_year_id: true,
      client_broker_mapping: {
        select: {
          boid: true,
          client_broker: true,
          client_boid_mapping_client_broker_mapping_boidToclient_boid_mapping: {
            select: {
              dp_name: true,
            },
          },
        },
      },
      stock_fulls: {
        select: {
          full_form: true,
        },
      },
    },
    orderBy: { symbol: "asc" },
  });

  const symbols = holdings.map((h) => h.symbol);
  
  // Get LTP from market snapshots using the fiscal year we already determined
  const ltpMap = await getBatchLTPFromMarketSnapshots(symbols, targetFiscalYearId);

  const rows: DematHoldingRow[] = holdings.map((h, index) => {
    const quantity = sanitizeNumeric(h.closing_quantity) || 0;
    const actual_quantity = sanitizeNumeric(h.demat) || 0;
    const cost = sanitizeNumeric(h.effective_rate) || 0;
    const ltp = ltpMap.get(h.symbol) || 0;
    const prevClose = ltp; // per instructions
    const todayClose = ltp;

    const valuePrev = actual_quantity * prevClose;
    const valueLtp = actual_quantity * ltp;
    const investmentValue = quantity * cost; // Calculate from closing_quantity * effective_rate

    // Get DP name from the client boid mapping
    const dp_name =
      h.client_broker_mapping?.client_boid_mapping_client_broker_mapping_boidToclient_boid_mapping?.dp_name ||
      "-";
    
    // Get BOID and client_broker from client_broker_mapping
    const boid = h.client_broker_mapping?.boid || "-";
    const client_broker = h.client_broker_mapping?.client_broker || 0;

    // Use effective rate (cost) as WACC display value
    const wacc = cost;

    return {
      symbol: h.symbol,
      company: h.stock_fulls.full_form,
      dp_name,
      boid,
      client_id: h.client_id,
      client_broker,
      current_balance: quantity,
      cost_price: cost,
      ltp,
      demat: actual_quantity,
      previous_closing_price: prevClose,
      today_closing_price: todayClose,
      value_prev_close: valuePrev,
      value_ltp: valueLtp,
      investment_value: investmentValue,
      wacc: wacc,
      price_margin_percent: wacc > 0 ? ((ltp - wacc) / wacc) * 100 : 0, // Use effective rate as WACC proxy
      // Additional fields for updates
      fund_id: h.fund_id || 0,
      fiscal_year_id: h.fiscal_year_id,
    };
  });

  return rows;
}
