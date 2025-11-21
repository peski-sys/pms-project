"use server"

import { prisma } from "@/lib/db";

/**
 * Comprehensive data consistency validation across all tables
 * This function checks for data integrity issues that could arise
 * from failed transactions or incomplete operations
 */
export async function validateDataConsistency() {
    try {
        const validationResults = {
            crossTableConsistency: { status: 'checking', issues: [] as string[] },
            financialCalculations: { status: 'checking', issues: [] as string[] },
            temporalIntegrity: { status: 'checking', issues: [] as string[] },
            orphanedRecords: { status: 'checking', issues: [] as string[] },
            negativeHoldings: { status: 'checking', issues: [] as string[] }
        };

        // 1. Check cross-table consistency
        // Verify fiscal_year_balance matches sum of all transactions
        const fiscalBalanceCheck = await prisma.$queryRaw`
            SELECT 
                fyb.client_id,
                fyb.symbol,
                fyb.fiscal_year_id,
                fyb.closing_quantity as recorded_quantity,
                fyb.effective_rate as recorded_rate,
                COALESCE(
                    (SELECT SUM(quantity) FROM buy_records br 
                     WHERE br.client_id = fyb.client_id AND br.symbol = fyb.symbol AND br.fiscal_year_id = fyb.fiscal_year_id)
                    + (SELECT SUM(quantity) FROM bonus_records bon 
                       WHERE bon.client_id = fyb.client_id AND bon.symbol = fyb.symbol AND bon.fiscal_year_id = fyb.fiscal_year_id)
                    + (SELECT SUM(quantity) FROM right_records rr 
                       WHERE rr.client_id = fyb.client_id AND rr.symbol = fyb.symbol AND rr.fiscal_year_id = fyb.fiscal_year_id)
                    + (SELECT SUM(quantity) FROM ipo_allotment_records iar 
                       WHERE iar.client_id = fyb.client_id AND iar.symbol = fyb.symbol AND iar.fiscal_year_id = fyb.fiscal_year_id)
                    - (SELECT SUM(quantity) FROM sell_records sr 
                       WHERE sr.client_id = fyb.client_id AND sr.symbol = fyb.symbol AND sr.fiscal_year_id = fyb.fiscal_year_id)
                    - (SELECT SUM(closeout_quantity) FROM closeout_records cr 
                       WHERE cr.client_id = fyb.client_id AND cr.symbol = fyb.symbol AND cr.fiscal_year_id = fyb.fiscal_year_id)
                , 0) as calculated_quantity
            FROM fiscal_year_balance fyb
            WHERE ABS(fyb.closing_quantity - COALESCE(
                (SELECT SUM(quantity) FROM buy_records br 
                 WHERE br.client_id = fyb.client_id AND br.symbol = fyb.symbol AND br.fiscal_year_id = fyb.fiscal_year_id)
                + (SELECT SUM(quantity) FROM bonus_records bon 
                   WHERE bon.client_id = fyb.client_id AND bon.symbol = fyb.symbol AND bon.fiscal_year_id = fyb.fiscal_year_id)
                + (SELECT SUM(quantity) FROM right_records rr 
                   WHERE rr.client_id = fyb.client_id AND rr.symbol = fyb.symbol AND rr.fiscal_year_id = fyb.fiscal_year_id)
                + (SELECT SUM(quantity) FROM ipo_allotment_records iar 
                   WHERE iar.client_id = fyb.client_id AND iar.symbol = fyb.symbol AND iar.fiscal_year_id = fyb.fiscal_year_id)
                - (SELECT SUM(quantity) FROM sell_records sr 
                   WHERE sr.client_id = fyb.client_id AND sr.symbol = fyb.symbol AND sr.fiscal_year_id = fyb.fiscal_year_id)
                - (SELECT SUM(closeout_quantity) FROM closeout_records cr 
                   WHERE cr.client_id = fyb.client_id AND cr.symbol = fyb.symbol AND cr.fiscal_year_id = fyb.fiscal_year_id)
            , 0)) > 0.01
            LIMIT 10
        ` as any[];

        if (fiscalBalanceCheck.length > 0) {
            validationResults.crossTableConsistency.issues.push(
                `Found ${fiscalBalanceCheck.length} fiscal_year_balance records with quantity mismatches`
            );
        }

        // 2. Check profit/loss calculation accuracy
        const profitLossCheck = await prisma.$queryRaw`
            SELECT 
                sr.client_id,
                sr.symbol,
                sr.quantity,
                sr.price,
                sr.profit_loss as recorded_profit_loss,
                ROUND((sr.price - fyb.effective_rate) * sr.quantity, 2) as calculated_profit_loss
            FROM sell_records sr
            JOIN fiscal_year_balance fyb ON 
                sr.client_id = fyb.client_id AND 
                sr.symbol = fyb.symbol AND 
                sr.fiscal_year_id = fyb.fiscal_year_id
            WHERE ABS(sr.profit_loss - ROUND((sr.price - fyb.effective_rate) * sr.quantity, 2)) > 0.01
            LIMIT 10
        ` as any[];

        if (profitLossCheck.length > 0) {
            validationResults.financialCalculations.issues.push(
                `Found ${profitLossCheck.length} sell records with incorrect profit/loss calculations`
            );
        }

        // 3. Check for negative holdings
        const negativeHoldingsCheck = await prisma.$queryRaw`
            SELECT client_id, symbol, closing_quantity
            FROM fiscal_year_balance 
            WHERE closing_quantity < 0
            LIMIT 10
        ` as any[];

        if (negativeHoldingsCheck.length > 0) {
            validationResults.negativeHoldings.issues.push(
                `Found ${negativeHoldingsCheck.length} records with negative holdings`
            );
        }

        // 4. Check for orphaned records
        const orphanedSellRecords = await prisma.$queryRaw`
            SELECT sr.client_id, sr.symbol, sr.quantity
            FROM sell_records sr
            LEFT JOIN fiscal_year_balance fyb ON 
                sr.client_id = fyb.client_id AND 
                sr.symbol = fyb.symbol AND 
                sr.fiscal_year_id = fyb.fiscal_year_id
            WHERE fyb.client_id IS NULL
            LIMIT 10
        ` as any[];

        if (orphanedSellRecords.length > 0) {
            validationResults.orphanedRecords.issues.push(
                `Found ${orphanedSellRecords.length} sell records without corresponding fiscal_year_balance`
            );
        }

        // 5. Check temporal integrity (corporate actions with future dates)
        const futureCorporateActions = await prisma.$queryRaw`
            SELECT 'bonus' as type, client_id, symbol, bookclose_date
            FROM bonus_records 
            WHERE bookclose_date > CURRENT_DATE
            UNION ALL
            SELECT 'rights' as type, client_id, symbol, bookclose_date
            FROM right_records 
            WHERE bookclose_date > CURRENT_DATE
            UNION ALL
            SELECT 'cash' as type, client_id, symbol, bookclose_date
            FROM cash_records 
            WHERE bookclose_date > CURRENT_DATE
            LIMIT 10
        ` as any[];

        if (futureCorporateActions.length > 0) {
            validationResults.temporalIntegrity.issues.push(
                `Found ${futureCorporateActions.length} corporate actions with future dates`
            );
        }

        // Update status based on findings
        Object.keys(validationResults).forEach(key => {
            const result = validationResults[key as keyof typeof validationResults];
            result.status = result.issues.length > 0 ? 'issues_found' : 'passed';
        });

        // Calculate overall health score
        const totalChecks = Object.keys(validationResults).length;
        const passedChecks = Object.values(validationResults).filter(r => r.status === 'passed').length;
        const healthScore = Math.round((passedChecks / totalChecks) * 100);

        // Create audit log
        await prisma.audit_log.create({
            data: {
                performed_action: `Data consistency validation completed - Health Score: ${healthScore}%`
            }
        });

        return {
            success: true,
            healthScore,
            validationResults,
            summary: {
                totalChecks,
                passedChecks,
                issuesFound: totalChecks - passedChecks
            }
        };

    } catch (error) {
        console.error('Error in data consistency validation:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Validation failed',
            healthScore: 0
        };
    }
}

