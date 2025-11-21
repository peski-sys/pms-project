"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

// Fetch all bonus records or by specific fund and fiscal year
export async function getBonusRecords(fundName?: string, fiscalYearId?: number) {
  try {
    const whereConditions: any = {};
    
    if (fundName) {
      whereConditions.funds = {
        fund_name: fundName
      };
    }
    
    if (fiscalYearId) {
      whereConditions.fiscal_year_id = fiscalYearId;
    }

    const records = await prisma.bonus_records.findMany({
      where: whereConditions,
      include: {
        client_broker_mapping: {
          select: {
            client_name: true,
            client_id: true
          }
        },
        stock_fulls: {
          select: {
            symbol: true,
            full_form: true
          }
        },
        funds: {
          select: {
            fund_name: true
          }
        },
        fiscal_years: {
          select: {
            year_label: true
          }
        }
      },
      orderBy: {
        bookclose_date: 'desc'
      }
    });

    return records.map(record => ({
      ...record,
      bonus_percent: Number(record.bonus_percent),
      effective_rate: Number(record.effective_rate)
    }));
  } catch (error) {
    console.error('Error fetching bonus records:', error);
    throw new Error('Failed to fetch bonus records');
  }
}

// Fetch all promoter records or by specific fund and fiscal year
export async function getPromoterRecords(fundName?: string, fiscalYearId?: number) {
  try {
    const whereConditions: any = {};
    
    if (fundName) {
      whereConditions.funds = {
        fund_name: fundName
      };
    }
    
    if (fiscalYearId) {
      whereConditions.fiscal_year_id = fiscalYearId;
    }

    const records = await prisma.promoter_records.findMany({
      where: whereConditions,
      include: {
        client_broker_mapping: {
          select: {
            client_name: true,
            client_id: true
          }
        },
        stock_fulls: {
          select: {
            symbol: true,
            full_form: true
          }
        },
        funds: {
          select: {
            fund_name: true
          }
        },
        fiscal_years: {
          select: {
            year_label: true
          }
        }
      },
      orderBy: {
        recorded_at: 'desc'
      }
    });

    return records.map(record => ({
      ...record,
      effective_rate: Number(record.effective_rate),
      total_value: Number(record.total_value)
    }));
  } catch (error) {
    console.error('Error fetching promoter records:', error);
    throw new Error('Failed to fetch promoter records');
  }
}

// Fetch all right records or by specific fund and fiscal year
export async function getRightRecords(fundName?: string, fiscalYearId?: number) {
  try {
    const whereConditions: any = {};
    
    if (fundName) {
      whereConditions.funds = {
        fund_name: fundName
      };
    }
    
    if (fiscalYearId) {
      whereConditions.fiscal_year_id = fiscalYearId;
    }

    const records = await prisma.right_records.findMany({
      where: whereConditions,
      include: {
        client_broker_mapping: {
          select: {
            client_name: true,
            client_id: true
          }
        },
        stock_fulls: {
          select: {
            symbol: true,
            full_form: true
          }
        },
        funds: {
          select: {
            fund_name: true
          }
        },
        fiscal_years: {
          select: {
            year_label: true
          }
        }
      },
      orderBy: {
        bookclose_date: 'desc'
      }
    });

    return records.map(record => ({
      ...record,
      effective_rate: Number(record.effective_rate),
      total_value: Number(record.total_value)
    }));
  } catch (error) {
    console.error('Error fetching right records:', error);
    throw new Error('Failed to fetch right records');
  }
}

// Fetch all cash records or by specific fund and fiscal year
export async function getCashRecords(fundName?: string, fiscalYearId?: number) {
  try {
    const whereConditions: any = {};
    
    if (fundName) {
      whereConditions.funds = {
        fund_name: fundName
      };
    }
    
    if (fiscalYearId) {
      whereConditions.fiscal_year_id = fiscalYearId;
    }

    const records = await prisma.cash_records.findMany({
      where: whereConditions,
      include: {
        client_broker_mapping: {
          select: {
            client_name: true,
            client_id: true
          }
        },
        stock_fulls: {
          select: {
            symbol: true,
            full_form: true
          }
        },
        funds: {
          select: {
            fund_name: true
          }
        },
        fiscal_years: {
          select: {
            year_label: true
          }
        }
      },
      orderBy: {
        bookclose_date: 'desc'
      }
    });

    return records.map(record => ({
      ...record,
      amount: Number(record.amount)
    }));
  } catch (error) {
    console.error('Error fetching cash records:', error);
    throw new Error('Failed to fetch cash records');
  }
}

