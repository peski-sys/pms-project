# 🗄️ Database Triggers and Functions - Production Ready

## Overview

This SQL file contains a complete, production-ready set of database triggers and functions for your Portfolio Management System. All calculations follow accounting standards with proper `ROUND(value, 2)` precision.

## ✅ What's Included

### 1. **Utility Functions**
- `calculate_weighted_average()` - WACC calculation with 2 decimal precision
- `ensure_stock_exists()` - Auto-create stock entries

### 2. **Automated Balance Updates**
- **fiscal_year_balance** - Client-specific holdings (dematerialized)
- **fiscal_year_balance_staging** - Non-dematerialized holdings (IPO, Bonus, Rights before client assignment)
- **symbol_holdings** - Fund-level WACC calculations

### 3. **Record Type Support**
✅ buy_records → Increases quantity, updates WACC  
✅ sell_records → Decreases quantity, calculates P/L  
✅ bonus_records → Dilutes rate (free shares)  
✅ right_records → Increases quantity, updates WACC  
✅ promoter_records → Separate tracking with sub_id  
✅ ipo_allotment_records → IPO allotments (dematerialized)  
✅ closeout_records → Opening balance adjustments  

### 4. **Staging Table Support** (NEW!)
✅ bonus_records_staging → Dilutes rate in fiscal_year_balance_staging  
✅ right_records_staging → Updates WACC in fiscal_year_balance_staging  
⚠️ IPO allotment staging → Managed directly via fiscal_year_balance_staging (no separate table)  

### 5. **Profit/Loss Calculations**
- **profit_loss** - Using fiscal_year_balance.effective_rate (accounting P/L)
- **approx_profit_loss** - Using symbol_holdings.wacc_tax_base (tax P/L)
- Calculated automatically on INSERT/UPDATE of sell_records

### 6. **Fiscal Year Carryforward** (ENHANCED!)
- Carries forward both `fiscal_year_balance` AND `fiscal_year_balance_staging`
- Preserves source_type, sub_id, and remarks
- Creates opening balances for new fiscal year
- Usage: `SELECT carryforward_fiscal_year_balance(from_fy_id, to_fy_id);`

### 7. **Data Integrity**
- `check_data_integrity()` - Identifies data issues
- `cleanup_zero_quantity_records()` - Removes zero/negative holdings
- `confirm_staging_records()` - Moves staging to confirmed records

## 📋 Installation

### Option 1: Single File (Recommended)
```bash
psql -U your_username -d your_database -f database_triggers_functions_COMPLETE.sql
```

### Option 2: Part by Part
```bash
psql -U your_username -d your_database -f database_triggers_functions_part1.sql
psql -U your_username -d your_database -f database_triggers_functions_part2.sql
psql -U your_username -d your_database -f database_triggers_functions_part3.sql
```

### Option 3: Using Prisma
```bash
# Add to your migration
npx prisma migrate dev --create-only --name add_triggers_and_functions
# Then copy the SQL content into the generated migration file
npx prisma migrate deploy
```

## 🔄 How It Works

### Workflow 1: Trading Records (Buy/Sell)
```
1. Upload Excel → order_book
2. Trigger → buy_records_staging / sell_records_staging
3. User confirms → confirm_staging_records()
4. Triggers update:
   - fiscal_year_balance (client holdings)
   - symbol_holdings (fund WACC)
   - sell_records.profit_loss (auto-calculated)
```

### Workflow 2: IPO Allotment (Non-Dematerialized)
```
1. Add IPO → fiscal_year_balance_staging (directly via application)
2. Add Bonus/Rights → bonus_records_staging / right_records_staging
3. Trigger → Updates fiscal_year_balance_staging (dilutes rate, adds quantity)
4. User dematerializes → Moves to fiscal_year_balance with client_id
```

### Workflow 3: Fiscal Year End
```
1. Run: SELECT carryforward_fiscal_year_balance(2024, 2025);
2. Carries forward:
   - fiscal_year_balance (closing → opening)
   - fiscal_year_balance_staging (closing → opening)
3. New fiscal year starts with correct opening balances
```

