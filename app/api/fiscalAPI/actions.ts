"use server"
import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"

export async function getFiscal() {
    try {
        const fiscal_details = await prisma.fiscal_years.findMany({
            orderBy: {
                fiscal_year_id: 'asc'
            }
        })
        return { success: true, data: fiscal_details }
    } catch (error) {
        console.error('Failed to fetch fiscal years:', error);
        return { success: false, error: 'Failed to fetch fiscal years', data: [] };
    }
}


export async function uploadFiscal(given_year_label: string, given_start_date: Date, given_end_date: Date) {
    try {
        await prisma.fiscal_years.create({
            data: {
                year_label: given_year_label,
                start_date: given_start_date,
                end_date: given_end_date,
            }
        })
        revalidatePath('/dashboard/fiscal-year-mapping')
        return { success: true, message: `Fiscal year ${given_year_label} created successfully` };
    } catch (error) {
        console.error('Failed to create fiscal year:', error);
        return { success: false, error: 'Failed to create fiscal year' };
    }
}

export async function syncInitialBalance(currentFiscalYearId: number) {
    try {
        const fromYear = currentFiscalYearId - 1;
        const toYear = currentFiscalYearId;
        
        // Call the PostgreSQL function using raw query
        const result = await prisma.$queryRaw`
            SELECT carryforward_fiscal_year_balance(${fromYear}, ${toYear}) as result
        `;
        
        // Update initial_balance_synced to true after successful sync
        await prisma.fiscal_years.update({
            where: {
                fiscal_year_id: toYear
            },
            data: {
                initial_balance_synced: true
            }
        });
        
        revalidatePath('/dashboard/fiscal-year-mapping');
        
        // Extract the result message from the function
        const message = (result as any)[0]?.result || 'Initial balance sync completed successfully';
        
        return {
            success: true,
            message: message
        };
    } catch (error) {
        console.error('Sync initial balance error:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to sync initial balance'
        };
    }
}

// ============================================================================
// TEMPORAL DATA MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Manually trigger recalculation of all balances from a specific date forward
 * This is useful for fixing data inconsistencies or after bulk data imports
 */
export async function recalculateBalancesFromDate(
    effectiveDate: string,
    symbol?: string,
    clientId?: string,
    fiscalYearId?: number
) {
    try {
        // Create audit log for manual recalculation
        await prisma.audit_log.create({
            data: {
                performed_action: `Manual recalculation initiated from date: ${effectiveDate}${symbol ? ` for symbol: ${symbol}` : ''}${clientId ? ` for client: ${clientId}` : ''}`
            }
        });
        
        // Call the PostgreSQL function directly
        const result = await prisma.$queryRaw`
            SELECT fn_recalculate_balances_from_date(
                ${effectiveDate}::DATE,
                ${symbol || null}::VARCHAR(15),
                ${clientId || null}::VARCHAR(25),
                ${fiscalYearId || null}::INTEGER
            )
        `
        
        // Revalidate relevant paths
        revalidatePath('/view-ledger')
        revalidatePath('/dashboard')
        
        return {
            success: true,
            message: `Recalculation completed from ${effectiveDate}${symbol ? ` for symbol ${symbol}` : ''}${clientId ? ` for client ${clientId}` : ''}`
        }
        
    } catch (error) {
        console.error('Error in recalculateBalancesFromDate:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to recalculate balances'
        }
    }
}

/**
 * Get all transactions that would be affected by a recalculation from a specific date
 * This helps users understand the impact before triggering a recalculation
 */
