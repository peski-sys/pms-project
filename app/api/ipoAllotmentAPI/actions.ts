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

        // Convert Decimal fields to numbers for client component compatibility
        return records.map(record => ({
            ...record,
            quantity: Number(record.quantity),
            effective_rate: Number(record.effective_rate),
            total_value: Number((Number(record.quantity) * Number(record.effective_rate)).toFixed(2))
        }));
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

        const metadata = {
            note: 'Pending Client Assignment',
            added_at: stock_added_at
        }

        // Create IPO allotment staging record inside fiscal_year_balance_staging
        await prisma.fiscal_year_balance_staging.create({
            data: {
                fund_id: Number(stock_fund_id),
                symbol: symbol.toUpperCase(),
                fiscal_year_id: stock_fiscal_id,
                opening_quantity: 0,
                added_quantity: stock_quantity,
                closing_quantity: stock_quantity,
                effective_rate: stock_price,
                sub_id: sub_id || 1,
                source_type: 'PROMOTER',
                demat: 0,
                non_demat: stock_quantity,
                remarks: JSON.stringify(metadata)
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
            const fundInfo = await prisma.funds.findFirst({
                where: { fund_name: fundName },
                select: { fund_id: true }
            })

            if (!fundInfo) {
                return []
            }

            whereConditions.fund_id = fundInfo.fund_id
        }
        
        if (fiscalYearId) {
            whereConditions.fiscal_year_id = fiscalYearId;
        }

        const records = await prisma.fiscal_year_balance_staging.findMany({
            where: whereConditions,
            select: {
                staging_id: true,
                fund_id: true,
                symbol: true,
                fiscal_year_id: true,
                closing_quantity: true,
                effective_rate: true,
                remarks: true,
                sub_id: true,
                demat: true,
                non_demat: true
            },
            orderBy: {
                staging_id: 'desc'
            }
        });

        if (records.length === 0) {
            return []
        }

        const fundIds = Array.from(new Set(records.map(record => record.fund_id)))
        const fiscalYearIds = Array.from(new Set(records.map(record => record.fiscal_year_id)))
        const symbols = Array.from(new Set(records.map(record => record.symbol)))
        const subIds = Array.from(new Set(records.map(record => record.sub_id).filter((id): id is number => id !== null && id !== undefined)))

        const [fundsData, fiscalYearsData, stockData, subClassData] = await Promise.all([
            fundIds.length > 0
                ? prisma.funds.findMany({
                    where: { fund_id: { in: fundIds } },
                    select: { fund_id: true, fund_name: true }
                })
                : Promise.resolve([]),
            fiscalYearIds.length > 0
                ? prisma.fiscal_years.findMany({
                    where: { fiscal_year_id: { in: fiscalYearIds } },
                    select: { fiscal_year_id: true, year_label: true }
                })
                : Promise.resolve([]),
            symbols.length > 0
                ? prisma.stock_fulls.findMany({
                    where: { symbol: { in: symbols } },
                    select: { symbol: true, full_form: true }
                })
                : Promise.resolve([]),
            subIds.length > 0
                ? prisma.sub_classes.findMany({
                    where: { sub_id: { in: subIds } },
                    select: { sub_id: true, sub_name: true }
                })
                : Promise.resolve([])
        ])

        const fundMap = new Map(fundsData.map(fund => [fund.fund_id, fund]))
        const fiscalYearMap = new Map(fiscalYearsData.map(fiscal => [fiscal.fiscal_year_id, fiscal]))
        const stockMap = new Map(stockData.map(stock => [stock.symbol, stock]))
        const subClassMap = new Map(subClassData.map(subClass => [subClass.sub_id, subClass]))

        return records.map(record => {
            const parsedRemarks = (() => {
                try {
                    return record.remarks ? JSON.parse(record.remarks) : null
                } catch {
                    return null
                }
            })()

            const addedAtRaw = parsedRemarks?.added_at
            const addedAt = addedAtRaw ? new Date(addedAtRaw) : null
            const note = typeof parsedRemarks?.note === 'string' ? parsedRemarks.note : (record.remarks ?? '')
            const quantity = Number(record.closing_quantity ?? 0)
            const rate = Number(record.effective_rate ?? 0)

            const fundInfo = fundMap.get(record.fund_id)
            const fiscalInfo = fiscalYearMap.get(record.fiscal_year_id)
            const stockInfo = stockMap.get(record.symbol)
            const subClassInfo = record.sub_id ? subClassMap.get(record.sub_id) : undefined

            return {
                allotment_staging_id: record.staging_id,
                fund_id: record.fund_id,
                quantity,
                effective_rate: rate,
                total_value: Number((quantity * rate).toFixed(2)),
                fiscal_year_id: record.fiscal_year_id,
                recorded_at: addedAt,
                added_at: addedAt,
                remarks: note,
                symbol: record.symbol,
                sub_id: record.sub_id,
                funds: fundInfo ? { fund_name: fundInfo.fund_name } : { fund_name: '' },
                fiscal_years: fiscalInfo ? { year_label: fiscalInfo.year_label } : null,
                stock_fulls: stockInfo
                    ? { symbol: stockInfo.symbol, full_form: stockInfo.full_form }
                    : { symbol: record.symbol, full_form: record.symbol },
                sub_classes: subClassInfo ? { sub_name: subClassInfo.sub_name } : null,
                demat: Number(record.demat ?? 0),
                non_demat: Number(record.non_demat ?? quantity)
            }
        });
    } catch (error) {
        console.error('Error fetching IPO allotment staging records:', error);
        return [];
    }
}

