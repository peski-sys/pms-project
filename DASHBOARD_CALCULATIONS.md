# Dashboard Calculations Documentation

## Overview
This document explains all the formulas and calculations used in the dashboard's portfolio analysis features, specifically for **Portfolio Summary by Sector** and **Sector Breakdown** calculations.

---

## Portfolio Summary by Sector (`getSectorPortfolioSummary`)

### Data Sources
1. **Trading Holdings**: From `fiscal_year_balance` table where `source_type = "TRADING"`
2. **Maturity Holdings**: From `promoter_records` table
3. **Realized Gains**: From `sell_records` table
4. **Market Prices (LTP)**: From `market_snapshots` table (cached)

### Key Formulas

#### 1. Trading Holdings - Market Value
```
Market Value = Quantity × Current LTP
```
- **Quantity**: `closing_quantity` from `fiscal_year_balance`
- **Current LTP**: Latest market price from `market_snapshots` (cached)

#### 2. Trading Holdings - Book Value
```
Book Value = Quantity × Effective Rate
```
- **Effective Rate**: Weighted average cost price from `fiscal_year_balance`

#### 3. Unrealized Gain/Loss (Trading)
```
Unrealized Gain = Market Value - Book Value
```
- **Positive value**: Unrealized gain (stock appreciated)
- **Negative value**: Unrealized loss (stock depreciated)

#### 4. Maturity Holdings - Market Value
```
Market Value = Quantity × Current LTP
```
- **Quantity**: From `promoter_records`
- **Current LTP**: Latest market price from `market_snapshots` (cached)

#### 5. Realized Gain/Loss
```
Realized Gain = profit_loss from sell_records
```
- **Positive value**: Realized gain (profit on sale)
- **Negative value**: Realized loss (loss on sale)

#### 6. Sector Aggregation
For each sector:
- **Held For Trading**: Sum of all trading holdings' market values
- **Held For Maturity**: Sum of all maturity holdings' market values
- **Realized Gain**: Sum of all realized gains from sales
- **Unrealized Gain**: Sum of all unrealized gains from trading holdings

#### 7. Total Portfolio Value
```
Total Portfolio Value = Total Held For Trading + Total Held For Maturity
```

#### 8. Sector Weightage (Percentage)
```
Sector Weightage % = (Sector Total Value / Total Portfolio Value) × 100
```
Where:
- **Sector Total Value** = Sector Held For Trading + Sector Held For Maturity

#### 9. Sector Gain Percentage
```
Sector Gain % = (Total Sector Gain / Sector Total Value) × 100
```
Where:
- **Total Sector Gain** = Sector Realized Gain + Sector Unrealized Gain
- **Sector Total Value** = Sector Held For Trading + Sector Held For Maturity

### Special Handling for Promoter Sectors (sector_id = 14)
When `sector_id = 14`:
- Use `promoter_sector_id` to fetch the actual sector name from the `sectors` table
- This allows promoter holdings to be categorized under their specific promoter sector instead of the generic "Promoter" sector

---

## Sector Breakdown (`getInvestmentBreakdown`)

### Data Sources
1. **Trading Investments**: From `fiscal_year_balance` where `source_type = "TRADING"`
2. **Maturity Investments**: From `fiscal_year_balance` where `source_type = "PROMOTER"` + IPO staging records
3. **All Sectors**: From `sectors` table (for comprehensive listing)

### Key Formulas

#### 1. Investment Cost Value (Trading)
```
Cost Value = Quantity × Effective Rate
```
- **Quantity**: `closing_quantity` from `fiscal_year_balance`
- **Effective Rate**: Weighted average cost price

#### 2. Investment Cost Value (Maturity)
```
Cost Value = Quantity × Effective Rate
```
- **Quantity**: `closing_quantity` from `fiscal_year_balance` (PROMOTER) or `quantity` from IPO staging

#### 3. Sector Aggregation (Trading)
For each sector:
- **Total Cost Value**: Sum of all trading investments' cost values
- **Count**: Number of unique stocks in that sector

#### 4. Sector Aggregation (Maturity)
For each sector:
- **Total Cost Value**: Sum of all maturity investments' cost values
- **Count**: Number of unique stocks in that sector

#### 5. Sector Percentage (Trading)
```
Sector Percentage = (Sector Total Cost Value / Total Trading Cost Value) × 100
```

#### 6. Sector Percentage (Maturity)
```
Sector Percentage = (Sector Total Cost Value / Total Maturity Cost Value) × 100
```

### Special Handling for Promoter Sectors (sector_id = 14)
When `sector_id = 14`:
- Use `promoter_sector_id` to fetch the actual sector name from the `sectors` table
- This ensures promoter investments are categorized correctly

---

## Important Notes

### 1. Weighted Average Cost Price
When combining holdings across multiple funds:
```
Weighted Average Rate = Total Cost Value / Total Quantity
```
Where:
- **Total Cost Value** = Sum of (Quantity × Effective Rate) for all holdings
- **Total Quantity** = Sum of all quantities

### 2. Decimal Precision
All calculations use `FinancialCalculator` (Decimal.js) for precise financial arithmetic:
- Multiplication: `FinancialCalculator.multiply(a, b)`
- Addition: `FinancialCalculator.add(a, b)`
- Division: `FinancialCalculator.divide(a, b)`
- All results rounded to 2 decimal places

### 3. Data Consistency
- **Market Value**: Uses current LTP (Last Traded Price) from market snapshots
- **Book Value**: Uses effective rate (cost basis) from holdings
- **Cost Basis**: Used in Sector Breakdown (IFRS compliance)
- **Market Value**: Used in Portfolio Summary (current portfolio valuation)

### 4. LTP Caching
- LTP values are fetched in batch to avoid N+1 queries
- Uses `market_snapshots` table for caching
- Falls back to real-time API if cache is unavailable

---

## Summary of Key Differences

| Metric | Portfolio Summary | Sector Breakdown |
|--------|------------------|------------------|
| **Trading Value** | Market Value (Quantity × LTP) | Cost Value (Quantity × Effective Rate) |
| **Maturity Value** | Market Value (Quantity × LTP) | Cost Value (Quantity × Effective Rate) |
| **Purpose** | Current portfolio valuation | IFRS-compliant cost basis reporting |
| **Gains/Losses** | Includes unrealized gains | Cost basis only |

---

## Formula Summary

### Portfolio Summary by Sector:
1. **Market Value** = Quantity × LTP
2. **Book Value** = Quantity × Effective Rate
3. **Unrealized Gain** = Market Value - Book Value
4. **Weightage %** = (Sector Total / Portfolio Total) × 100
5. **Gain %** = (Total Gain / Sector Total) × 100

### Sector Breakdown:
1. **Cost Value** = Quantity × Effective Rate
2. **Sector %** = (Sector Cost / Total Cost) × 100

---

*Last Updated: Based on current implementation in `app/api/dashboardAPICalls/actions.ts`*





