"use server";
import { prisma } from "@/lib/db";
import { FinancialCalculator } from "@/lib/decimalUtils";


export async function getSelectedUser(c_name: string) {
    const selected_user = await prisma.client_broker_mapping.findMany( { 
        where: {
            client_name: c_name
        }
    } )
    return selected_user
}


export async function filterDataGrouped(symbol: string, fiscalID: string, currentFund: string) {
    const given_symbol = symbol as string
    const given_fiscal = Number(fiscalID)
    const given_fund = currentFund

    const purchase_record = await prisma.buy_records.findMany({
        where: {
            symbol: given_symbol,
            fiscal_year_id: given_fiscal,
            client_broker_mapping: {
                client_name: given_fund
            }
        }
    })

    const sales_record = await prisma.sell_records.findMany({
        where: {
            symbol: given_symbol,
            fiscal_year_id: given_fiscal,
            client_broker_mapping: {
                client_name: given_fund
            }
        }
    })

    // Fetch closeout records to add to purchase records with negative values
    const closeout_records = await prisma.closeout_records.findMany({
        where: {
            symbol: given_symbol,
            fiscal_year_id: given_fiscal,
            client_broker_mapping: {
                client_name: given_fund
            }
        }
    })

    // Get the current fiscal year details
    const current_fiscal_year = await prisma.fiscal_years.findUnique({
        where: {
            fiscal_year_id: given_fiscal
        },
        select: {
            fiscal_year_id: true,
            year_label: true,
            start_date: true,
            end_date: true
        }
    })

    // Fetch opening balance from the CURRENT selected fiscal year
    const opening_balances = await prisma.fiscal_year_balance.findMany({
        where: {
            fiscal_year_id: given_fiscal, // Use current fiscal year, not previous
            symbol: given_symbol,
            client_broker_mapping: {
                client_name: given_fund
            }
        },
        select: {
            symbol: true,
            opening_quantity: true,
            effective_rate: true,
            opening_rate: true,
            closing_quantity: true,
            remarks: true,
            client_id: true,
            source_type: true
        }
    })

    // Fetch bonus records
    const bonus_records = await prisma.bonus_records.findMany({
        where: {
            fiscal_year_id: given_fiscal,
            symbol: given_symbol,
            client_broker_mapping: {
                client_name: given_fund
            }
        },
        select: {
            bonus_id: true,
            quantity: true,
            effective_rate: true,
            bonus_percent: true,
            bookclose_date: true,
            client_id: true,
            remarks: true
        }
    })

    // Fetch right records
    const right_records = await prisma.right_records.findMany({
        where: {
            fiscal_year_id: given_fiscal,
            symbol: given_symbol,
            client_broker_mapping: {
                client_name: given_fund
            }
        },
        select: {
            right_id: true,
            quantity: true,
            effective_rate: true,
            right_ratio: true,
            bookclose_date: true,
            total_value: true,
            client_id: true,
            remarks: true
        }
    })

    // Check if any opening balance records have source_type 'PROMOTER'
    const hasPromoterSourceType = opening_balances.some(record => record.source_type === 'PROMOTER')
    
    // Only fetch promoter records if no opening balance records have source_type 'PROMOTER'
    const promoter_records = hasPromoterSourceType ? [] : await prisma.promoter_records.findMany({
        where: {
            fiscal_year_id: given_fiscal,
            symbol: given_symbol,
            client_broker_mapping: {
                client_name: given_fund
            }
        },
        select: {
            promoter_id: true,
            quantity: true,
            effective_rate: true,
            total_value: true,
            added_at: true,
            client_id: true,
            remarks: true
        }
    })

    // Fetch IPO allotment records (Note: IPO allotment records don't have symbol field in schema)
    // We'll fetch all IPO records for the fiscal year and fund since they might be relevant
    const ipo_allotment_records = await prisma.ipo_allotment_records.findMany({
        where: {
            fiscal_year_id: given_fiscal,
            client_broker_mapping: {
                client_name: given_fund
            }
        },
        select: {
            allotment_id: true,
            quantity: true,
            effective_rate: true,
            total_value: true,
            added_at: true,
            client_id: true,
            remarks: true
        }
    })

    // Get fund_id from client name first
    const clientMapping = await prisma.client_broker_mapping.findFirst({
        where: {
            client_name: given_fund
        },
        select: {
            fund_id: true
        }
    })

    // Fetch IPO staging records from fiscal_year_balance_staging for eligible records
    const ipo_allotment_staging_records = clientMapping ? await prisma.fiscal_year_balance_staging.findMany({
        where: {
            fiscal_year_id: given_fiscal,
            symbol: given_symbol,
            fund_id: clientMapping.fund_id
        },
        select: {
            staging_id: true,
            closing_quantity: true,
            effective_rate: true,
            remarks: true,
            sub_id: true,
            demat: true,
            non_demat: true
        }
    }) : []

    // Group purchase records by date, symbol, and client_id
    const purchaseGroups = new Map<string, {
        transaction_date: Date | null,
        client_id: string,
        symbol: string,
        total_quantity: number,
        weighted_price_sum: number,
        total_txn_value: number,
        total_commission_amount: number,
        total_sebon_commission: number,
        total_net_payable: number,
        commission_rate: string | null,
        effective_rate: number,
        fiscal_year_id: number | null,
        fund_id: number,
        upload_id: number,
        recorded_at: Date | null,
        remarks?: string,
        is_closeout?: boolean
    }>()

    purchase_record.forEach(record => {
        const dateStr = record.transaction_date?.toDateString() || 'null'
        const key = `${dateStr}-${record.symbol}-${record.client_id}`
        
        const existing = purchaseGroups.get(key)
        if (existing) {
            existing.total_quantity += record.quantity
            existing.weighted_price_sum = FinancialCalculator.add(
                existing.weighted_price_sum, 
                FinancialCalculator.multiply(String(record.price), record.quantity)
            )
            existing.total_txn_value = FinancialCalculator.add(existing.total_txn_value, String(record.txn_value))
            existing.total_commission_amount = FinancialCalculator.add(existing.total_commission_amount, String(record.commission_amount) || '0')
            existing.total_sebon_commission = FinancialCalculator.add(existing.total_sebon_commission, String(record.sebon_commission) || '0')
            existing.total_net_payable = FinancialCalculator.add(existing.total_net_payable, String(record.net_payable) || '0')
            if (!existing.remarks && (record as any).remarks) existing.remarks = (record as any).remarks as any
        } else {
            purchaseGroups.set(key, {
                transaction_date: record.transaction_date,
                client_id: record.client_id,
                symbol: record.symbol,
                total_quantity: record.quantity,
                weighted_price_sum: FinancialCalculator.multiply(String(record.price), record.quantity),
                total_txn_value: FinancialCalculator.round(String(record.txn_value)),
                total_commission_amount: FinancialCalculator.round(String(record.commission_amount) || '0'),
                total_sebon_commission: FinancialCalculator.round(String(record.sebon_commission) || '0'),
                total_net_payable: FinancialCalculator.round(String(record.net_payable) || '0'),
                commission_rate: record.commission_rate,
                effective_rate: FinancialCalculator.round(String(record.effective_rate) || '0'),
                fiscal_year_id: record.fiscal_year_id,
                fund_id: record.fund_id,
                upload_id: record.upload_id,
                recorded_at: record.recorded_at,
                remarks: (record as any).remarks as any,
                is_closeout: false
            })
        }
    })

    // Add closeout records as negative purchase records
    closeout_records.forEach(record => {
        const dateStr = record.closeout_date?.toDateString() || 'null'
        const key = `closeout-${dateStr}-${record.symbol}-${record.client_id}`
        
        // Calculate price per share for closeout with decimal precision
        const pricePerShare = record.closeout_quantity > 0 ? 
            FinancialCalculator.divide(String(record.closeout_amount), record.closeout_quantity) : 0
        
        purchaseGroups.set(key, {
            transaction_date: record.closeout_date,
            client_id: record.client_id,
            symbol: record.symbol,
            total_quantity: -record.closeout_quantity, // Negative quantity
            weighted_price_sum: -FinancialCalculator.round(String(record.closeout_amount)), // Negative amount
            total_txn_value: -FinancialCalculator.round(String(record.closeout_amount)),
            total_commission_amount: 0,
            total_sebon_commission: 0,
            total_net_payable: -FinancialCalculator.round(String(record.closeout_amount)),
            commission_rate: null,
            effective_rate: pricePerShare,
            fiscal_year_id: record.fiscal_year_id,
            fund_id: record.fund_id,
            upload_id: 0, // No upload_id for closeout
            recorded_at: record.recorded_at,
            remarks: '',
            is_closeout: true
        })
    })

    // Group sales records by date, symbol, and client_id
    const salesGroups = new Map<string, {
        transaction_date: Date | null,
        client_id: string,
        symbol: string,
        total_quantity: number,
        weighted_price_sum: number,
        total_txn_value: number,
        total_commission_amount: number,
        total_capital_gain_tax: number,
        total_sebon_commission: number,
        total_net_receivable: number,
        total_profit_loss: number,
        commission_rate: string | null,
        effective_rate: number,
        fiscal_year_id: number | null,
        fund_id: number,
        total_approx_profit_loss: number,
        upload_id: number,
        recorded_at: Date | null,
        remarks?: string,
    }>()

    sales_record.forEach(record => {
        const dateStr = record.transaction_date?.toDateString() || 'null'
        const key = `${dateStr}-${record.symbol}-${record.client_id}`
        
        const existing = salesGroups.get(key)
        if (existing) {
            existing.total_quantity += record.quantity
            existing.weighted_price_sum = FinancialCalculator.add(
                existing.weighted_price_sum,
                FinancialCalculator.multiply(String(record.price), record.quantity)
            )
            existing.total_txn_value = FinancialCalculator.add(existing.total_txn_value, String(record.txn_value))
            existing.total_commission_amount = FinancialCalculator.add(existing.total_commission_amount, String(record.commission_amount) || '0')
            existing.total_capital_gain_tax = FinancialCalculator.add(existing.total_capital_gain_tax, String(record.capital_gain_tax) || '0')
            existing.total_sebon_commission = FinancialCalculator.add(existing.total_sebon_commission, String(record.sebon_commission) || '0')
            existing.total_net_receivable = FinancialCalculator.add(existing.total_net_receivable, String(record.net_receivable) || '0')
            existing.total_profit_loss = FinancialCalculator.add(existing.total_profit_loss, String(record.profit_loss) || '0')
            existing.total_approx_profit_loss = FinancialCalculator.add(existing.total_approx_profit_loss, String(record.approx_profit_loss) || '0')
            if (!existing.remarks && (record as any).remarks) existing.remarks = (record as any).remarks as any
        } else {
            salesGroups.set(key, {
                transaction_date: record.transaction_date,
                client_id: record.client_id,
                symbol: record.symbol,
                total_quantity: record.quantity,
                weighted_price_sum: FinancialCalculator.multiply(String(record.price), record.quantity),
                total_txn_value: FinancialCalculator.round(String(record.txn_value)),
                total_commission_amount: FinancialCalculator.round(String(record.commission_amount) || '0'),
                total_capital_gain_tax: FinancialCalculator.round(String(record.capital_gain_tax) || '0'),
                total_sebon_commission: FinancialCalculator.round(String(record.sebon_commission) || '0'),
                total_net_receivable: FinancialCalculator.round(String(record.net_receivable) || '0'),
                total_profit_loss: FinancialCalculator.round(String(record.profit_loss) || '0'),
                commission_rate: record.commission_rate,
                effective_rate: FinancialCalculator.round(String(record.effective_rate) || '0'),
                fiscal_year_id: record.fiscal_year_id,
                fund_id: record.fund_id,
                total_approx_profit_loss: FinancialCalculator.round(String(record.approx_profit_loss) || '0'),
                upload_id: record.upload_id,
                recorded_at: record.recorded_at,
                remarks: (record as any).remarks as any
            })
        }
    })

    // Convert to arrays and calculate average prices with decimal precision
    const purchased_grouped = Array.from(purchaseGroups.values()).map(group => ({
        transaction_date: group.transaction_date,
        client_id: group.client_id,
        symbol: group.symbol,
        quantity: group.total_quantity,
        price: group.total_quantity > 0 ? FinancialCalculator.divide(group.weighted_price_sum, group.total_quantity) : 0,
        txn_value: FinancialCalculator.round(group.total_txn_value),
        commission_amount: FinancialCalculator.round(group.total_commission_amount),
        sebon_commission: FinancialCalculator.round(group.total_sebon_commission),
        net_payable: FinancialCalculator.round(group.total_net_payable),
        commission_rate: group.commission_rate,
        effective_rate: FinancialCalculator.round(group.effective_rate),
        fiscal_year_id: group.fiscal_year_id,
        fund_id: group.fund_id,
        remarks: (group as any).remarks || "",
        contract_number: `grouped-${group.transaction_date?.toDateString()}-${group.symbol}-${group.client_id}`, // Generate unique key for grouped data
        is_closeout: (group as any).is_closeout || false
    })).sort((a, b) => {
        if (!a.transaction_date && !b.transaction_date) return 0
        if (!a.transaction_date) return 1
        if (!b.transaction_date) return -1
        return new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
    })

    const sales_grouped = Array.from(salesGroups.values()).map(group => ({
        transaction_date: group.transaction_date,
        client_id: group.client_id,
        symbol: group.symbol,
        quantity: group.total_quantity,
        price: group.total_quantity > 0 ? FinancialCalculator.divide(group.weighted_price_sum, group.total_quantity) : 0,
        txn_value: FinancialCalculator.round(group.total_txn_value),
        commission_amount: FinancialCalculator.round(group.total_commission_amount),
        capital_gain_tax: FinancialCalculator.round(group.total_capital_gain_tax),
        sebon_commission: FinancialCalculator.round(group.total_sebon_commission),
        net_receivable: FinancialCalculator.round(group.total_net_receivable),
        profit_loss: FinancialCalculator.round(group.total_profit_loss),
        commission_rate: group.commission_rate,
        effective_rate: FinancialCalculator.round(group.effective_rate),
        fiscal_year_id: group.fiscal_year_id,
        fund_id: group.fund_id,
        approx_profit_loss: FinancialCalculator.round(group.total_approx_profit_loss),
        remarks: (group as any).remarks || "",
        contract_number: `grouped-${group.transaction_date?.toDateString()}-${group.symbol}-${group.client_id}` // Generate unique key for grouped data
    })).sort((a, b) => {
        if (!a.transaction_date && !b.transaction_date) return 0
        if (!a.transaction_date) return 1
        if (!b.transaction_date) return -1
        return new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
    })

    // Group opening balance records by fund_id, fiscal_year_id, and effective_rate
    const openingGroups = new Map<string, {
        symbol: string,
        total_quantity: number,
        effective_rate: number,
        opening_rate: number,
        closing_quantity: number,
        total_value: number,
        client_ids: string[],
        remarks: string[],
        date: Date | null,
        previous_fiscal_year_id: number,
        count: number
    }>()

    opening_balances.forEach(record => {
        // Get fund_id from the current query context - we know it's the same fund since we filtered by client_name
        const key = `${given_fiscal}-${record.effective_rate}`
        
        const existing = openingGroups.get(key)
        if (existing) {
            existing.total_quantity += Number(record.opening_quantity)
            existing.closing_quantity += Number(record.closing_quantity)
            existing.total_value = FinancialCalculator.multiply(existing.total_quantity, existing.effective_rate)
            existing.count += 1
            if (record.client_id && !existing.client_ids.includes(record.client_id)) {
                existing.client_ids.push(record.client_id)
            }
            if (record.remarks && !existing.remarks.includes(record.remarks)) {
                existing.remarks.push(record.remarks)
            }
        } else {
            openingGroups.set(key, {
                symbol: record.symbol,
                total_quantity: Number(record.opening_quantity),
                effective_rate: FinancialCalculator.round(Number(record.effective_rate || 0)),
                opening_rate: FinancialCalculator.round(Number(record.opening_rate || 0)),
                closing_quantity: Number(record.closing_quantity),
                total_value: FinancialCalculator.multiply(Number(record.opening_quantity || 0), Number(record.effective_rate || 0)),
                client_ids: record.client_id ? [record.client_id] : [],
                remarks: record.remarks ? [record.remarks] : [],
                date: current_fiscal_year?.start_date || null,
                previous_fiscal_year_id: given_fiscal,
                count: 1
            })
        }
    })

    const opening_sanitized = Array.from(openingGroups.values()).map((group, index) => ({
        symbol: group.symbol,
        opening_quantity: group.total_quantity,
        effective_rate: group.effective_rate,
        opening_rate: group.opening_rate,
        closing_quantity: group.closing_quantity,
        remarks: group.remarks.join('; ') || '',
        total_value: group.total_value,
        record_type: 'opening' as const,
        id: `opening-${index}`,
        date: group.date,
        previous_fiscal_year_id: group.previous_fiscal_year_id,
        client_id: group.client_ids.join(', ') || '',
        combined_count: group.count
    }))
    
    // Group bonus records by fund_id, fiscal_year_id, and effective_rate
    const bonusGroups = new Map<string, {
        total_quantity: number,
        effective_rate: number,
        total_value: number,
        client_ids: string[],
        remarks: string[],
        dates: Date[],
        bonus_percents: number[],
        bonus_ids: number[],
        count: number
    }>()

    bonus_records.forEach(record => {
        const key = `${given_fiscal}-${record.effective_rate}`
        
        const existing = bonusGroups.get(key)
        if (existing) {
            existing.total_quantity += Number(record.quantity)
            existing.total_value = FinancialCalculator.multiply(existing.total_quantity, existing.effective_rate)
            existing.count += 1
            if (record.client_id && !existing.client_ids.includes(record.client_id)) {
                existing.client_ids.push(record.client_id)
            }
            if (record.remarks && !existing.remarks.includes(record.remarks)) {
                existing.remarks.push(record.remarks)
            }
            if (record.bookclose_date && !existing.dates.some(d => d?.getTime() === record.bookclose_date?.getTime())) {
                existing.dates.push(record.bookclose_date)
            }
            const bonusPercent = parseFloat(Number(record.bonus_percent || 0).toFixed(2))
            if (!existing.bonus_percents.includes(bonusPercent)) {
                existing.bonus_percents.push(bonusPercent)
            }
            if (record.bonus_id && !existing.bonus_ids.includes(record.bonus_id)) {
                existing.bonus_ids.push(record.bonus_id)
            }
        } else {
            bonusGroups.set(key, {
                total_quantity: Number(record.quantity),
                effective_rate: FinancialCalculator.round(Number(record.effective_rate || 0)),
                total_value: FinancialCalculator.multiply(Number(record.quantity), Number(record.effective_rate || 0)),
                client_ids: record.client_id ? [record.client_id] : [],
                remarks: record.remarks ? [record.remarks] : [],
                dates: record.bookclose_date ? [record.bookclose_date] : [],
                bonus_percents: [parseFloat(Number(record.bonus_percent || 0).toFixed(2))],
                bonus_ids: record.bonus_id ? [record.bonus_id] : [],
                count: 1
            })
        }
    })

    const bonus_sanitized = Array.from(bonusGroups.values()).map((group, index) => ({
        opening_quantity: group.total_quantity,
        effective_rate: group.effective_rate,
        total_value: group.total_value,
        record_type: 'bonus' as const,
        id: `bonus-${index}`,
        date: group.dates[0] || null, // Use first date as representative
        remarks: group.remarks.join('; ') || '',
        client_id: group.client_ids.join(', '),
        bonus_percent: group.bonus_percents[0] || 0, // Use first bonus percent as representative
        bonus_id: group.bonus_ids[0] || 0, // Use first bonus_id as representative
        combined_count: group.count,
        combined_dates: group.dates,
        combined_bonus_percents: group.bonus_percents,
        combined_bonus_ids: group.bonus_ids
    }))
    
    // Group rights records by fund_id, fiscal_year_id, and effective_rate
    const rightsGroups = new Map<string, {
        total_quantity: number,
        effective_rate: number,
        total_value: number,
        client_ids: string[],
        remarks: string[],
        dates: Date[],
        right_ratios: string[],
        right_ids: number[],
        count: number
    }>()

    right_records.forEach(record => {
        const key = `${given_fiscal}-${record.effective_rate}`
        
        const existing = rightsGroups.get(key)
        if (existing) {
            existing.total_quantity += Number(record.quantity)
            existing.total_value += parseFloat(Number(record.total_value || 0).toFixed(2))
            existing.count += 1
            if (record.client_id && !existing.client_ids.includes(record.client_id)) {
                existing.client_ids.push(record.client_id)
            }
            if (record.remarks && !existing.remarks.includes(record.remarks)) {
                existing.remarks.push(record.remarks)
            }
            if (record.bookclose_date && !existing.dates.some(d => d?.getTime() === record.bookclose_date?.getTime())) {
                existing.dates.push(record.bookclose_date)
            }
            if (record.right_ratio && !existing.right_ratios.includes(record.right_ratio)) {
                existing.right_ratios.push(record.right_ratio)
            }
            if (record.right_id && !existing.right_ids.includes(record.right_id)) {
                existing.right_ids.push(record.right_id)
            }
        } else {
            rightsGroups.set(key, {
                total_quantity: Number(record.quantity),
                effective_rate: FinancialCalculator.round(Number(record.effective_rate || 0)),
                total_value: FinancialCalculator.round(Number(record.total_value || 0)),
                client_ids: record.client_id ? [record.client_id] : [],
                remarks: record.remarks ? [record.remarks] : [],
                dates: record.bookclose_date ? [record.bookclose_date] : [],
                right_ratios: record.right_ratio ? [record.right_ratio] : [],
                right_ids: record.right_id ? [record.right_id] : [],
                count: 1
            })
        }
    })

    const rights_sanitized = Array.from(rightsGroups.values()).map((group, index) => ({
        opening_quantity: group.total_quantity,
        effective_rate: group.effective_rate,
        total_value: group.total_value,
        record_type: 'rights' as const,
        id: `rights-${index}`,
        date: group.dates[0] || null, // Use first date as representative
        remarks: group.remarks.join('; ') || '',
        client_id: group.client_ids.join(', '),
        right_ratio: group.right_ratios[0] || null, // Use first ratio as representative
        right_id: group.right_ids[0] || 0, // Use first right_id as representative
        combined_count: group.count,
        combined_dates: group.dates,
        combined_right_ratios: group.right_ratios,
        combined_right_ids: group.right_ids
    }))
    
    const promoter_sanitized = promoter_records.map((d, index) => ({
        opening_quantity: Number(d.quantity),
        effective_rate: FinancialCalculator.round(Number(d.effective_rate || 0)),
        total_value: FinancialCalculator.round(Number(d.total_value || 0)),
        record_type: 'promoter' as const,
        id: `promoter-${index}`,
        date: d.added_at, // Added at date for promoter records
        remarks: d.remarks || '',
        client_id: d.client_id,
        promoter_id: d.promoter_id
    }))

    // Add IPO allotment records to eligible
    const ipo_allotment_sanitized = ipo_allotment_records.map((d, index) => ({
        opening_quantity: Number(d.quantity),
        effective_rate: FinancialCalculator.round(Number(d.effective_rate || 0)),
        total_value: FinancialCalculator.round(Number(d.total_value || 0)),
        record_type: 'ipo_allotment' as const,
        id: `ipo-${index}`,
        date: d.added_at, // Added at date for IPO allotment records
        remarks: d.remarks || '',
        client_id: d.client_id,
        allotment_id: d.allotment_id
    }))

    // Add IPO staging records to eligible (non-dematerialized)
    const ipo_allotment_staging_sanitized = ipo_allotment_staging_records.map(d => {
        const quantity = Number(d.closing_quantity ?? 0)
        const rate = Number(d.effective_rate ?? 0)
        const totalValue = FinancialCalculator.multiply(String(rate), quantity)
        const resolvedNonDemat = typeof d.non_demat === 'number' ? d.non_demat : quantity - Number(d.demat ?? 0)

        return {
            opening_quantity: quantity,
            effective_rate: Number(FinancialCalculator.round(String(rate))),
            total_value: Number(FinancialCalculator.round(totalValue)),
            record_type: 'ipo_allotment_staging' as const,
            id: `ipo-staging-${d.staging_id}`,
            date: null,
            remarks: d.remarks || '',
            client_id: given_fund,
            staging_id: d.staging_id,
            sub_id: d.sub_id,
            demat: Number(d.demat ?? 0),
            non_demat: resolvedNonDemat > 0 ? resolvedNonDemat : quantity
        }
    })
    
    // Combine all eligible records
    const eligible_records = [
        ...opening_sanitized,
        ...bonus_sanitized,
        ...rights_sanitized,
        ...promoter_sanitized,
        ...ipo_allotment_sanitized,
        ...ipo_allotment_staging_sanitized
    ].sort((a, b) => {
        if (!a.date && !b.date) return 0
        if (!a.date) return -1
        if (!b.date) return 1
        return new Date(a.date).getTime() - new Date(b.date).getTime()
    })
    
    // Calculate totals for purchase records with decimal precision
    const purchaseTotals = purchased_grouped.reduce((acc, record) => {
        acc.totalQuantity += record.quantity;
        acc.totalTxnValue = FinancialCalculator.add(acc.totalTxnValue, record.txn_value);
        acc.totalCommissionAmount = FinancialCalculator.add(acc.totalCommissionAmount, record.commission_amount || 0);
        acc.totalSebonCommission = FinancialCalculator.add(acc.totalSebonCommission, record.sebon_commission || 0);
        acc.totalNetPayable = FinancialCalculator.add(acc.totalNetPayable, record.net_payable || 0);
        return acc;
    }, {
        totalQuantity: 0,
        totalTxnValue: 0,
        totalCommissionAmount: 0,
        totalSebonCommission: 0,
        totalNetPayable: 0
    });
    
    // Already using decimal precision in calculations above, just ensure final rounding
    purchaseTotals.totalTxnValue = FinancialCalculator.round(purchaseTotals.totalTxnValue);
    purchaseTotals.totalCommissionAmount = FinancialCalculator.round(purchaseTotals.totalCommissionAmount);
    purchaseTotals.totalSebonCommission = FinancialCalculator.round(purchaseTotals.totalSebonCommission);
    purchaseTotals.totalNetPayable = FinancialCalculator.round(purchaseTotals.totalNetPayable);

    // Calculate totals for sales records with decimal precision
    const salesTotals = sales_grouped.reduce((acc, record) => {
        acc.totalQuantity += record.quantity;
        acc.totalTxnValue = FinancialCalculator.add(acc.totalTxnValue, record.txn_value);
        acc.totalCommissionAmount = FinancialCalculator.add(acc.totalCommissionAmount, record.commission_amount || 0);
        acc.totalCapitalGainTax = FinancialCalculator.add(acc.totalCapitalGainTax, record.capital_gain_tax || 0);
        acc.totalSebonCommission = FinancialCalculator.add(acc.totalSebonCommission, record.sebon_commission || 0);
        acc.totalNetReceivable = FinancialCalculator.add(acc.totalNetReceivable, record.net_receivable || 0);
        acc.totalProfitLoss = FinancialCalculator.add(acc.totalProfitLoss, record.profit_loss || 0);
        return acc;
    }, {
        totalQuantity: 0,
        totalTxnValue: 0,
        totalCommissionAmount: 0,
        totalCapitalGainTax: 0,
        totalSebonCommission: 0,
        totalNetReceivable: 0,
        totalProfitLoss: 0
    });
    
    // Already using decimal precision in calculations above, just ensure final rounding
    salesTotals.totalTxnValue = FinancialCalculator.round(salesTotals.totalTxnValue);
    salesTotals.totalCommissionAmount = FinancialCalculator.round(salesTotals.totalCommissionAmount);
    salesTotals.totalCapitalGainTax = FinancialCalculator.round(salesTotals.totalCapitalGainTax);
    salesTotals.totalSebonCommission = FinancialCalculator.round(salesTotals.totalSebonCommission);
    salesTotals.totalNetReceivable = FinancialCalculator.round(salesTotals.totalNetReceivable);
    salesTotals.totalProfitLoss = FinancialCalculator.round(salesTotals.totalProfitLoss);

    // Calculate totals for eligible records (opening + bonus + rights + promoter) with decimal precision
    const eligibleTotals = eligible_records.reduce((acc, record) => {
        acc.totalEligibleQuantity += record.opening_quantity;
        acc.totalEligibleValue = FinancialCalculator.add(acc.totalEligibleValue, record.total_value);
        return acc;
    }, {
        totalEligibleQuantity: 0,
        totalEligibleValue: 0
    });
    
    // Round eligible totals to 2 decimal places
    eligibleTotals.totalEligibleValue = FinancialCalculator.round(eligibleTotals.totalEligibleValue);
    
    const result = {
        purchased_sanitized: purchased_grouped,
        sales_sanitized: sales_grouped,
        opening_sanitized: opening_sanitized, // Fixed typo
        eligible_sanitized: eligible_records, // New eligible records
        totals: {
            purchase: purchaseTotals,
            sales: salesTotals,
            opening: eligibleTotals, // Rename for clarity
            eligible: eligibleTotals // Add eligible totals
        }
    }

    return result
}