export async function getAffectedTransactions(
    effectiveDate: string,
    symbol?: string,
    clientId?: string,
    fiscalYearId?: number
) {
    try {
        const whereClause = {
            AND: [
                symbol ? { symbol } : {},
                clientId ? { client_id: clientId } : {},
                fiscalYearId ? { fiscal_year_id: fiscalYearId } : {}
            ]
        }
        
        // Get affected buy records
        const buyRecords = await prisma.buy_records.findMany({
            where: {
                transaction_date: { gte: new Date(effectiveDate) },
                ...whereClause
            },
            select: {
                transaction_date: true,
                client_id: true,
                symbol: true,
                quantity: true,
                price: true
            },
            orderBy: { transaction_date: 'asc' }
        })
        
        // Get affected bonus records
        const bonusRecords = await prisma.bonus_records.findMany({
            where: {
                bookclose_date: { gte: new Date(effectiveDate) },
                ...whereClause
            },
            select: {
                bookclose_date: true,
                client_id: true,
                symbol: true,
                quantity: true,
                bonus_percent: true
            },
            orderBy: { bookclose_date: 'asc' }
        })
        
        // Get affected right records
        const rightRecords = await prisma.right_records.findMany({
            where: {
                bookclose_date: { gte: new Date(effectiveDate) },
                ...whereClause
            },
            select: {
                bookclose_date: true,
                client_id: true,
                symbol: true,
                quantity: true,
                right_ratio: true,
                effective_rate: true
            },
            orderBy: { bookclose_date: 'asc' }
        })
        
        // Get affected cash records
        const cashRecords = await prisma.cash_records.findMany({
            where: {
                bookclose_date: { gte: new Date(effectiveDate) },
                ...whereClause
            },
            select: {
                bookclose_date: true,
                client_id: true,
                symbol: true,
                amount: true
            },
            orderBy: { bookclose_date: 'asc' }
        })
        
        // Get affected closeout records
        const closeoutRecords = await prisma.closeout_records.findMany({
            where: {
                closeout_date: { gte: new Date(effectiveDate) },
                ...whereClause
            },
            select: {
                closeout_date: true,
                client_id: true,
                symbol: true,
                closeout_quantity: true,
                closeout_amount: true
            },
            orderBy: { closeout_date: 'asc' }
        })
        
        return {
            success: true,
            data: {
                buyRecords,
                bonusRecords,
                rightRecords,
                cashRecords,
                closeoutRecords,
                totalAffected: buyRecords.length + bonusRecords.length + rightRecords.length + 
                              cashRecords.length + closeoutRecords.length
            }
        }
        
    } catch (error) {
        console.error('Error in getAffectedTransactions:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get affected transactions'
        }
    }
}

/**
 * Validate that all balances are consistent with their underlying transactions
 * This helps identify data integrity issues
 */
export async function validateBalanceConsistency(
    symbol?: string,
    clientId?: string,
    fiscalYearId?: number
) {
    try {
        // Build dynamic WHERE clause for the query
        let whereConditions = ['fyb.source_type = \'TRADING\'']
        
        if (symbol) {
            whereConditions.push(`fyb.symbol = '${symbol}'`)
        }
        if (clientId) {
            whereConditions.push(`fyb.client_id = '${clientId}'`)
        }
        if (fiscalYearId) {
            whereConditions.push(`fyb.fiscal_year_id = ${fiscalYearId}`)
        }
        
        const whereClause = whereConditions.join(' AND ')
        
        const query = `
            SELECT 
                fyb.client_id,
                fyb.symbol,
                fyb.fiscal_year_id,
                fyb.added_quantity as balance_quantity,
                fyb.effective_rate as balance_rate,
                COALESCE(calc.calculated_quantity, 0) as calculated_quantity,
                COALESCE(calc.calculated_rate, 0) as calculated_rate,
                ABS(fyb.added_quantity - COALESCE(calc.calculated_quantity, 0)) as quantity_diff,
                ABS(fyb.effective_rate - COALESCE(calc.calculated_rate, 0)) as rate_diff
            FROM fiscal_year_balance fyb
            LEFT JOIN (
                SELECT 
                    client_id,
                    symbol,
                    fiscal_year_id,
                    SUM(CASE 
                        WHEN source = 'BUY' THEN quantity
                        WHEN source = 'SELL' THEN -quantity
                        WHEN source = 'BONUS' THEN quantity
                        WHEN source = 'RIGHT' THEN quantity
                        WHEN source = 'CLOSEOUT' THEN -quantity
                        ELSE 0
                    END) as calculated_quantity,
                    CASE 
                        WHEN SUM(CASE WHEN source IN ('BUY', 'RIGHT') THEN quantity ELSE 0 END) > 0
                        THEN SUM(CASE WHEN source IN ('BUY', 'RIGHT') THEN quantity * rate ELSE 0 END) / 
                             SUM(CASE WHEN source IN ('BUY', 'RIGHT') THEN quantity ELSE 0 END)
                        ELSE 0
                    END as calculated_rate
                FROM (
                    SELECT client_id, symbol, fiscal_year_id, quantity, price as rate, 'BUY' as source
                    FROM buy_records
                    UNION ALL
                    SELECT client_id, symbol, fiscal_year_id, quantity, price as rate, 'SELL' as source
                    FROM sell_records
                    UNION ALL
                    SELECT client_id, symbol, fiscal_year_id, quantity, effective_rate as rate, 'BONUS' as source
                    FROM bonus_records
                    UNION ALL
                    SELECT client_id, symbol, fiscal_year_id, quantity, effective_rate as rate, 'RIGHT' as source
                    FROM right_records
                    UNION ALL
                    SELECT client_id, symbol, fiscal_year_id, closeout_quantity as quantity, 
                           (closeout_amount / NULLIF(closeout_quantity, 0)) as rate, 'CLOSEOUT' as source
                    FROM closeout_records
                    WHERE closeout_quantity > 0
                ) transactions
                GROUP BY client_id, symbol, fiscal_year_id
            ) calc ON fyb.client_id = calc.client_id 
                  AND fyb.symbol = calc.symbol 
                  AND fyb.fiscal_year_id = calc.fiscal_year_id
            WHERE ${whereClause}
              AND (ABS(fyb.added_quantity - COALESCE(calc.calculated_quantity, 0)) > 0.01
                   OR ABS(fyb.effective_rate - COALESCE(calc.calculated_rate, 0)) > 0.01)
            ORDER BY quantity_diff DESC, rate_diff DESC
            LIMIT 100
        `
        
        const inconsistencies = await prisma.$queryRawUnsafe(query)
        
        return {
            success: true,
            data: {
                inconsistencies,
                hasInconsistencies: Array.isArray(inconsistencies) && inconsistencies.length > 0
            }
        }
        
    } catch (error) {
        console.error('Error in validateBalanceConsistency:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to validate balance consistency'
        }
    }
}

