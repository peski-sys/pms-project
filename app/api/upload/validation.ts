"use server"

import { prisma } from "@/lib/db";

export type InsufficientBalanceError = {
  client_id: string;
  client_name: string;
  symbol: string;
  required_quantity: number;
  available_quantity: number;
  shortfall: number;
  contract_number: string;
};

export type ValidationResult = {
  success: boolean;
  errors?: InsufficientBalanceError[];
  message?: string;
};

/**
 * Validates if all sell records in staging have sufficient quantities available
 * @param upload_id - The upload ID to validate
 * @returns ValidationResult with success status and any insufficient balance errors
 */
export async function validateStagingQuantities(upload_id: number): Promise<ValidationResult> {
  try {
    // Get all sell records from staging for this upload
    const sellRecords = await prisma.sell_records_staging.findMany({
      where: { upload_id },
      include: {
        client_broker_mapping: {
          select: {
            client_name: true,
            fund_id: true
          }
        }
      }
    });

    if (sellRecords.length === 0) {
      return { success: true, message: "No sell records to validate" };
    }

    const errors: InsufficientBalanceError[] = [];

    // Check each sell record for sufficient balance
    for (const sellRecord of sellRecords) {
      // Get current holdings for this client/symbol/fiscal_year
      const currentHoldings = await prisma.fiscal_year_balance.findFirst({
        where: {
          client_id: sellRecord.client_id,
          symbol: sellRecord.symbol,
          fiscal_year_id: sellRecord.fiscal_year_id || undefined,
          fund_id: sellRecord.client_broker_mapping.fund_id
        },
        select: {
          opening_quantity: true,
          added_quantity: true
        }
      });

      const availableQuantity = currentHoldings 
        ? (currentHoldings.opening_quantity || 0) + (currentHoldings.added_quantity || 0)
        : 0;

      const requiredQuantity = sellRecord.quantity;

      if (availableQuantity < requiredQuantity) {
        errors.push({
          client_id: sellRecord.client_id,
          client_name: sellRecord.client_broker_mapping.client_name,
          symbol: sellRecord.symbol,
          required_quantity: requiredQuantity,
          available_quantity: availableQuantity,
          shortfall: requiredQuantity - availableQuantity,
          contract_number: sellRecord.contract_number
        });
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        errors,
        message: `Found ${errors.length} insufficient balance error(s)`
      };
    }

    return { success: true, message: "All quantities validated successfully" };

  } catch (error) {
    console.error("Error validating staging quantities:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown validation error"
    };
  }
}

/**
 * Gets detailed balance information for a specific client/symbol combination
 * @param client_id - Client ID
 * @param symbol - Stock symbol
 * @param fiscal_year_id - Fiscal year ID
 * @param fund_id - Fund ID
 * @returns Detailed balance breakdown
 */
export async function getDetailedBalance(
  client_id: string, 
  symbol: string, 
  fiscal_year_id: number, 
  fund_id: number
) {
  try {
    // Get fiscal year balance
    const fiscalBalance = await prisma.fiscal_year_balance.findFirst({
      where: {
        client_id,
        symbol,
        fiscal_year_id,
        fund_id
      }
    });

    // Get transaction history
    const buyRecords = await prisma.buy_records.findMany({
      where: { client_id, symbol, fiscal_year_id, fund_id },
      select: { quantity: true, price: true, transaction_date: true, contract_number: true }
    });

    const sellRecords = await prisma.sell_records.findMany({
      where: { client_id, symbol, fiscal_year_id, fund_id },
      select: { quantity: true, price: true, transaction_date: true, contract_number: true }
    });

    const bonusRecords = await prisma.bonus_records.findMany({
      where: { client_id, symbol, fiscal_year_id, fund_id },
      select: { quantity: true, bookclose_date: true }
    });

    const rightRecords = await prisma.right_records.findMany({
      where: { client_id, symbol, fiscal_year_id, fund_id },
      select: { quantity: true, effective_rate: true, bookclose_date: true }
    });

    return {
      fiscal_balance: fiscalBalance,
      transactions: {
        buys: buyRecords,
        sells: sellRecords,
        bonus: bonusRecords,
        rights: rightRecords
      }
    };

  } catch (error) {
    console.error("Error getting detailed balance:", error);
    return null;
  }
}
