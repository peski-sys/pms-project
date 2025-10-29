"use server"

import { prisma } from '@/lib/db';

// Get stock symbols for autocomplete
export async function getStockSymbols(query?: string) {
    try {
        const stocks = await prisma.stock_fulls.findMany({
            where: query ? {
                symbol: {
                    contains: query.toUpperCase(),
                    mode: 'insensitive'
                }
            } : {},
            select: {
                symbol: true,
                full_form: true
            },
            take: 20, // Limit to 20 suggestions
            orderBy: {
                symbol: 'asc'
            }
        });
        
        return stocks;
    } catch (error) {
        console.error('Error fetching stock symbols:', error);
        return [];
    }
}

// Get current holdings for bonus calculation
export async function getCurrentHoldings(fundName: string, clientId: string, symbol: string) {
    try {
        // Get current fiscal year
        const currentDate = new Date();
        const currentFiscalYear = await prisma.fiscal_years.findFirst({
            where: {
                start_date: { lte: currentDate },
                end_date: { gte: currentDate }
            },
            select: { fiscal_year_id: true }
        });

        if (!currentFiscalYear) {
            return {
                success: false,
                message: 'No current fiscal year found',
                quantity: 0
            };
        }

        // Get holdings from fiscal_year_balance table
        const holdings = await prisma.fiscal_year_balance.findFirst({
            where: {
                symbol: symbol.toUpperCase(),
                client_id: clientId,
                fiscal_year_id: currentFiscalYear.fiscal_year_id,
                client_broker_mapping: {
                    client_name: fundName
                }
            },
            select: {
                closing_quantity: true,
                symbol: true,
                client_id: true
            }
        });

        if (!holdings) {
            return {
                success: false,
                message: `No holdings found for ${symbol} under client ${clientId} in fund ${fundName}`,
                quantity: 0
            };
        }

        return {
            success: true,
            message: 'Holdings found',
            quantity: Number(holdings.closing_quantity),
            symbol: holdings.symbol,
            clientId: holdings.client_id
        };
        
    } catch (error) {
        console.error('Error fetching holdings:', error);
        return {
            success: false,
            message: 'Error fetching holdings data',
            quantity: 0
        };
    }
}

