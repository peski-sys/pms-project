"use server"

import { prisma } from '@/lib/db';

export async function uploadIPOAllotment(currentFund: string, currentClient: string, symbol: string, stock_quantity: number, stock_price: number, stock_added_at: string, sub_id?: number) {
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
                fiscal_year_id: stock_fiscal_id,
                sub_id: sub_id || 1  // Default to 1 if not provided
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

// IPO Allotment Staging Functions (Non-DEMAT)

export async function uploadIPOAllotmentStaging(currentFund: string, symbol: string, stock_quantity: number, stock_price: number, stock_added_at: string, sub_id?: number) {
    try {
        // Validate inputs
        if (!currentFund || !symbol || !stock_added_at) {
            throw new Error('Missing required parameters for IPO allotment staging upload');
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

        // Create IPO allotment staging record (no client_id)
        await prisma.ipo_allotment_staging.create({
            data: {
                fund_id: Number(stock_fund_id),
                symbol: symbol,
                quantity: stock_quantity,
                effective_rate: stock_price,
                added_at: parsed_date,
                fiscal_year_id: stock_fiscal_id,
                sub_id: sub_id || 1,
                remarks: "Pending Client Assignment"
            }
        });

        // Create audit log
        await prisma.audit_log.create({
            data: {
                performed_action: `Added New IPO Allotment Staging (Non-DEMAT) for ${symbol} (${stock_quantity} shares at Rs. ${stock_price})`
            }
        });

        console.log(`Successfully uploaded IPO allotment staging record for ${symbol}`);
        return {
            success: true,
            message: 'IPO allotment staging record uploaded successfully',
            data: {
                symbol: symbol,
                quantity: stock_quantity,
                price: stock_price,
                fund: currentFund
            }
        };

    } catch (error) {
        console.error('Error uploading IPO allotment staging record:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to upload IPO allotment staging record'
        };
    }
}

export async function getIPOAllotmentStagingRecords(fundName?: string, fiscalYearId?: number) {
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

        const records = await prisma.ipo_allotment_staging.findMany({
            where: whereConditions,
            include: {
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
                },
                sub_classes: {
                    select: {
                        sub_name: true
                    }
                }
            },
            orderBy: {
                recorded_at: 'desc'
            }
        });

        // Convert Decimal to number for client serialization
        return records.map(record => ({
            ...record,
            effective_rate: Number(record.effective_rate),
            total_value: record.total_value ? Number(record.total_value) : null
        }));
    } catch (error) {
        console.error('Error fetching IPO allotment staging records:', error);
        return [];
    }
}

export async function deleteIPOAllotmentStaging(stagingId: number) {
    try {
        // First, get the record details for the audit log
        const record = await prisma.ipo_allotment_staging.findUnique({
            where: { allotment_staging_id: stagingId },
            include: {
                stock_fulls: {
                    select: { symbol: true, full_form: true }
                }
            }
        });

        if (!record) {
            throw new Error('IPO allotment staging record not found');
        }

        // Delete the record
        await prisma.ipo_allotment_staging.delete({
            where: { allotment_staging_id: stagingId }
        });

        // Create audit log
        await prisma.audit_log.create({
            data: {
                performed_action: `Deleted IPO Allotment Staging Record for ${record.stock_fulls.symbol} (${record.quantity} shares at Rs. ${record.effective_rate})`
            }
        });

        return {
            success: true,
            message: 'IPO allotment staging record deleted successfully'
        };

    } catch (error) {
        console.error('Error deleting IPO allotment staging record:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to delete IPO allotment staging record'
        };
    }
}

export async function dematerializeIPOStaging(stagingId: number, clientId: string) {
    try {
        // Validate client_id
        if (!clientId || clientId.trim() === '') {
            throw new Error('Client ID is required for dematerialization');
        }

        // Get staging record
        const stagingRecord = await prisma.ipo_allotment_staging.findUnique({
            where: { allotment_staging_id: stagingId },
            include: {
                stock_fulls: {
                    select: { symbol: true }
                }
            }
        });

        if (!stagingRecord) {
            throw new Error('IPO allotment staging record not found');
        }

        // Validate client exists
        const clientExists = await prisma.client_broker_mapping.findUnique({
            where: { client_id: clientId }
        });

        if (!clientExists) {
            throw new Error(`Client ID ${clientId} does not exist`);
        }

        // Transfer to ipo_allotment_records (total_value is auto-generated)
        await prisma.ipo_allotment_records.create({
            data: {
                fund_id: stagingRecord.fund_id,
                client_id: clientId,
                symbol: stagingRecord.symbol,
                quantity: stagingRecord.quantity,
                effective_rate: stagingRecord.effective_rate,
                added_at: stagingRecord.added_at,
                fiscal_year_id: stagingRecord.fiscal_year_id,
                sub_id: stagingRecord.sub_id,
                remarks: `Dematerialized from staging on ${new Date().toLocaleDateString()}`
            }
        });

        // Delete from staging
        await prisma.ipo_allotment_staging.delete({
            where: { allotment_staging_id: stagingId }
        });

        // Create audit log
        await prisma.audit_log.create({
            data: {
                performed_action: `Dematerialized IPO Allotment: ${stagingRecord.stock_fulls.symbol} (${stagingRecord.quantity} shares) to Client ${clientId}`
            }
        });

        return {
            success: true,
            message: 'IPO allotment dematerialized successfully',
            data: {
                symbol: stagingRecord.stock_fulls.symbol,
                quantity: stagingRecord.quantity,
                client_id: clientId
            }
        };

    } catch (error) {
        console.error('Error dematerializing IPO allotment:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to dematerialize IPO allotment'
        };
    }
}