/**
 * Manually recalculate profit/loss for sell records from a specific date
 * This is useful when retroactive corporate actions affect cost basis
 */
export async function recalculateSellProfitLoss(
    effectiveDate: string,
    symbol?: string,
    clientId?: string,
    fiscalYearId?: number
) {
    try {
        // Create audit log for profit/loss recalculation
        await prisma.audit_log.create({
            data: {
                performed_action: `Sell profit/loss recalculation initiated from date: ${effectiveDate}${symbol ? ` for symbol: ${symbol}` : ''}${clientId ? ` for client: ${clientId}` : ''}`
            }
        });
        
        // Call the PostgreSQL function directly
        const result = await prisma.$queryRaw`
            SELECT fn_recalculate_sell_profit_loss_from_date(
                ${effectiveDate}::DATE,
                ${symbol}::VARCHAR(15),
                ${clientId}::VARCHAR(25),
                ${fiscalYearId}::INTEGER
            ) as result
        `;
        
        // Revalidate cache
        revalidatePath('/dashboard');
        revalidatePath('/dashboard/ledger');
        
        return {
            success: true,
            message: `Profit/loss recalculation completed from ${effectiveDate}`,
            data: result
        };
        
    } catch (error) {
        console.error('Sell profit/loss recalculation error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to recalculate sell profit/loss'
        }
    }
}

/**
 * Safely delete a record with full validation and audit logging
 * This function provides production-level deletion safety for all deletable records
 */
export async function safeDeleteRecord(
    tableName: string,
    recordId: number,
    clientId?: string,
    symbol?: string,
    fiscalYearId?: number,
    forceDelete: boolean = false
) {
    try {
        // Create audit log for deletion attempt
        await prisma.audit_log.create({
            data: {
                performed_action: `Safe deletion initiated for ${tableName} record ID: ${recordId}${forceDelete ? ' (FORCE DELETE)' : ''}`
            }
        });
        
        // Validate table name to prevent SQL injection
        const allowedTables = [
            'bonus_records', 'right_records', 'cash_records', 
            'closeout_records', 'promoter_records', 'ipo_allotment_records'
        ];
        
        if (!allowedTables.includes(tableName)) {
            throw new Error(`Deletion not allowed for table: ${tableName}`);
        }
        
        // Call the PostgreSQL safe deletion function
        const result = await prisma.$queryRaw`
            SELECT safe_delete_record(
                ${tableName}::VARCHAR(50),
                ${recordId}::INTEGER,
                ${clientId}::VARCHAR(25),
                ${symbol}::VARCHAR(15),
                ${fiscalYearId}::INTEGER,
                ${forceDelete}::BOOLEAN
            ) as result
        ` as any[];
        
        const deleteResult = result[0]?.result;
        
        // Revalidate cache if deletion was successful
        if (deleteResult?.success) {
            revalidatePath('/dashboard');
            revalidatePath('/dashboard/ledger');
            revalidatePath('/dashboard/fiscal-year-mapping');
        }
        
        return {
            success: deleteResult?.success || false,
            message: deleteResult?.message || 'Unknown deletion result',
            data: deleteResult
        };
        
    } catch (error) {
        console.error('Safe deletion error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to delete record safely'
        }
    }
}

