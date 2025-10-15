"use server"

import { prisma } from "@/lib/db";

// Save remarks for trading (fiscal_year_balance per symbol + fiscal year + client)
export async function saveFYBRemarks(params: {
  clientName: string
  fiscalYearId: number
  symbol: string
  remarks: string
}) {
  const { clientName, fiscalYearId, symbol, remarks } = params;
  await prisma.fiscal_year_balance.updateMany({
    where: {
      symbol,
      fiscal_year_id: fiscalYearId,
      client_broker_mapping: { client_name: clientName },
    },
    data: { remarks },
  });
  return { success: true };
}

// Save remarks for promoter_records (per symbol+fiscal+client)
export async function savePromoterRemarks(params: {
  clientName: string
  fiscalYearId: number
  symbol: string
  remarks: string
}) {
  const { clientName, fiscalYearId, symbol, remarks } = params;
  await prisma.promoter_records.updateMany({
    where: {
      symbol,
      fiscal_year_id: fiscalYearId,
      client_broker_mapping: { client_name: clientName },
    },
    data: { remarks },
  });
  return { success: true };
}

// Save remarks for grouped closeout rows in view-ledger (closeout_records)
export async function saveCloseoutRemarks(params: {
  clientName: string
  fiscalYearId: number
  symbol: string
  transactionDate: string // ISO date string; we use day range for closeout_date
  remarks: string
}) {
  const { clientName, fiscalYearId, symbol, transactionDate, remarks } = params;
  const start = new Date(transactionDate);
  const end = new Date(start);
  end.setUTCHours(23, 59, 59, 999);

  await prisma.closeout_records.updateMany({
    where: {
      symbol,
      fiscal_year_id: fiscalYearId,
      closeout_date: { gte: start, lte: end },
      client_broker_mapping: { client_name: clientName },
    },
    data: { remarks },
  });
  return { success: true };
}

// Save remarks for eligible records
export async function saveEligibleRemarks(params: {
  type: 'opening' | 'bonus' | 'rights' | 'promoter'
  // For opening we need previous fiscal year
  previousFiscalYearId?: number
  symbol?: string
  // Direct id for bonus/right/promoter
  bonusId?: number
  rightId?: number
  promoterId?: number
  remarks: string
  clientName?: string
}) {
  const { type, previousFiscalYearId, symbol, bonusId, rightId, promoterId, remarks, clientName } = params;

  if (type === 'opening') {
    if (!previousFiscalYearId || !symbol || !clientName) return { success: false, message: 'Missing keys' };
    await prisma.fiscal_year_balance.updateMany({
      where: {
        fiscal_year_id: previousFiscalYearId,
        symbol,
        client_broker_mapping: { client_name: clientName },
      },
      data: { remarks },
    });
    return { success: true };
  }

  if (type === 'bonus' && typeof bonusId === 'number') {
    await prisma.bonus_records.update({ where: { bonus_id: bonusId }, data: { remarks } });
    return { success: true };
  }

  if (type === 'rights' && typeof rightId === 'number') {
    await prisma.right_records.update({ where: { right_id: rightId }, data: { remarks } });
    return { success: true };
  }

  if (type === 'promoter' && typeof promoterId === 'number') {
    await prisma.promoter_records.update({ where: { promoter_id: promoterId }, data: { remarks } });
    return { success: true };
  }

  return { success: false, message: 'Invalid parameters' };
}

// Save remarks for symbol_holdings (held for trading securities)
export async function saveSymbolHoldingsRemarks(params: {
  clientName: string
  fiscalYearId: number
  symbol: string
  remarks: string
}) {
  const { clientName, fiscalYearId, symbol, remarks } = params;
  
  // First, get the fund_id from the client name
  const clientMapping = await prisma.client_broker_mapping.findFirst({
    where: {
      client_name: clientName
    },
    select: {
      fund_id: true
    }
  });

  if (!clientMapping) {
    return { success: false, message: `No fund mapping found for ${clientName}` };
  }

  await prisma.symbol_holdings.updateMany({
    where: {
      symbol,
      fund_id: clientMapping.fund_id,
      fiscal_year_id: fiscalYearId,
    },
    data: { remarks },
  });
  return { success: true };
}