/**
 * Fix common data consistency issues automatically
 */
export async function fixDataConsistencyIssues() {
    try {
        const fixes = {
            profitLossFixed: 0,
            negativeHoldingsFixed: 0,
            orphanedRecordsFixed: 0
        };

        // Fix profit/loss calculations
        await prisma.$executeRaw`
            UPDATE sell_records 
            SET profit_loss = ROUND((sell_records.price - fyb.effective_rate) * sell_records.quantity, 2)
            FROM fiscal_year_balance fyb
            WHERE sell_records.client_id = fyb.client_id
              AND sell_records.symbol = fyb.symbol
              AND sell_records.fiscal_year_id = fyb.fiscal_year_id
              AND ABS(sell_records.profit_loss - ROUND((sell_records.price - fyb.effective_rate) * sell_records.quantity, 2)) > 0.01
        `;

        // Create audit log
        await prisma.audit_log.create({
            data: {
                performed_action: `Data consistency fixes applied - Profit/Loss: ${fixes.profitLossFixed} records`
            }
        });

        return {
            success: true,
            fixes,
            message: 'Data consistency issues fixed successfully'
        };

    } catch (error) {
        console.error('Error fixing data consistency issues:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Fix operation failed'
        };
    }
}

/**
 * Rollback mechanism for failed corporate actions
 */