/**
 * Get deletion impact analysis before actually deleting
 * Shows what would be affected by deleting a specific record
 */
export async function getDeletionImpact(
    tableName: string,
    recordId: number,
    clientId?: string,
    symbol?: string,
    fiscalYearId?: number
) {
    try {
        // Analyze deletion impact without logging (read-only operation)
        
        // Get the record details first
        let recordData: any = null;
        
        switch (tableName) {
            case 'bonus_records':
                recordData = await prisma.bonus_records.findUnique({
                    where: { bonus_id: recordId },
                    include: {
                        client_broker_mapping: true,
                        fiscal_years: true,
                        stock_fulls: true
                    }
                });
                break;
                
            case 'right_records':
                recordData = await prisma.right_records.findUnique({
                    where: { right_id: recordId },
                    include: {
                        client_broker_mapping: true,
                        fiscal_years: true,
                        stock_fulls: true
                    }
                });
                break;
                
            case 'cash_records':
                recordData = await prisma.cash_records.findUnique({
                    where: { cash_id: recordId },
                    include: {
                        client_broker_mapping: true,
                        fiscal_years: true,
                        stock_fulls: true
                    }
                });
                break;
                
            case 'closeout_records':
                recordData = await prisma.closeout_records.findUnique({
                    where: { closeout_id: recordId },
                    include: {
                        client_broker_mapping: true,
                        fiscal_years: true,
                        stock_fulls: true
                    }
                });
                break;
                
            default:
                throw new Error(`Impact analysis not supported for table: ${tableName}`);
        }
        
        if (!recordData) {
            return {
                success: false,
                message: 'Record not found',
                data: null
            };
        }
        
        // Check validation safety
        const safetyCheck = await prisma.$queryRaw`
            SELECT validate_deletion_safety(
                ${tableName}::VARCHAR(50),
                ${recordId}::INTEGER,
                ${recordData.client_id}::VARCHAR(25),
                ${recordData.symbol}::VARCHAR(15),
                ${recordData.fiscal_year_id}::INTEGER
            ) as is_safe
        ` as any[];
        
        const isSafe = safetyCheck[0]?.is_safe || false;
        
        // Get affected fiscal year balance
        const affectedBalance = await prisma.fiscal_year_balance.findFirst({
            where: {
                client_id: recordData.client_id,
                symbol: recordData.symbol,
                fiscal_year_id: recordData.fiscal_year_id
            }
        });
        
        return {
            success: true,
            data: {
                record: recordData,
                isSafe,
                affectedBalance,
                recommendations: isSafe 
                    ? ['Safe to delete - no data inconsistencies detected']
                    : [
                        'WARNING: Deletion may cause data inconsistencies',
                        'Consider using force_delete=true if you understand the risks',
                        'Backup will be created automatically before deletion'
                    ]
            }
        };
        
    } catch (error) {
        console.error('Deletion impact analysis error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to analyze deletion impact'
        }
    }
}

/**
 * Comprehensive system validation to ensure data consistency and flexibility
 * This function checks all critical aspects of the system
 */