export async function deleteIPOAllotmentStaging(stagingId: number) {
    try {
        // First, get the record details for the audit log
        const record = await prisma.fiscal_year_balance_staging.findUnique({
            where: { staging_id: stagingId },
            select: {
                symbol: true,
                closing_quantity: true,
                effective_rate: true,
                remarks: true
            }
        });

        if (!record) {
            throw new Error('IPO allotment staging record not found');
        }

        // Delete the record
        await prisma.fiscal_year_balance_staging.delete({
            where: { staging_id: stagingId }
        });

        // Create audit log
        await prisma.audit_log.create({
            data: {
                performed_action: `Deleted IPO Staging Record for ${record.symbol} (${Number(record.closing_quantity ?? 0)} shares at Rs. ${Number(record.effective_rate ?? 0)})`
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

export async function dematerializeIPOStaging(stagingId: number, clientId: string, clientTrading: string) {
    try {
        if (!clientId || clientId.trim() === '') {
            throw new Error('Client ID is required for dematerialization');
        }

        const normalizedHolding = clientTrading?.toUpperCase() === 'PROMOTER' ? 'PROMOTER' : 'TRADING';

        const transactionResult = await prisma.$transaction(async (tx) => {
            // Get the staging record with all required fields
            const stagingRecord = await tx.fiscal_year_balance_staging.findUnique({
                where: { staging_id: stagingId },
                select: {
                    fund_id: true,
                    symbol: true,
                    closing_quantity: true,
                    opening_quantity: true,
                    added_quantity: true,
                    effective_rate: true,
                    opening_rate: true,
                    fiscal_year_id: true,
                    sub_id: true,
                    source_type: true,
                    remarks: true
                }
            });

            if (!stagingRecord) {
                throw new Error('IPO allotment staging record not found');
            }

            // Validate client exists and belongs to the correct fund
            const client = await tx.client_broker_mapping.findUnique({
                where: { client_id: clientId },
                select: {
                    client_id: true,
                    client_name: true,
                    fund_id: true
                }
            });

            if (!client) {
                throw new Error(`Client ID ${clientId} does not exist`);
            }

            if (client.fund_id !== stagingRecord.fund_id) {
                throw new Error('Selected client does not belong to the staging fund');
            }

            const dematerializedQuantity = Number(stagingRecord.closing_quantity ?? 0);
            const stagingEffectiveRate = Number(stagingRecord.effective_rate ?? 0);

            if (dematerializedQuantity <= 0) {
                throw new Error('No quantity available to dematerialize');
            }

            // Parse remarks to get original added_at date
            const parsedRemarks = (() => {
                try {
                    return stagingRecord.remarks ? JSON.parse(stagingRecord.remarks) : null;
                } catch {
                    return null;
                }
            })();

            const addedAtRaw = parsedRemarks?.added_at;
            const addedAt = addedAtRaw ? new Date(addedAtRaw) : new Date();

            // Create the appropriate transaction record based on holding type
            // Add special marker to prevent double counting in symbol_holdings
            const remarksWithMarker = `SKIP_SYMBOL_HOLDINGS|Dematerialized from staging on ${new Date().toISOString()}`;
            
            if (normalizedHolding === 'TRADING') {
                await tx.ipo_allotment_records.create({
                    data: {
                        fund_id: stagingRecord.fund_id,
                        client_id: clientId,
                        symbol: stagingRecord.symbol,
                        quantity: dematerializedQuantity,
                        effective_rate: stagingEffectiveRate,
                        added_at: addedAt,
                        fiscal_year_id: stagingRecord.fiscal_year_id,
                        sub_id: stagingRecord.sub_id ?? 1,
                        remarks: remarksWithMarker
                    }
                });
            } else {
                await tx.promoter_records.create({
                    data: {
                        fund_id: stagingRecord.fund_id,
                        client_id: clientId,
                        symbol: stagingRecord.symbol,
                        quantity: dematerializedQuantity,
                        effective_rate: stagingEffectiveRate,
                        added_at: addedAt,
                        fiscal_year_id: stagingRecord.fiscal_year_id,
                        sub_id: stagingRecord.sub_id ?? 1,
                        remarks: remarksWithMarker
                    }
                });
            }

            // Use the safe_update_fiscal_year_balance helper function to create/update fiscal_year_balance
            // This will respect auto-generated fields and let triggers handle the calculations
            await tx.$executeRaw`
                SELECT safe_update_fiscal_year_balance(
                    ${clientId}::VARCHAR(25),
                    ${stagingRecord.symbol}::VARCHAR(15),
                    ${stagingRecord.fiscal_year_id}::INTEGER,
                    ${Number(stagingRecord.opening_quantity ?? 0)}::INTEGER,
                    ${Number(stagingRecord.added_quantity ?? dematerializedQuantity)}::INTEGER,
                    ${stagingEffectiveRate}::NUMERIC(14,2),
                    ${Number(stagingRecord.opening_rate ?? stagingEffectiveRate)}::NUMERIC(14,2),
                    ${dematerializedQuantity}::INTEGER,
                    ${normalizedHolding}::VARCHAR(50),
                    ${stagingRecord.sub_id ?? 1}::INTEGER
                )
            `;

            // Delete the staging record
            await tx.fiscal_year_balance_staging.delete({
                where: { staging_id: stagingId }
            });

            // Create audit log
            await tx.audit_log.create({
                data: {
                    performed_action: `Dematerialized Non-DEMAT holdings for ${stagingRecord.symbol} (${dematerializedQuantity} shares) to ${clientId} as ${normalizedHolding}`
                }
            });

            return {
                symbol: stagingRecord.symbol,
                quantity: dematerializedQuantity,
                client_name: client.client_name
            };
        });

        return {
            success: true,
            message: 'IPO allotment dematerialized successfully',
            data: {
                symbol: transactionResult.symbol,
                quantity: transactionResult.quantity,
                client_id: clientId,
                client_name: transactionResult.client_name
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