export async function uploadCloseout(currentFund: string, currentClient: string, stock_symbol: string, stock_quantity: number, stock_amount: number, stock_added_at: string) {
    try {
        // Validate inputs
        if (!currentFund || !currentClient || !stock_symbol || !stock_added_at) {
            throw new Error('Missing required parameters for closeout upload');
        }

        if (stock_quantity <= 0 || stock_amount <= 0) {
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

        // Create promoter record
        await prisma.closeout_records.create({
            data: {
                fund_id: Number(stock_fund_id),
                client_id: currentClient,
                symbol: stock_symbol.toUpperCase(),
                closeout_quantity: stock_quantity,
                closeout_amount: stock_amount,
                closeout_date: parsed_date,
                fiscal_year_id: stock_fiscal_id
            }
        });

        // Create audit log
        await prisma.audit_log.create({
            data: {
                performed_action: `Added New Closeout Balance: ${stock_symbol} for ${currentClient} (${stock_quantity} shares for total amount of ${stock_amount})`
            }
        });

        console.log(`Successfully uploaded closeout record for ${stock_symbol}`);
        return {
            success: true,
            message: 'Closeout record uploaded successfully',
            data: {
                symbol: stock_symbol,
                quantity: stock_quantity,
                amount: stock_amount,
                client: currentClient,
                fund: currentFund
            }
        };

    } catch (error) {
        console.error('Error uploading closeout record:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to upload closeout record'
        };
    }
}

export async function uploadPromoter(currentFund: string, currentClient: string, stock_symbol: string, stock_quantity: number, stock_price: number, stock_added_at: string, sub_id?: number) {
    try {
        // Validate inputs
        if (!currentFund || !currentClient || !stock_symbol || !stock_added_at) {
            throw new Error('Missing required parameters for promoter upload');
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

        // Create promoter record
        await prisma.promoter_records.create({
            data: {
                fund_id: Number(stock_fund_id),
                client_id: currentClient,
                symbol: stock_symbol.toUpperCase(),
                quantity: stock_quantity,
                added_at: parsed_date,
                effective_rate: stock_price,
                fiscal_year_id: stock_fiscal_id,
                sub_id: sub_id || 1  // Default to 1 if not provided
            }
        });

        // Create audit log
        await prisma.audit_log.create({
            data: {
                performed_action: `Added New Promoter Record: ${stock_symbol} for ${currentClient} (${stock_quantity} shares at ${stock_price})`
            }
        });

        console.log(`Successfully uploaded promoter record for ${stock_symbol}`);
        return {
            success: true,
            message: 'Promoter record uploaded successfully',
            data: {
                symbol: stock_symbol,
                quantity: stock_quantity,
                price: stock_price,
                client: currentClient,
                fund: currentFund
            }
        };

    } catch (error) {
        console.error('Error uploading promoter record:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to upload promoter record'
        };
    }
}




export async function uploadBonus(currentFund: string, currentClient: string, stock_symbol: string, stock_bonus_percent: number, calculatedBonusShares: number, book_close: string, price_per_share: number) {
    try {
        // Validate inputs
        if (!currentFund || !currentClient || !stock_symbol || !book_close) {
            throw new Error('Missing required parameters for bonus upload');
        }

        if (stock_bonus_percent <= 0 || calculatedBonusShares <= 0 || price_per_share <= 0) {
            throw new Error('Bonus percent, calculated shares, and price must be greater than 0');
        }

        const parsed_date = new Date(book_close);
        if (isNaN(parsed_date.getTime())) {
            throw new Error('Invalid book close date format');
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
            throw new Error(`No fiscal year found for date: ${book_close}`);
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

        // Create bonus record
        await prisma.bonus_records.create({
            data: {
                fund_id: stock_fund_id,
                client_id: currentClient,
                symbol: stock_symbol.toUpperCase(),
                bonus_percent: stock_bonus_percent,
                quantity: calculatedBonusShares,
                bookclose_date: parsed_date,
                effective_rate: price_per_share,
                fiscal_year_id: stock_fiscal_id
            }
        });

        // Create audit log
        await prisma.audit_log.create({
            data: {
                performed_action: `Uploaded Bonus Shares Record for ${stock_symbol} (${stock_bonus_percent}% Bonus, ${calculatedBonusShares} shares)`
            }
        });

        console.log(`Successfully uploaded bonus record for ${stock_symbol}`);
        return {
            success: true,
            message: 'Bonus record uploaded successfully',
            data: {
                symbol: stock_symbol,
                bonusPercent: stock_bonus_percent,
                bonusShares: calculatedBonusShares,
                pricePerShare: price_per_share,
                client: currentClient,
                fund: currentFund
            }
        };

    } catch (error) {
        console.error('Error uploading bonus record:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to upload bonus record'
        };
    }
}




export async function uploadRight(currentFund: string, currentClient: string, stock_symbol: string, first_right_ratio: number, second_right_ratio: number, calculatedRightShares: number, stock_book_close: string, stock_price_per_share: number) {
    const parsed_date = new Date(stock_book_close)

        const get_fiscal = await prisma.fiscal_years.findMany({
        where: {
            start_date: {
                lte: parsed_date
            },
            end_date: {
                gte: parsed_date
            },
        },
        select: {
            fiscal_year_id: true,
        }
    })

    const get_fund_id = await prisma.funds.findMany({
        where: {
            fund_name: currentFund
        }
    })

    const stock_fiscal_id = get_fiscal[0].fiscal_year_id
    const stock_fund_id = get_fund_id[0].fund_id

    try {
        await prisma.right_records.create({
            data: {
                fund_id: stock_fund_id,
                client_id: currentClient,
                symbol: stock_symbol,
                right_ratio: `${first_right_ratio}:${second_right_ratio}`,
                bookclose_date: parsed_date,
                quantity: calculatedRightShares,
                effective_rate: stock_price_per_share,
                fiscal_year_id: stock_fiscal_id
            }
        })

        await prisma.audit_log.create({
            data: {
                performed_action: `Uploaded Right Shares Record for ${stock_symbol} (${first_right_ratio}:${second_right_ratio})`
            }
        })
    } catch(e) {
        console.log(`Error Performing Right Action: ${e}`)
    }
}





export async function uploadCash(currentFund: string, currentClient: string, stock_symbol: string, stock_cash_amount: number, stock_book_close: string) {
    const parsed_date = new Date(stock_book_close)

    const get_fund_id = await prisma.funds.findMany({
        where: {
            fund_name: currentFund,
        }
    })
    const stock_fund_id = get_fund_id[0].fund_id

    const get_fiscal_id = await prisma.fiscal_years.findMany({
        where: {
            start_date: {
                lte: parsed_date
            },
            end_date: {
                gte: parsed_date
            }
        }
    })
    const stock_fiscal_id = get_fiscal_id[0].fiscal_year_id

    await prisma.cash_records.create({
        data: {
            fund_id: stock_fund_id,
            fiscal_year_id: stock_fiscal_id,
            client_id: currentClient,
            symbol: stock_symbol,
            amount: stock_cash_amount,
            bookclose_date: parsed_date
        }
    })

    await prisma.audit_log.create({
        data: {
            performed_action: `Uploaded Cash Record for ${currentClient} | Amount: ${stock_cash_amount}`
        }
    })
}