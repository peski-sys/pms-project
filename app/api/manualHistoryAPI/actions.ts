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

// Delete bonus record
export async function deleteBonusRecord(bonusId: number) {
  try {
    await prisma.bonus_records.delete({
      where: { bonus_id: bonusId }
    });

    await prisma.audit_log.create({
      data: {
        performed_action: `Deleted bonus record with ID: ${bonusId}`
      }
    });

    revalidatePath('/dashboard/manual-stock-history');
    return { success: true, message: 'Bonus record deleted successfully' };
  } catch (error) {
    console.error('Error deleting bonus record:', error);
    throw new Error('Failed to delete bonus record');
  }
}

// Delete promoter record
export async function deletePromoterRecord(promoterId: number) {
  try {
    await prisma.promoter_records.delete({
      where: { promoter_id: promoterId }
    });

    await prisma.audit_log.create({
      data: {
        performed_action: `Deleted promoter record with ID: ${promoterId}`
      }
    });

    revalidatePath('/dashboard/manual-stock-history');
    return { success: true, message: 'Promoter record deleted successfully' };
  } catch (error) {
    console.error('Error deleting promoter record:', error);
    throw new Error('Failed to delete promoter record');
  }
}

// Delete right record
export async function deleteRightRecord(rightId: number) {
  try {
    await prisma.right_records.delete({
      where: { right_id: rightId }
    });

    await prisma.audit_log.create({
      data: {
        performed_action: `Deleted right record with ID: ${rightId}`
      }
    });

    revalidatePath('/dashboard/manual-stock-history');
    return { success: true, message: 'Right record deleted successfully' };
  } catch (error) {
    console.error('Error deleting right record:', error);
    throw new Error('Failed to delete right record');
  }
}

// Delete cash record
export async function deleteCashRecord(cashId: number) {
  try {
    await prisma.cash_records.delete({
      where: { cash_id: cashId }
    });

    await prisma.audit_log.create({
      data: {
        performed_action: `Deleted cash record with ID: ${cashId}`
      }
    });

    revalidatePath('/dashboard/manual-stock-history');
    return { success: true, message: 'Cash record deleted successfully' };
  } catch (error) {
    console.error('Error deleting cash record:', error);
    throw new Error('Failed to delete cash record');
  }
}