export async function validateSystemConsistency() {
    try {
        // Create audit log for system validation
        await prisma.audit_log.create({
            data: {
                performed_action: 'System consistency validation initiated'
            }
        });
        
        const validationResults = {
            triggerFunctions: { status: 'checking', issues: [] as string[] },
            deletionSafety: { status: 'checking', issues: [] as string[] },
            calculationAccuracy: { status: 'checking', issues: [] as string[] },
            temporalConsistency: { status: 'checking', issues: [] as string[] },
            auditTrail: { status: 'checking', issues: [] as string[] }
        }

        // 1. Check if all trigger functions exist and are properly configured
        try {
            const triggerCheck = await prisma.$queryRaw`
                SELECT 
                    t.tgname as trigger_name,
                    c.relname as table_name,
                    p.proname as function_name
                FROM pg_trigger t
                JOIN pg_class c ON t.tgrelid = c.oid
                JOIN pg_proc p ON t.tgfoid = p.oid
                WHERE t.tgname LIKE 'trg_%'
                ORDER BY c.relname, t.tgname
            ` as any[]

            const expectedTriggers = [
                'trg_bonus_records_fiscal_balance',
                'trg_right_records_fiscal_balance', 
                'trg_cash_records_fiscal_balance',
                'trg_closeout_records_fiscal_balance',
                'trg_promoter_records_fiscal_balance',
                'trg_ipo_allotment_records_fiscal_balance'
            ]

            const existingTriggers = triggerCheck.map(t => t.trigger_name)
            const missingTriggers = expectedTriggers.filter(t => !existingTriggers.includes(t))
            
            if (missingTriggers.length > 0) {
                validationResults.triggerFunctions.issues.push(`Missing triggers: ${missingTriggers.join(', ')}`)
            }
            
            validationResults.triggerFunctions.status = missingTriggers.length > 0 ? 'warning' : 'success'
        } catch (error) {
            validationResults.triggerFunctions.status = 'error'
            validationResults.triggerFunctions.issues.push(`Trigger validation failed: ${error}`)
        }

        // 2. Check deletion safety function
        try {
            const safetyCheck = await prisma.$queryRaw`
                SELECT proname FROM pg_proc WHERE proname = 'safe_delete_record'
            ` as any[]
            
            if (safetyCheck.length === 0) {
                validationResults.deletionSafety.status = 'error'
                validationResults.deletionSafety.issues.push('Safe deletion function not found')
            } else {
                validationResults.deletionSafety.status = 'success'
            }
        } catch (error) {
            validationResults.deletionSafety.status = 'error'
            validationResults.deletionSafety.issues.push(`Deletion safety check failed: ${error}`)
        }

        // 3. Check calculation accuracy with sample data
        try {
            const balanceConsistency = await validateBalanceConsistency()
            if (balanceConsistency.success && balanceConsistency.data?.hasInconsistencies) {
                validationResults.calculationAccuracy.status = 'warning'
                validationResults.calculationAccuracy.issues.push(`Found ${Array.isArray(balanceConsistency.data?.inconsistencies) ? balanceConsistency.data.inconsistencies.length : 0} balance inconsistencies`)
            } else {
                validationResults.calculationAccuracy.status = 'success'
            }
        } catch (error) {
            validationResults.calculationAccuracy.status = 'error'
            validationResults.calculationAccuracy.issues.push(`Calculation accuracy check failed: ${error}`)
        }

        // 4. Check temporal recalculation functions
        try {
            const temporalCheck = await prisma.$queryRaw`
                SELECT proname FROM pg_proc 
                WHERE proname IN (
                    'fn_recalculate_balances_from_date',
                    'fn_recalculate_sell_profit_loss_from_date',
                    'fn_recalculate_fiscal_balances_from_date'
                )
            ` as any[]
            
            if (temporalCheck.length < 3) {
                validationResults.temporalConsistency.status = 'error'
                validationResults.temporalConsistency.issues.push('Missing temporal recalculation functions')
            } else {
                validationResults.temporalConsistency.status = 'success'
            }
        } catch (error) {
            validationResults.temporalConsistency.status = 'error'
            validationResults.temporalConsistency.issues.push(`Temporal consistency check failed: ${error}`)
        }

        // 5. Check audit trail functionality
        try {
            const auditCheck = await prisma.audit_log.count()
            if (auditCheck > 0) {
                validationResults.auditTrail.status = 'success'
            } else {
                validationResults.auditTrail.status = 'warning'
                validationResults.auditTrail.issues.push('No audit records found - system may not be logging properly')
            }
        } catch (error) {
            validationResults.auditTrail.status = 'error'
            validationResults.auditTrail.issues.push(`Audit trail check failed: ${error}`)
        }

        // Calculate overall system health
        const allStatuses = Object.values(validationResults).map(r => r.status)
        const hasErrors = allStatuses.includes('error')
        const hasWarnings = allStatuses.includes('warning')
        
        const overallStatus = hasErrors ? 'error' : hasWarnings ? 'warning' : 'success'
        const totalIssues = Object.values(validationResults).reduce((sum, r) => sum + r.issues.length, 0)

        return {
            success: true,
            data: {
                overallStatus,
                totalIssues,
                validationResults,
                summary: {
                    status: overallStatus,
                    message: overallStatus === 'success' 
                        ? 'System is fully consistent and flexible'
                        : overallStatus === 'warning'
                        ? `System is functional but has ${totalIssues} warnings`
                        : `System has ${totalIssues} critical issues that need attention`,
                    recommendations: overallStatus === 'success' 
                        ? ['System is production-ready']
                        : Object.values(validationResults)
                            .filter(r => r.issues.length > 0)
                            .flatMap(r => r.issues)
                }
            }
        }
        
    } catch (error) {
        console.error('System validation error:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to validate system consistency'
        }
    }
}