## 🎯 Key Features

### 1. **Accounting Standards Compliance**
- All calculations use `ROUND(value, 2)`
- Weighted average cost (WACC) properly calculated
- Bonus shares dilute rate correctly: `(qty * rate) / new_qty`
- Right shares update WACC: `weighted_average(old, new)`

### 2. **Staging Table Support**
- `fiscal_year_balance_staging` tracks non-dematerialized holdings
- IPO allotments before client assignment
- Bonus/Rights applied to staging holdings
- Carryforward includes staging balances

### 3. **Profit/Loss Calculation**
```sql
-- Accounting P/L (using client's effective rate)
profit_loss = (sell_price - fiscal_year_balance.effective_rate) * quantity

-- Tax P/L (using fund's WACC)
approx_profit_loss = (sell_effective_rate - symbol_holdings.wacc_tax_base) * quantity
```

### 4. **Error Handling**
- All triggers have `EXCEPTION` blocks
- Warnings logged, transactions don't fail
- NULL-safe calculations
- Automatic cleanup of zero quantities

## 📊 Testing

### Test 1: Buy Record
```sql
INSERT INTO buy_records (
    fund_id, upload_id, client_id, symbol, quantity, price, txn_value,
    transaction_date, contract_number, fiscal_year_id
) VALUES (
    1, 1, 'CLIENT001', 'NABIL', 100, 1200.00, 120000.00,
    '2024-01-15', 'BUY001', 1
);

-- Check fiscal_year_balance
SELECT * FROM fiscal_year_balance 
WHERE client_id = 'CLIENT001' AND symbol = 'NABIL';
-- Expected: added_quantity = 100, effective_rate = 1200.00

-- Check symbol_holdings
SELECT * FROM symbol_holdings 
WHERE fund_id = 1 AND symbol = 'NABIL';
-- Expected: quantity = 100, wacc_tax_base = calculated from txn_value
```

### Test 2: Sell Record with P/L
```sql
INSERT INTO sell_records (
    fund_id, upload_id, client_id, symbol, quantity, price, txn_value,
    transaction_date, contract_number, fiscal_year_id
) VALUES (
    1, 1, 'CLIENT001', 'NABIL', 50, 1300.00, 65000.00,
    '2024-02-15', 'SELL001', 1
);

-- Check profit/loss
SELECT profit_loss, approx_profit_loss FROM sell_records 
WHERE contract_number = 'SELL001';
-- Expected: profit_loss = (1300 - 1200) * 50 = 5000.00
```

### Test 3: Bonus Shares (Dilution)
```sql
INSERT INTO bonus_records (
    fund_id, client_id, symbol, bonus_percent, quantity,
    bookclose_date, fiscal_year_id
) VALUES (
    1, 'CLIENT001', 'NABIL', 20.00, 20,
    '2024-03-15', 1
);

-- Check fiscal_year_balance
SELECT effective_rate FROM fiscal_year_balance 
WHERE client_id = 'CLIENT001' AND symbol = 'NABIL';
-- Expected: rate diluted from 1200 to (100*1200)/(100+20) = 1000.00
```

### Test 4: IPO Staging
```sql
INSERT INTO ipo_allotment_staging (
    fund_id, symbol, quantity, effective_rate, added_at,
    fiscal_year_id, sub_id
) VALUES (
    1, 'NEWIPO', 500, 150.00, '2024-04-15', 1, 2
);

-- Check fiscal_year_balance_staging
SELECT * FROM fiscal_year_balance_staging 
WHERE symbol = 'NEWIPO' AND fund_id = 1;
-- Expected: added_quantity = 500, effective_rate = 150.00
```

### Test 5: Carryforward
```sql
SELECT carryforward_fiscal_year_balance(1, 2);

-- Check new fiscal year
SELECT * FROM fiscal_year_balance WHERE fiscal_year_id = 2;
SELECT * FROM fiscal_year_balance_staging WHERE fiscal_year_id = 2;
-- Expected: All closing balances from FY 1 as opening balances in FY 2
```