export async function getSymbolHoldingsEffectiveRate(symbol: string, currentFund: string) {
    try {
        // First, get the fund_id from the client name
        const clientMapping = await prisma.client_broker_mapping.findFirst({
            where: {
                client_name: currentFund
            },
            select: {
                fund_id: true
            }
        });

        if (!clientMapping) {
            return {
                success: false,
                message: `No fund mapping found for ${currentFund}`,
                effective_rate: 0,
                wacc_tax_base: 0
            };
        }

        // Get current fiscal year
        const currentDate = new Date();
        const currentFiscalYear = await prisma.fiscal_years.findFirst({
            where: {
                start_date: { lte: currentDate },
                end_date: { gte: currentDate }
            },
            select: {
                fiscal_year_id: true
            }
        });

        if (!currentFiscalYear) {
            return {
                success: false,
                message: 'No current fiscal year found',
                effective_rate: 0,
                wacc_tax_base: 0
            };
        }

        // Now get the symbol holdings using fund_id and fiscal_year_id
        const holdings = await prisma.symbol_holdings.findFirst({
            where: {
                symbol: symbol.toUpperCase(),
                fund_id: clientMapping.fund_id,
                fiscal_year_id: currentFiscalYear.fiscal_year_id
            },
            select: {
                wacc_tax_base: true,
                symbol: true
            }
        });

        if (!holdings) {
            // If no symbol_holdings record, try to get from fiscal_year_balance as fallback
            const fiscalBalance = await prisma.fiscal_year_balance.findFirst({
                where: {
                    symbol: symbol.toUpperCase(),
                    fiscal_year_id: currentFiscalYear.fiscal_year_id,
                    client_broker_mapping: {
                        client_name: currentFund
                    }
                },
                select: {
                    effective_rate: true,
                    symbol: true
                }
            });

            if (!fiscalBalance) {
            return {
                success: false,
                message: `No holdings found for symbol ${symbol} in fund ${currentFund}`,
                effective_rate: 0,
                wacc_tax_base: 0
            };
            }

            return {
                success: true,
                message: 'Effective rate found from fiscal year balance',
                effective_rate: parseFloat(Number(fiscalBalance.effective_rate).toFixed(2)),
                wacc_tax_base: 0, // No tax base WACC available from fiscal year balance
                symbol: fiscalBalance.symbol
            };
        }

        return {
            success: true,
            message: 'WACC found successfully',
            effective_rate: holdings.wacc_tax_base ? parseFloat(Number(holdings.wacc_tax_base).toFixed(2)) : 0,
            wacc_tax_base: holdings.wacc_tax_base ? parseFloat(Number(holdings.wacc_tax_base).toFixed(2)) : 0,
            symbol: holdings.symbol
        };

    } catch (error) {
        console.error('Error fetching symbol holdings effective rate:', error);
        return {
            success: false,
            message: 'Error fetching effective rate',
            effective_rate: 0,
            wacc_tax_base: 0
        };
    }
}

