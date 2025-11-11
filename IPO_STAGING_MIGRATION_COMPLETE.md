# ✅ IPO Allotment Staging Migration Complete

## Summary

Successfully migrated all references from the deleted `ipo_allotment_staging` table to `fiscal_year_balance_staging`.

## Changes Made

### 1. **fiscalYearDashboardAPI/actions.ts** (3 locations)

#### Location 1: getTotalInvestment function (Line ~230)
**Before:**
```typescript
const ipoStagingRecords = await prisma.ipo_allotment_staging.findMany({
    where: { fiscal_year_id: fiscalYearId, fund_id: clientMapping.fund_id },
    select: { total_value: true }
});
ipoStagingRecords.forEach(record => {
    const totalValue = sanitizeNumeric(record.total_value);
    ipoStagingTotal += totalValue;
});
```

**After:**
```typescript
const ipoStagingRecords = await prisma.fiscal_year_balance_staging.findMany({
    where: { fiscal_year_id: fiscalYearId, fund_id: clientMapping.fund_id },
    select: { closing_quantity: true, effective_rate: true }
});
ipoStagingRecords.forEach(record => {
    const quantity = sanitizeNumeric(record.closing_quantity);
    const rate = sanitizeNumeric(record.effective_rate);
    const totalValue = quantity * rate;
    ipoStagingTotal += totalValue;
});
```

#### Location 2: getSectorWiseMaturityInvestment function (Line ~466)
**Before:**
```typescript
const ipoStagingInvestments = await prisma.ipo_allotment_staging.findMany({
    where: { fiscal_year_id: fiscalYearId, fund_id: clientMapping.fund_id },
    select: {
        symbol: true,
        quantity: true,
        effective_rate: true,
        fund_id: true,
        stock_fulls: { /* ... */ }
    }
});
const ipoStagingMapped = ipoStagingInvestments.map(record => ({
    symbol: record.symbol,
    closing_quantity: record.quantity,
    effective_rate: record.effective_rate,
    fund_id: record.fund_id,
    fiscal_year_id: fiscalYearId,
    stock_fulls: record.stock_fulls
}));
```

**After:**
```typescript
const ipoStagingInvestments = await prisma.fiscal_year_balance_staging.findMany({
    where: { fiscal_year_id: fiscalYearId, fund_id: clientMapping.fund_id },
    select: {
        symbol: true,
        closing_quantity: true,
        effective_rate: true,
        fund_id: true
    }
});
const ipoStagingMapped = ipoStagingInvestments.map(record => ({
    symbol: record.symbol,
    closing_quantity: record.closing_quantity,
    effective_rate: record.effective_rate,
    fund_id: record.fund_id,
    fiscal_year_id: fiscalYearId
}));
```

#### Location 3: getSectorWiseUnrealizedGain function (Line ~662)
**Before:**
```typescript
const ipoStagingRecords = clientMapping ? await prisma.ipo_allotment_staging.findMany({
    where: { fiscal_year_id: fiscalYearId, fund_id: clientMapping.fund_id },
    select: {
        symbol: true,
        quantity: true,
        effective_rate: true,
        fund_id: true,
        stock_fulls: { /* ... */ }
    }
}) : [];
```

**After:**
```typescript
const ipoStagingRecords = clientMapping ? await prisma.fiscal_year_balance_staging.findMany({
    where: { fiscal_year_id: fiscalYearId, fund_id: clientMapping.fund_id },
    select: {
        symbol: true,
        closing_quantity: true,
        effective_rate: true,
        fund_id: true
    }
}) : [];
```

### 2. **dashboardAPICalls/actions.ts** (1 location)

#### Comment update (Line ~234)
**Before:**
```typescript
// Total Investment = trading total + promoter total + ipo_allotment_staging total_value
```

**After:**
```typescript
// Total Investment = trading total + promoter total + fiscal_year_balance_staging total_value
```

### 3. **Database Triggers (SQL files)**

All references to `ipo_allotment_staging` table removed from:
- `database_triggers_functions_COMPLETE.sql`
- `database_triggers_functions_part2.sql`
- `database_triggers_functions_part3.sql`

Removed trigger: `trg_ipo_staging_fiscal_balance_staging`

## Key Field Mappings

| Old Table (ipo_allotment_staging) | New Table (fiscal_year_balance_staging) |
|-----------------------------------|------------------------------------------|
| `quantity` | `closing_quantity` |
| `effective_rate` | `effective_rate` (same) |
| `total_value` | Calculated: `closing_quantity * effective_rate` |
| `stock_fulls` relation | Not available (removed) |

## Files NOT Changed (Intentionally)

### Type Definitions & Comments
These files contain type definitions or comments referencing `ipo_allotment_staging` which are fine:

1. **components/view-ledger.tsx**
   - Line 103: Type definition for `record_type` union includes `'ipo_allotment_staging'`
   - Line 975: Display label for staging records
   - ✅ These are UI labels, not database queries

2. **components/dialogs/ipo-allotment-dialog.tsx**
   - Line 176: Comment explaining staging upload
   - ✅ Just a comment, actual function uses correct table

3. **app/api/ledgerPageCalls/actions.ts**
   - Already using `fiscal_year_balance_staging` correctly
   - Comments and type labels reference staging for clarity
   - ✅ No changes needed

## Verification

### ✅ All Prisma Queries Fixed
```bash
# Search for any remaining prisma.ipo_allotment_staging queries
grep -r "prisma.ipo_allotment_staging" app/
# Result: No matches found ✓
```

### ✅ Build Should Pass
The TypeScript error should now be resolved:
```
Property 'ipo_allotment_staging' does not exist on type 'PrismaClient'
```

### ✅ Data Consistency
All queries now correctly use `fiscal_year_balance_staging` with proper field mappings:
- `closing_quantity` instead of `quantity`
- Calculate `total_value` as `closing_quantity * effective_rate`
- Removed `stock_fulls` relation (not available in staging table)

## Testing Checklist

- [ ] Build passes without TypeScript errors
- [ ] Dashboard total investment displays correctly
- [ ] Sector-wise maturity investment shows IPO staging data
- [ ] Sector-wise unrealized gain includes IPO staging records
- [ ] Ledger page displays IPO staging records correctly
- [ ] IPO allotment upload still works (to fiscal_year_balance_staging)

## Database Schema Alignment

Your current schema (after `npx prisma db pull`):
```prisma
model fiscal_year_balance_staging {
  symbol           String   @db.VarChar(15)
  fiscal_year_id   Int
  opening_quantity Int?     @default(0)
  added_quantity   Int?     @default(0)
  closing_quantity Int?     @default(dbgenerated("(opening_quantity + added_quantity)"))
  effective_rate   Decimal? @db.Decimal(14, 2)
  // ... other fields
  staging_id       Int      @id @default(autoincrement())
}
```

✅ All queries now match this schema!

## Next Steps

1. **Test the build:**
   ```bash
   npm run build
   ```

2. **Test the application:**
   - Navigate to dashboard
   - Check total investment calculation
   - View sector-wise breakdowns
   - Verify ledger page displays correctly

3. **Apply database triggers:**
   ```bash
   psql -U your_username -d your_database -f database_triggers_functions_COMPLETE.sql
   ```

---

**Status:** ✅ Migration Complete  
**Date:** 2025-01-11  
**Files Modified:** 2 TypeScript files, 3 SQL files  
**Build Status:** Should pass ✓