## 🔍 Data Integrity Checks

```sql
-- Run integrity check
SELECT * FROM check_data_integrity();

-- Clean up zero quantities
SELECT cleanup_zero_quantity_records();
```

## ⚠️ Important Notes

### 1. **Trigger Order**
Triggers fire in this order:
1. BEFORE triggers (profit/loss calculation)
2. INSERT/UPDATE/DELETE operation
3. AFTER triggers (balance updates)

### 2. **Staging vs Confirmed**
- **Staging tables**: Unconfirmed, can be edited/deleted
- **Confirmed tables**: Locked, affects balances
- Use `confirm_staging_records(upload_id)` to confirm

### 3. **fiscal_year_balance vs fiscal_year_balance_staging**
- **fiscal_year_balance**: Client-specific, dematerialized holdings
- **fiscal_year_balance_staging**: Fund-level, non-dematerialized (IPO before client assignment)

### 4. **Rounding**
All monetary calculations use `ROUND(value, 2)` for accounting compliance.

### 5. **Performance**
- Triggers are optimized with minimal queries
- Indexes recommended on:
  - `fiscal_year_balance(client_id, symbol, fiscal_year_id)`
  - `symbol_holdings(symbol, fund_id, fiscal_year_id)`
  - `fiscal_year_balance_staging(symbol, fund_id, fiscal_year_id, sub_id)`

## 🚀 Migration from Old Triggers

If you have old triggers, they will be automatically dropped when you run this file. The DROP statements are at the top of Part 1.

### Backup First!
```bash
pg_dump -U your_username -d your_database -t fiscal_year_balance -t symbol_holdings > backup_before_triggers.sql
```

## 📝 Maintenance

### Add New Record Type
1. Add trigger in Section 12
2. Add logic in `fn_update_fiscal_year_balance()`
3. Test thoroughly

### Modify Calculation
1. Update `calculate_weighted_average()` or trigger function
2. Test with sample data
3. Consider data migration if formula changes

## 🆘 Troubleshooting

### Issue: Triggers not firing
```sql
-- Check if triggers exist
SELECT tgname, tgrelid::regclass, tgenabled 
FROM pg_trigger 
WHERE tgname LIKE 'trg_%';
```

### Issue: Incorrect calculations
```sql
-- Check function definitions
\df+ calculate_weighted_average
\df+ fn_update_fiscal_year_balance

-- Enable detailed logging
SET client_min_messages TO NOTICE;
```

### Issue: Performance slow
```sql
-- Check for missing indexes
SELECT schemaname, tablename, indexname 
FROM pg_indexes 
WHERE tablename IN ('fiscal_year_balance', 'symbol_holdings', 'fiscal_year_balance_staging');

-- Add indexes if missing
CREATE INDEX IF NOT EXISTS idx_fyb_lookup ON fiscal_year_balance(client_id, symbol, fiscal_year_id);
CREATE INDEX IF NOT EXISTS idx_sh_lookup ON symbol_holdings(symbol, fund_id, fiscal_year_id);
CREATE INDEX IF NOT EXISTS idx_fys_lookup ON fiscal_year_balance_staging(symbol, fund_id, fiscal_year_id, sub_id);
```

## ✅ Production Checklist

- [ ] Backup database before applying
- [ ] Test on staging environment first
- [ ] Run integrity checks after installation
- [ ] Verify sample transactions calculate correctly
- [ ] Monitor trigger performance
- [ ] Document any custom modifications
- [ ] Set up monitoring for trigger errors

## 📞 Support

For issues or questions:
1. Check trigger logs: `SELECT * FROM pg_stat_user_functions;`
2. Review PostgreSQL logs for warnings
3. Run `check_data_integrity()` to identify issues
4. Test with minimal data first

---

**Version:** 1.0.0  
**Last Updated:** 2025-01-11  
**Compatibility:** PostgreSQL 12+, Prisma Schema v5+