export async function filterData(symbol: string, fiscalID: string, currentFund: string) {
    const given_symbol = symbol as string
    const given_fiscal = Number(fiscalID)
    const given_fund = currentFund

    const purchase_record = await prisma.buy_records.findMany({
        where: {
            symbol: given_symbol,
            fiscal_year_id: given_fiscal,
            client_broker_mapping: {
                client_name: given_fund
            }
        }
    })

    const sales_record = await prisma.sell_records.findMany({
        where: {
            symbol: given_symbol,
            fiscal_year_id: given_fiscal,
            client_broker_mapping: {
                client_name: given_fund
            }
        }
    })

    const opening_balances = await prisma.fiscal_year_balance.findMany({
        where: {
            fiscal_year_id: given_fiscal,
            symbol: given_symbol,
            client_broker_mapping: {
                client_name: given_fund
            }
        },
        select: {
            opening_quantity: true,
            effective_rate: true,
            opening_rate: true,
            closing_quantity: true
        }
    })

    const purchased_sanitized = purchase_record.map((d) => ({
        ...d,
        price: parseFloat(Number(d.price).toFixed(2)),
        txn_value: parseFloat(Number(d.txn_value).toFixed(2)),
        commission_amount: parseFloat(Number(d.commission_amount).toFixed(2)),
        sebon_commission: parseFloat(Number(d.commission_amount).toFixed(2)),
        effective_rate: parseFloat(Number(d.effective_rate).toFixed(2)),
        net_payable: parseFloat(Number(d.net_payable).toFixed(2))
}))

    const sales_sanitized = sales_record.map((d) => ({
        ...d,
        price: parseFloat(Number(d.price).toFixed(2)),
        txn_value: parseFloat(Number(d.txn_value).toFixed(2)),
        commission_amount: parseFloat(Number(d.commission_amount).toFixed(2)),
        sebon_commission: parseFloat(Number(d.sebon_commission).toFixed(2)),
        capital_gain_tax: parseFloat(Number(d.capital_gain_tax).toFixed(2)),
        effective_rate: parseFloat(Number(d.effective_rate).toFixed(2)),
        profit_loss: parseFloat(Number(d.profit_loss).toFixed(2)),
        net_receivable: parseFloat(Number(d.net_receivable).toFixed(2)),
        approx_profit_loss: parseFloat(Number(d.approx_profit_loss).toFixed(2))
    }))


    const opening_sanitized = opening_balances.map((d) => ({
        ...d,
        opening_quantity: Number(d.opening_quantity),
        effective_rate: parseFloat(Number(d.effective_rate).toFixed(2)),
        total_value: parseFloat((Number(d.opening_quantity) * Number(d.effective_rate)).toFixed(2))
    }))
    const result = {
        purchased_sanitized,
        sales_sanitized,
        opening_sanitized
    }

    return result

}