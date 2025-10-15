"use server"

import { prisma } from '@/lib/db';

export async function uploadIPOAllotment(currentFund: string, currentClient: string, symbol: string, stock_quantity: number, stock_price: number, stock_added_at: string) {
    try {
        // Validate inputs
        if (!currentFund || !currentClient || !symbol || !stock_added_at) {
            throw new Error('Missing required parameters for IPO allotment upload');
        }

        if (stock_quantity <= 0 || stock_price <= 0) {
            throw new Error('Quantity and price must be greater than 0');
        }

        const parsed_date = new Date(stock_added_at);
        if (isNaN(parsed_date.getTime())) {
            throw new Error('Invalid date format');
        }

        // Get fiscal year
        const get_fiscal = await prisma.fiscal_years.findMany({
            where: {
                start_date: { lte: parsed_date },
                end_date: { gte: parsed_date },
            },
            select: { fiscal_year_id: true },
        });

        if (!get_fiscal || get_fiscal.length === 0) {
            throw new Error(`No fiscal year found for date: ${stock_added_at}`);
        }

        // Get fund ID
        const get_fund_id = await prisma.funds.findMany({
            where: { fund_name: currentFund }
        });

        if (!get_fund_id || get_fund_id.length === 0) {
            throw new Error(`Fund not found: ${currentFund}`);
        }

        const stock_fiscal_id = get_fiscal[0].fiscal_year_id;
        const stock_fund_id = get_fund_id[0].fund_id;

        // Create IPO allotment record
        await prisma.ipo_allotment_records.create({
            data: {
                fund_id: Number(stock_fund_id),
                client_id: currentClient,
                symbol: symbol,
                quantity: stock_quantity,
                effective_rate: stock_price,
                added_at: parsed_date,
                fiscal_year_id: stock_fiscal_id
            }
        });

        // Create audit log
        await prisma.audit_log.create({
            data: {
                performed_action: `Added New IPO Allotment Record for ${currentClient} - ${symbol} (${stock_quantity} shares at Rs. ${stock_price})`
            }
        });

        console.log(`Successfully uploaded IPO allotment record for ${currentClient} - ${symbol}`);
        return {
            success: true,
            message: 'IPO allotment record uploaded successfully',
            data: {
                symbol: symbol,
                quantity: stock_quantity,
                price: stock_price,
                client: currentClient,
                fund: currentFund
            }
        };

    } catch (error) {
        console.error('Error uploading IPO allotment record:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to upload IPO allotment record'
        };
    }
}

export async function getIPOAllotmentRecords(fundName?: string, fiscalYearId?: number) {
    try {
        const whereConditions: any = {};
        
        if (fundName) {
            whereConditions.client_broker_mapping = {
                client_name: fundName
            };
        }
        
        if (fiscalYearId) {
            whereConditions.fiscal_year_id = fiscalYearId;
        }

        const records = await prisma.ipo_allotment_records.findMany({
            where: whereConditions,
            include: {
                client_broker_mapping: {
                    select: {
                        client_name: true,
                        client_id: true
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
                },
                stock_fulls: {
                    select: {
                        symbol: true,
                        full_form: true
                    }
                }
            },
            orderBy: {
                recorded_at: 'desc'
            }
        });

        return records;
    } catch (error) {
        console.error('Error fetching IPO allotment records:', error);
        return [];
    }
}

export async function deleteIPOAllotmentRecord(allotmentId: number) {
    try {
        // First, get the record details for the audit log
        const record = await prisma.ipo_allotment_records.findUnique({
            where: { allotment_id: allotmentId },
            include: {
                client_broker_mapping: {
                    select: { client_name: true }
                },
                stock_fulls: {
                    select: { symbol: true, full_form: true }
                }
            }
        });

        if (!record) {
            throw new Error('IPO allotment record not found');
        }

        // Delete the record
        await prisma.ipo_allotment_records.delete({
            where: { allotment_id: allotmentId }
        });

        // Create audit log
        await prisma.audit_log.create({
            data: {
                performed_action: `Deleted IPO Allotment Record for ${record.client_broker_mapping.client_name} - ${record.stock_fulls.symbol} (${record.quantity} shares at Rs. ${record.effective_rate})`
            }
        });

        return {
            success: true,
            message: 'IPO allotment record deleted successfully'
        };

    } catch (error) {
        console.error('Error deleting IPO allotment record:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to delete IPO allotment record'
        };
    }
}