// Delete bonus record using safe deletion system
export async function deleteBonusRecord(bonusId: number) {
  try {
    // Get record details for safe deletion
    const record = await prisma.bonus_records.findUnique({
      where: { bonus_id: bonusId },
      select: { client_id: true, symbol: true, fiscal_year_id: true }
    });

    if (!record) {
      throw new Error('Bonus record not found');
    }

    // Use safe deletion function from fiscalAPI
    const result = await prisma.$queryRaw`
      SELECT safe_delete_record(
        'bonus_records'::VARCHAR(50),
        ${bonusId}::INTEGER,
        ${record.client_id}::VARCHAR(25),
        ${record.symbol}::VARCHAR(15),
        ${record.fiscal_year_id}::INTEGER,
        false::BOOLEAN
      ) as result
    ` as any[];

    const deleteResult = result[0]?.result;

    if (!deleteResult?.success) {
      throw new Error(deleteResult?.message || 'Safe deletion failed');
    }

    revalidatePath('/dashboard/manual-stock-history');
    return { 
      success: true, 
      message: deleteResult.message,
      data: deleteResult
    };
  } catch (error) {
    console.error('Error deleting bonus record:', error);
    throw new Error('Failed to delete bonus record');
  }
}

// Delete promoter record using safe deletion system
export async function deletePromoterRecord(promoterId: number) {
  try {
    // Get record details for safe deletion
    const record = await prisma.promoter_records.findUnique({
      where: { promoter_id: promoterId },
      select: { client_id: true, symbol: true, fiscal_year_id: true }
    });

    if (!record) {
      throw new Error('Promoter record not found');
    }

    // Use safe deletion function
    const result = await prisma.$queryRaw`
      SELECT safe_delete_record(
        'promoter_records'::VARCHAR(50),
        ${promoterId}::INTEGER,
        ${record.client_id}::VARCHAR(25),
        ${record.symbol}::VARCHAR(15),
        ${record.fiscal_year_id}::INTEGER,
        false::BOOLEAN
      ) as result
    ` as any[];

    const deleteResult = result[0]?.result;

    if (!deleteResult?.success) {
      throw new Error(deleteResult?.message || 'Safe deletion failed');
    }

    revalidatePath('/dashboard/manual-stock-history');
    return { 
      success: true, 
      message: deleteResult.message,
      data: deleteResult
    };
  } catch (error) {
    console.error('Error deleting promoter record:', error);
    throw new Error('Failed to delete promoter record');
  }
}

// Delete right record using safe deletion system
export async function deleteRightRecord(rightId: number) {
  try {
    // Get record details for safe deletion
    const record = await prisma.right_records.findUnique({
      where: { right_id: rightId },
      select: { client_id: true, symbol: true, fiscal_year_id: true }
    });

    if (!record) {
      throw new Error('Right record not found');
    }

    // Use safe deletion function
    const result = await prisma.$queryRaw`
      SELECT safe_delete_record(
        'right_records'::VARCHAR(50),
        ${rightId}::INTEGER,
        ${record.client_id}::VARCHAR(25),
        ${record.symbol}::VARCHAR(15),
        ${record.fiscal_year_id}::INTEGER,
        false::BOOLEAN
      ) as result
    ` as any[];

    const deleteResult = result[0]?.result;

    if (!deleteResult?.success) {
      throw new Error(deleteResult?.message || 'Safe deletion failed');
    }

    revalidatePath('/dashboard/manual-stock-history');
    return { 
      success: true, 
      message: deleteResult.message,
      data: deleteResult
    };
  } catch (error) {
    console.error('Error deleting right record:', error);
    throw new Error('Failed to delete right record');
  }
}

// Delete cash record using safe deletion system
export async function deleteCashRecord(cashId: number) {
  try {
    // Get record details for safe deletion
    const record = await prisma.cash_records.findUnique({
      where: { cash_id: cashId },
      select: { client_id: true, symbol: true, fiscal_year_id: true }
    });

    if (!record) {
      throw new Error('Cash record not found');
    }

    // Use safe deletion function
    const result = await prisma.$queryRaw`
      SELECT safe_delete_record(
        'cash_records'::VARCHAR(50),
        ${cashId}::INTEGER,
        ${record.client_id}::VARCHAR(25),
        ${record.symbol}::VARCHAR(15),
        ${record.fiscal_year_id}::INTEGER,
        false::BOOLEAN
      ) as result
    ` as any[];

    const deleteResult = result[0]?.result;

    if (!deleteResult?.success) {
      throw new Error(deleteResult?.message || 'Safe deletion failed');
    }

    revalidatePath('/dashboard/manual-stock-history');
    return { 
      success: true, 
      message: deleteResult.message,
      data: deleteResult
    };
  } catch (error) {
    console.error('Error deleting cash record:', error);
    throw new Error('Failed to delete cash record');
  }
}