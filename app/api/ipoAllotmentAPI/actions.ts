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

            const parsedRemarks = (() => {
                try {
                    return stagingRecord.remarks ? JSON.parse(stagingRecord.remarks) : null;
                } catch {
                    return null;
                }
            })();

            const addedAtRaw = parsedRemarks?.added_at;
            const addedAt = addedAtRaw ? new Date(addedAtRaw) : new Date();
            const noteSuffix = `Dematerialized to ${client.client_name ?? client.client_id} (${normalizedHolding}) on ${new Date().toISOString()}`;

            const dematerializedQuantity = Number(stagingRecord.closing_quantity ?? 0);
            const stagingEffectiveRate = Number(stagingRecord.effective_rate ?? 0);

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
                        remarks: noteSuffix
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
                        remarks: noteSuffix
                    }
                });
            }

            const [bonusStagingRecords, rightStagingRecords, cashStagingRecords] = await Promise.all([
                tx.bonus_records_staging.findMany({
                    where: {
                        fund_id: stagingRecord.fund_id,
                        symbol: stagingRecord.symbol,
                        fiscal_year_id: stagingRecord.fiscal_year_id
                    }
                }),
                tx.right_records_staging.findMany({
                    where: {
                        fund_id: stagingRecord.fund_id,
                        symbol: stagingRecord.symbol,
                        fiscal_year_id: stagingRecord.fiscal_year_id
                    }
                }),
                tx.cash_records_staging.findMany({
                    where: {
                        fund_id: stagingRecord.fund_id,
                        symbol: stagingRecord.symbol,
                        fiscal_year_id: stagingRecord.fiscal_year_id
                    }
                })
            ]);

            const mapRemarks = (existing?: string | null) => {
                const parts = [existing, noteSuffix].filter(Boolean);
                return parts.join(' | ');
            };

            for (const bonus of bonusStagingRecords) {
                await tx.bonus_records.create({
                    data: {
                        fund_id: bonus.fund_id,
                        client_id: clientId,
                        symbol: bonus.symbol,
                        bonus_percent: Number(bonus.bonus_percent),
                        quantity: Number(bonus.quantity),
                        bookclose_date: bonus.bookclose_date,
                        effective_rate: Number(bonus.effective_rate ?? 0),
                        fiscal_year_id: bonus.fiscal_year_id,
                        remarks: mapRemarks(bonus.remarks)
                    }
                });

                await tx.bonus_records_staging.delete({ where: { bonus_staging_id: bonus.bonus_staging_id } });
            }

            for (const right of rightStagingRecords) {
                await tx.right_records.create({
                    data: {
                        fund_id: right.fund_id,
                        client_id: clientId,
                        symbol: right.symbol,
                        right_ratio: right.right_ratio,
                        bookclose_date: right.bookclose_date,
                        quantity: Number(right.quantity),
                        effective_rate: Number(right.effective_rate ?? 0),
                        total_value: right.total_value ? Number(right.total_value) : null,
                        fiscal_year_id: right.fiscal_year_id,
                        remarks: mapRemarks(right.remarks)
                    }
                });

                await tx.right_records_staging.delete({ where: { right_staging_id: right.right_staging_id } });
            }

            for (const cash of cashStagingRecords) {
                await tx.cash_records.create({
                    data: {
                        fund_id: cash.fund_id,
                        client_id: clientId,
                        symbol: cash.symbol,
                        amount: Number(cash.amount),
                        bookclose_date: cash.bookclose_date,
                        fiscal_year_id: cash.fiscal_year_id,
                        remarks: mapRemarks(cash.remarks)
                    }
                });

                await tx.cash_records_staging.delete({ where: { cash_staging_id: cash.cash_staging_id } });
            }

            const existingBalance = await tx.fiscal_year_balance.findUnique({
                where: {
                    client_id_symbol_fiscal_year_id: {
                        client_id: clientId,
                        symbol: stagingRecord.symbol,
                        fiscal_year_id: stagingRecord.fiscal_year_id
                    }
                }
            });

            const stagingAddedQuantity = Number(stagingRecord.added_quantity ?? dematerializedQuantity);
            const stagingOpeningQuantity = Number(stagingRecord.opening_quantity ?? 0);

            if (existingBalance) {
                const existingClosing = Number(existingBalance.closing_quantity ?? 0);
                const updatedClosing = existingClosing + dematerializedQuantity;
                const existingEffective = Number(existingBalance.effective_rate ?? 0);
                const weightedEffective = updatedClosing > 0
                    ? ((existingEffective * existingClosing) + (stagingEffectiveRate * dematerializedQuantity)) / updatedClosing
                    : stagingEffectiveRate;

                await tx.fiscal_year_balance.update({
                    where: {
                        client_id_symbol_fiscal_year_id: {
                            client_id: clientId,
                            symbol: stagingRecord.symbol,
                            fiscal_year_id: stagingRecord.fiscal_year_id
                        }
                    },
                    data: {
                        added_quantity: Number(existingBalance.added_quantity ?? 0) + stagingAddedQuantity,
                        closing_quantity: updatedClosing,
                        demat: Number(existingBalance.demat ?? 0) + dematerializedQuantity,
                        non_demat: Math.max(Number(existingBalance.non_demat ?? 0) - dematerializedQuantity, 0),
                        effective_rate: Number(weightedEffective.toFixed(6)),
                        source_type: normalizedHolding,
                        sub_id: stagingRecord.sub_id ?? existingBalance.sub_id ?? 1,
                        remarks: mapRemarks(existingBalance.remarks)
                    }
                });
            } else {
                await tx.fiscal_year_balance.create({
                    data: {
                        client_id: clientId,
                        symbol: stagingRecord.symbol,
                        fiscal_year_id: stagingRecord.fiscal_year_id,
                        fund_id: stagingRecord.fund_id,
                        opening_quantity: stagingOpeningQuantity,
                        added_quantity: stagingAddedQuantity,
                        closing_quantity: dematerializedQuantity,
                        effective_rate: stagingEffectiveRate,
                        opening_rate: Number(stagingRecord.opening_rate ?? stagingEffectiveRate),
                        demat: dematerializedQuantity,
                        non_demat: 0,
                        source_type: normalizedHolding,
                        sub_id: stagingRecord.sub_id ?? 1,
                        remarks: mapRemarks(stagingRecord.remarks ?? null)
                    }
                });
            }

            await tx.fiscal_year_balance_staging.delete({ where: { staging_id: stagingId } });

            await tx.audit_log.create({
                data: {
                    performed_action: `Dematerialized Non-DEMAT holdings for ${stagingRecord.symbol} (${dematerializedQuantity} shares) to ${clientId} as ${normalizedHolding}`
                }
            });

            return {
                symbol: stagingRecord.symbol,
                quantity: dematerializedQuantity,
                bonusMigrated: bonusStagingRecords.length,
                rightMigrated: rightStagingRecords.length,
                cashMigrated: cashStagingRecords.length
            };
        });

        return {
            success: true,
            message: 'IPO allotment dematerialized successfully',
            data: {
                symbol: transactionResult.symbol,
                quantity: transactionResult.quantity,
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