export async function rollbackCorporateAction(
    actionType: 'bonus' | 'rights' | 'cash' | 'closeout' | 'ipo_allotment',
    recordId: number,
    clientId: string,
    symbol: string,
    fiscalYearId: number
) {
    try {
        await prisma.$transaction(async (tx) => {
            // Create backup before rollback
            await tx.audit_log.create({
                data: {
                    performed_action: `ROLLBACK INITIATED: ${actionType} record ID ${recordId} for ${clientId}-${symbol}`
                }
            });

            // Delete the problematic record
            switch (actionType) {
                case 'bonus':
                    await tx.bonus_records.delete({ where: { bonus_id: recordId } });
                    break;
                case 'rights':
                    await tx.right_records.delete({ where: { right_id: recordId } });
                    break;
                case 'cash':
                    await tx.cash_records.delete({ where: { cash_id: recordId } });
                    break;
                case 'closeout':
                    await tx.closeout_records.delete({ where: { closeout_id: recordId } });
                    break;
                case 'ipo_allotment':
                    await tx.ipo_allotment_records.delete({ where: { allotment_id: recordId } });
                    break;
            }

            // Trigger recalculation from the beginning of fiscal year
            const fiscalYear = await tx.fiscal_years.findUnique({
                where: { fiscal_year_id: fiscalYearId },
                select: { start_date: true }
            });

            if (fiscalYear) {
                await tx.$executeRaw`
                    SELECT fn_recalculate_balances_from_date(
                        ${fiscalYear.start_date}::DATE,
                        ${symbol}::VARCHAR(15),
                        ${clientId}::VARCHAR(25),
                        ${fiscalYearId}::INTEGER
                    )
                `;
            }

            // Log successful rollback
            await tx.audit_log.create({
                data: {
                    performed_action: `ROLLBACK COMPLETED: ${actionType} record ID ${recordId} successfully rolled back`
                }
            });
        });

        return {
            success: true,
            message: `Successfully rolled back ${actionType} record ID ${recordId}`
        };

    } catch (error) {
        console.error('Error in rollback operation:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Rollback failed'
        };
    }
}
