-- ============================================================================
-- PRODUCTION-READY DATABASE TRIGGERS AND FUNCTIONS
-- Portfolio Management System
-- 
-- This file contains all triggers and functions needed for:
-- - Automated fiscal_year_balance updates
-- - Automated fiscal_year_balance_staging updates  
-- - Automated symbol_holdings updates
-- - Profit/loss calculations
-- - Weighted average cost calculations
-- - Fiscal year carryforward with staging support
-- - Data integrity checks
--
-- All calculations use ROUND(value, 2) for accounting standards compliance
-- ============================================================================

-- ============================================================================
-- SECTION 1: DROP EXISTING TRIGGERS AND FUNCTIONS
-- ============================================================================

-- Drop all existing triggers
DROP TRIGGER IF EXISTS trg_buy_records_fiscal_balance ON buy_records CASCADE;
DROP TRIGGER IF EXISTS trg_sell_records_fiscal_balance ON sell_records CASCADE;
DROP TRIGGER IF EXISTS trg_bonus_records_fiscal_balance ON bonus_records CASCADE;
DROP TRIGGER IF EXISTS trg_right_records_fiscal_balance ON right_records CASCADE;
DROP TRIGGER IF EXISTS trg_promoter_records_fiscal_balance ON promoter_records CASCADE;
DROP TRIGGER IF EXISTS trg_ipo_allotment_records_fiscal_balance ON ipo_allotment_records CASCADE;
DROP TRIGGER IF EXISTS trg_closeout_records_fiscal_balance ON closeout_records CASCADE;

DROP TRIGGER IF EXISTS trg_buy_records_symbol_holdings ON buy_records CASCADE;
DROP TRIGGER IF EXISTS trg_sell_records_symbol_holdings ON sell_records CASCADE;
DROP TRIGGER IF EXISTS trg_bonus_records_symbol_holdings ON bonus_records CASCADE;
DROP TRIGGER IF EXISTS trg_right_records_symbol_holdings ON right_records CASCADE;
DROP TRIGGER IF EXISTS trg_promoter_records_symbol_holdings ON promoter_records CASCADE;
DROP TRIGGER IF EXISTS trg_ipo_allotment_records_symbol_holdings ON ipo_allotment_records CASCADE;
DROP TRIGGER IF EXISTS trg_closeout_records_symbol_holdings ON closeout_records CASCADE;

DROP TRIGGER IF EXISTS trg_sell_records_profit_loss ON sell_records CASCADE;
DROP TRIGGER IF EXISTS trg_sell_records_staging_profit_loss ON sell_records_staging CASCADE;

DROP TRIGGER IF EXISTS trg_order_book_to_staging ON order_book CASCADE;

DROP TRIGGER IF EXISTS trg_bonus_staging_fiscal_balance_staging ON bonus_records_staging CASCADE;
DROP TRIGGER IF EXISTS trg_right_staging_fiscal_balance_staging ON right_records_staging CASCADE;
-- ipo_allotment_staging table does not exist in current schema

-- Drop all existing functions
DROP FUNCTION IF EXISTS calculate_weighted_average(NUMERIC, NUMERIC, NUMERIC, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS ensure_stock_exists(VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS carryforward_fiscal_year_balance(INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS confirm_staging_records(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS check_data_integrity() CASCADE;
DROP FUNCTION IF EXISTS cleanup_zero_quantity_records() CASCADE;

DROP FUNCTION IF EXISTS fn_update_fiscal_year_balance() CASCADE;
DROP FUNCTION IF EXISTS fn_update_fiscal_year_balance_staging() CASCADE;
DROP FUNCTION IF EXISTS fn_update_symbol_holdings() CASCADE;
DROP FUNCTION IF EXISTS fn_calculate_sell_profit_loss() CASCADE;
DROP FUNCTION IF EXISTS fn_insert_order_book_to_staging() CASCADE;

-- ============================================================================
-- SECTION 2: UTILITY FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Function: calculate_weighted_average
-- Purpose: Calculate weighted average cost with proper rounding
-- Returns: NUMERIC(14,2) - Rounded to 2 decimal places
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_weighted_average(
    current_quantity NUMERIC,
    current_rate NUMERIC,
    new_quantity NUMERIC,
    new_rate NUMERIC
) RETURNS NUMERIC(14,2) AS $$
DECLARE
    total_quantity NUMERIC;
    total_value NUMERIC;
BEGIN
    -- Handle NULL values
    current_quantity := COALESCE(current_quantity, 0);
    new_quantity := COALESCE(new_quantity, 0);
    current_rate := COALESCE(current_rate, 0);
    new_rate := COALESCE(new_rate, 0);
    
    total_quantity := current_quantity + new_quantity;
    
    -- Return 0 if total quantity is zero or negative
    IF total_quantity <= 0 THEN
        RETURN 0;
    END IF;
    
    -- Calculate weighted average: (Q1*R1 + Q2*R2) / (Q1 + Q2)
    total_value := (current_quantity * current_rate) + (new_quantity * new_rate);
    
    -- Round to 2 decimal places for accounting standards
    RETURN ROUND(total_value / total_quantity, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ----------------------------------------------------------------------------
-- Function: ensure_stock_exists
-- Purpose: Auto-create stock_fulls entry if it doesn't exist
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ensure_stock_exists(p_symbol VARCHAR)
RETURNS VOID AS $$
BEGIN
    INSERT INTO stock_fulls (symbol, full_form, sector_id, is_auto_generated)
    VALUES (UPPER(p_symbol), UPPER(p_symbol), 1, true)
    ON CONFLICT (symbol) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 3: FISCAL_YEAR_BALANCE UPDATE TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_update_fiscal_year_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_client_id VARCHAR(25);
    v_symbol VARCHAR(15);
    v_fiscal_year_id INTEGER;
    v_fund_id INTEGER;
    v_quantity INTEGER := 0;
    v_rate NUMERIC(14,2) := 0;
    v_source_type VARCHAR(50) := 'TRADING';
    v_sub_id INTEGER := 1;
    
    v_current_quantity INTEGER;
    v_current_rate NUMERIC(14,2);
    v_new_quantity INTEGER;
    v_new_rate NUMERIC(14,2);
BEGIN
    -- Determine operation type and extract values
    IF TG_OP = 'DELETE' THEN
        v_client_id := OLD.client_id;
        v_symbol := OLD.symbol;
        v_fiscal_year_id := OLD.fiscal_year_id;
        v_fund_id := OLD.fund_id;
    ELSE
        v_client_id := NEW.client_id;
        v_symbol := NEW.symbol;
        v_fiscal_year_id := NEW.fiscal_year_id;
        v_fund_id := NEW.fund_id;
    END IF;

    -- Skip if fiscal_year_id is NULL
    IF v_fiscal_year_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Ensure stock exists
    PERFORM ensure_stock_exists(v_symbol);

    -- Get current fiscal_year_balance values
    SELECT 
        COALESCE(added_quantity, 0),
        COALESCE(effective_rate, 0)
    INTO v_current_quantity, v_current_rate
    FROM fiscal_year_balance
    WHERE client_id = v_client_id 
      AND symbol = v_symbol 
      AND fiscal_year_id = v_fiscal_year_id;
    
    -- If no record found, initialize to zero
    IF NOT FOUND THEN
        v_current_quantity := 0;
        v_current_rate := 0;
    END IF;

    -- Calculate quantity and rate changes based on table and operation
    IF TG_TABLE_NAME = 'buy_records' THEN
        IF TG_OP = 'INSERT' THEN
            v_quantity := NEW.quantity;
            v_rate := COALESCE(NEW.price, 0);
            v_new_quantity := v_current_quantity + v_quantity;
            v_new_rate := calculate_weighted_average(v_current_quantity, v_current_rate, v_quantity, v_rate);
        ELSIF TG_OP = 'UPDATE' THEN
            v_new_quantity := v_current_quantity - OLD.quantity + NEW.quantity;
            v_new_rate := calculate_weighted_average(
                v_current_quantity - OLD.quantity,
                v_current_rate,
                NEW.quantity,
                COALESCE(NEW.price, 0)
            );
        ELSIF TG_OP = 'DELETE' THEN
            v_new_quantity := v_current_quantity - OLD.quantity;
            v_new_rate := v_current_rate; -- Rate doesn't change on delete
        END IF;

    ELSIF TG_TABLE_NAME = 'sell_records' THEN
        IF TG_OP = 'INSERT' THEN
            v_new_quantity := v_current_quantity - NEW.quantity;
            v_new_rate := v_current_rate; -- Sells don't affect rate
        ELSIF TG_OP = 'UPDATE' THEN
            v_new_quantity := v_current_quantity + OLD.quantity - NEW.quantity;
            v_new_rate := v_current_rate;
        ELSIF TG_OP = 'DELETE' THEN
            v_new_quantity := v_current_quantity + OLD.quantity;
            v_new_rate := v_current_rate;
        END IF;

    ELSIF TG_TABLE_NAME = 'bonus_records' THEN
        IF TG_OP = 'INSERT' THEN
            v_quantity := NEW.quantity;
            v_new_quantity := v_current_quantity + v_quantity;
            -- Bonus dilutes the rate: new_rate = (current_qty * current_rate) / new_qty
            v_new_rate := CASE 
                WHEN v_new_quantity > 0 THEN ROUND((v_current_quantity * v_current_rate) / v_new_quantity, 2)
                ELSE 0
            END;
        ELSIF TG_OP = 'UPDATE' THEN
            v_new_quantity := v_current_quantity - OLD.quantity + NEW.quantity;
            v_new_rate := CASE 
                WHEN v_new_quantity > 0 THEN ROUND((v_current_quantity * v_current_rate) / v_new_quantity, 2)
                ELSE 0
            END;
        ELSIF TG_OP = 'DELETE' THEN
            v_new_quantity := v_current_quantity - OLD.quantity;
            -- Reverse dilution
            v_new_rate := CASE 
                WHEN v_new_quantity > 0 THEN ROUND((v_current_quantity * v_current_rate) / v_new_quantity, 2)
                ELSE 0
            END;
        END IF;

    ELSIF TG_TABLE_NAME = 'right_records' THEN
        IF TG_OP = 'INSERT' THEN
            v_quantity := NEW.quantity;
            v_rate := COALESCE(NEW.effective_rate, 0);
            v_new_quantity := v_current_quantity + v_quantity;
            v_new_rate := calculate_weighted_average(v_current_quantity, v_current_rate, v_quantity, v_rate);
        ELSIF TG_OP = 'UPDATE' THEN
            v_new_quantity := v_current_quantity - OLD.quantity + NEW.quantity;
            v_new_rate := calculate_weighted_average(
                v_current_quantity - OLD.quantity,
                v_current_rate,
                NEW.quantity,
                COALESCE(NEW.effective_rate, 0)
            );
        ELSIF TG_OP = 'DELETE' THEN
            v_new_quantity := v_current_quantity - OLD.quantity;
            v_new_rate := v_current_rate;
        END IF;

    ELSIF TG_TABLE_NAME = 'promoter_records' THEN
        v_source_type := 'PROMOTER';
        v_sub_id := COALESCE(NEW.sub_id, OLD.sub_id, 1);
        
        IF TG_OP = 'INSERT' THEN
            v_quantity := NEW.quantity;
            v_rate := COALESCE(NEW.effective_rate, 0);
            v_new_quantity := v_current_quantity + v_quantity;
            v_new_rate := calculate_weighted_average(v_current_quantity, v_current_rate, v_quantity, v_rate);
        ELSIF TG_OP = 'UPDATE' THEN
            v_new_quantity := v_current_quantity - OLD.quantity + NEW.quantity;
            v_new_rate := calculate_weighted_average(
                v_current_quantity - OLD.quantity,
                v_current_rate,
                NEW.quantity,
                COALESCE(NEW.effective_rate, 0)
            );
        ELSIF TG_OP = 'DELETE' THEN
            v_new_quantity := v_current_quantity - OLD.quantity;
            v_new_rate := v_current_rate;
        END IF;

    ELSIF TG_TABLE_NAME = 'ipo_allotment_records' THEN
        v_sub_id := COALESCE(NEW.sub_id, OLD.sub_id, 1);
        
        IF TG_OP = 'INSERT' THEN
            v_quantity := NEW.quantity;
            v_rate := COALESCE(NEW.effective_rate, 0);
            v_new_quantity := v_current_quantity + v_quantity;
            v_new_rate := calculate_weighted_average(v_current_quantity, v_current_rate, v_quantity, v_rate);
        ELSIF TG_OP = 'UPDATE' THEN
            v_new_quantity := v_current_quantity - OLD.quantity + NEW.quantity;
            v_new_rate := calculate_weighted_average(
                v_current_quantity - OLD.quantity,
                v_current_rate,
                NEW.quantity,
                COALESCE(NEW.effective_rate, 0)
            );
        ELSIF TG_OP = 'DELETE' THEN
            v_new_quantity := v_current_quantity - OLD.quantity;
            v_new_rate := v_current_rate;
        END IF;

    ELSIF TG_TABLE_NAME = 'closeout_records' THEN
        IF TG_OP = 'INSERT' THEN
            v_quantity := NEW.closeout_quantity;
            v_rate := CASE 
                WHEN NEW.closeout_quantity > 0 THEN ROUND(NEW.closeout_amount / NEW.closeout_quantity, 2)
                ELSE 0
            END;
            v_new_quantity := v_current_quantity + v_quantity;
            v_new_rate := calculate_weighted_average(v_current_quantity, v_current_rate, v_quantity, v_rate);
        ELSIF TG_OP = 'UPDATE' THEN
            v_new_quantity := v_current_quantity - OLD.closeout_quantity + NEW.closeout_quantity;
            v_new_rate := calculate_weighted_average(
                v_current_quantity - OLD.closeout_quantity,
                v_current_rate,
                NEW.closeout_quantity,
                CASE 
                    WHEN NEW.closeout_quantity > 0 THEN ROUND(NEW.closeout_amount / NEW.closeout_quantity, 2)
                    ELSE 0
                END
            );
        ELSIF TG_OP = 'DELETE' THEN
            v_new_quantity := v_current_quantity - OLD.closeout_quantity;
            v_new_rate := v_current_rate;
        END IF;

    ELSE
        -- Unknown table, return without changes
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Insert or update fiscal_year_balance
    INSERT INTO fiscal_year_balance (
        client_id, symbol, fiscal_year_id, fund_id,
        opening_quantity, added_quantity, effective_rate,
        opening_rate, source_type, sub_id
    ) VALUES (
        v_client_id, v_symbol, v_fiscal_year_id, v_fund_id,
        0, v_new_quantity, v_new_rate,
        0, v_source_type, v_sub_id
    )
    ON CONFLICT (client_id, symbol, fiscal_year_id) DO UPDATE SET
        added_quantity = v_new_quantity,
        effective_rate = CASE 
            WHEN v_new_quantity > 0 THEN v_new_rate
            ELSE fiscal_year_balance.effective_rate
        END,
        source_type = COALESCE(v_source_type, fiscal_year_balance.source_type),
        sub_id = COALESCE(v_sub_id, fiscal_year_balance.sub_id);

    -- Delete if quantity becomes zero or negative
    DELETE FROM fiscal_year_balance
    WHERE client_id = v_client_id
      AND symbol = v_symbol
      AND fiscal_year_id = v_fiscal_year_id
      AND (COALESCE(opening_quantity, 0) + COALESCE(added_quantity, 0)) <= 0;

    RETURN COALESCE(NEW, OLD);
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in fn_update_fiscal_year_balance for table %: %', TG_TABLE_NAME, SQLERRM;
        RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
-- ============================================================================
-- PART 2: STAGING TRIGGERS, SYMBOL_HOLDINGS, AND PROFIT/LOSS CALCULATIONS
-- ============================================================================

-- ============================================================================
-- SECTION 4: FISCAL_YEAR_BALANCE_STAGING UPDATE TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_update_fiscal_year_balance_staging()
RETURNS TRIGGER AS $$
DECLARE
    v_symbol VARCHAR(15);
    v_fiscal_year_id INTEGER;
    v_fund_id INTEGER;
    v_sub_id INTEGER;
    v_quantity INTEGER := 0;
    v_rate NUMERIC(14,2) := 0;
    
    v_current_quantity INTEGER;
    v_current_rate NUMERIC(14,2);
    v_new_quantity INTEGER;
    v_new_rate NUMERIC(14,2);
BEGIN
    -- Determine operation type and extract values
    IF TG_OP = 'DELETE' THEN
        v_symbol := OLD.symbol;
        v_fiscal_year_id := OLD.fiscal_year_id;
        v_fund_id := OLD.fund_id;
        v_sub_id := OLD.sub_id;
    ELSE
        v_symbol := NEW.symbol;
        v_fiscal_year_id := NEW.fiscal_year_id;
        v_fund_id := NEW.fund_id;
        v_sub_id := NEW.sub_id;
    END IF;

    -- Skip if fiscal_year_id is NULL
    IF v_fiscal_year_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Ensure stock exists
    PERFORM ensure_stock_exists(v_symbol);

    -- Get current fiscal_year_balance_staging values
    SELECT 
        COALESCE(added_quantity, 0),
        COALESCE(effective_rate, 0)
    INTO v_current_quantity, v_current_rate
    FROM fiscal_year_balance_staging
    WHERE symbol = v_symbol 
      AND fiscal_year_id = v_fiscal_year_id
      AND fund_id = v_fund_id
      AND sub_id = v_sub_id;
    
    -- If no record found, initialize to zero
    IF NOT FOUND THEN
        v_current_quantity := 0;
        v_current_rate := 0;
    END IF;

    -- Calculate quantity and rate changes based on table and operation
    IF TG_TABLE_NAME = 'bonus_records_staging' THEN
        IF TG_OP = 'INSERT' THEN
            v_quantity := NEW.quantity;
            v_new_quantity := v_current_quantity + v_quantity;
            -- Bonus dilutes the rate
            v_new_rate := CASE 
                WHEN v_new_quantity > 0 THEN ROUND((v_current_quantity * v_current_rate) / v_new_quantity, 2)
                ELSE 0
            END;
        ELSIF TG_OP = 'UPDATE' THEN
            v_new_quantity := v_current_quantity - OLD.quantity + NEW.quantity;
            v_new_rate := CASE 
                WHEN v_new_quantity > 0 THEN ROUND((v_current_quantity * v_current_rate) / v_new_quantity, 2)
                ELSE 0
            END;
        ELSIF TG_OP = 'DELETE' THEN
            v_new_quantity := v_current_quantity - OLD.quantity;
            v_new_rate := CASE 
                WHEN v_new_quantity > 0 THEN ROUND((v_current_quantity * v_current_rate) / v_new_quantity, 2)
                ELSE 0
            END;
        END IF;

    ELSIF TG_TABLE_NAME = 'right_records_staging' THEN
        IF TG_OP = 'INSERT' THEN
            v_quantity := NEW.quantity;
            v_rate := COALESCE(NEW.effective_rate, 0);
            v_new_quantity := v_current_quantity + v_quantity;
            v_new_rate := calculate_weighted_average(v_current_quantity, v_current_rate, v_quantity, v_rate);
        ELSIF TG_OP = 'UPDATE' THEN
            v_new_quantity := v_current_quantity - OLD.quantity + NEW.quantity;
            v_new_rate := calculate_weighted_average(
                v_current_quantity - OLD.quantity,
                v_current_rate,
                NEW.quantity,
                COALESCE(NEW.effective_rate, 0)
            );
        ELSIF TG_OP = 'DELETE' THEN
            v_new_quantity := v_current_quantity - OLD.quantity;
            v_new_rate := v_current_rate;
        END IF;

    ELSE
        -- Unknown table, return without changes
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Check if record exists and update, or insert new
    UPDATE fiscal_year_balance_staging
    SET 
        added_quantity = v_new_quantity,
        effective_rate = CASE 
            WHEN v_new_quantity > 0 THEN v_new_rate
            ELSE effective_rate
        END
    WHERE symbol = v_symbol
      AND fiscal_year_id = v_fiscal_year_id
      AND fund_id = v_fund_id
      AND sub_id = v_sub_id;

    -- If no record was updated, insert new one
    IF NOT FOUND THEN
        INSERT INTO fiscal_year_balance_staging (
            symbol, fiscal_year_id, fund_id, sub_id,
            opening_quantity, added_quantity, effective_rate,
            opening_rate, source_type
        ) VALUES (
            v_symbol, v_fiscal_year_id, v_fund_id, v_sub_id,
            0, v_new_quantity, v_new_rate,
            0, 'TRADING'
        );
    END IF;

    -- Delete if quantity becomes zero or negative
    DELETE FROM fiscal_year_balance_staging
    WHERE symbol = v_symbol
      AND fiscal_year_id = v_fiscal_year_id
      AND fund_id = v_fund_id
      AND sub_id = v_sub_id
      AND (COALESCE(opening_quantity, 0) + COALESCE(added_quantity, 0)) <= 0;

    RETURN COALESCE(NEW, OLD);
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in fn_update_fiscal_year_balance_staging for table %: %', TG_TABLE_NAME, SQLERRM;
        RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 5: SYMBOL_HOLDINGS UPDATE TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_update_symbol_holdings()
RETURNS TRIGGER AS $$
DECLARE
    v_symbol VARCHAR(15);
    v_fiscal_year_id INTEGER;
    v_fund_id INTEGER;
    v_quantity INTEGER := 0;
    v_txn_value NUMERIC(16,2) := 0;
    v_commission NUMERIC(16,2) := 0;
    v_source_type VARCHAR(50) := 'TRADING';
    v_sub_id INTEGER := 1;
    v_old_quantity INTEGER := 0;
    v_old_txn_value NUMERIC(16,2) := 0;
    v_old_commission NUMERIC(16,2) := 0;
BEGIN
    -- Extract common values based on operation
    IF TG_OP = 'DELETE' THEN
        v_symbol := OLD.symbol;
        v_fiscal_year_id := OLD.fiscal_year_id;
        v_fund_id := OLD.fund_id;
    ELSE
        v_symbol := NEW.symbol;
        v_fiscal_year_id := NEW.fiscal_year_id;
        v_fund_id := NEW.fund_id;
    END IF;

    -- Skip if fiscal_year_id is NULL
    IF v_fiscal_year_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Ensure stock exists
    PERFORM ensure_stock_exists(v_symbol);

    -- ========================================================================
    -- Calculate quantity and value changes based on table and operation
    -- ========================================================================
    
    IF TG_TABLE_NAME = 'buy_records' THEN
        -- BUY: Increase quantity, add transaction value, add commission (cost basis)
        IF TG_OP = 'INSERT' THEN
            v_quantity := NEW.quantity;
            v_txn_value := COALESCE(NEW.txn_value, 0);
            v_commission := COALESCE(NEW.net_payable, 0);
        ELSIF TG_OP = 'UPDATE' THEN
            v_quantity := NEW.quantity - OLD.quantity;
            v_txn_value := COALESCE(NEW.txn_value, 0) - COALESCE(OLD.txn_value, 0);
            v_commission := COALESCE(NEW.net_payable, 0) - COALESCE(OLD.net_payable, 0);
        ELSIF TG_OP = 'DELETE' THEN
            v_quantity := -OLD.quantity;
            v_txn_value := -COALESCE(OLD.txn_value, 0);
            v_commission := -COALESCE(OLD.net_payable, 0);
        END IF;

    ELSIF TG_TABLE_NAME = 'sell_records' THEN
        -- SELL: Decrease quantity, subtract transaction value (negative), NO commission change
        -- Sells don't affect cost basis (total_with_commission)
        IF TG_OP = 'INSERT' THEN
            v_quantity := -NEW.quantity;  -- Negative because selling
            v_txn_value := -COALESCE(NEW.txn_value, 0);  -- Negative (money out)
            v_commission := 0;  -- Sells don't affect cost basis
        ELSIF TG_OP = 'UPDATE' THEN
            v_quantity := -(NEW.quantity - OLD.quantity);  -- Net change (negative)
            v_txn_value := -(COALESCE(NEW.txn_value, 0) - COALESCE(OLD.txn_value, 0));
            v_commission := 0;
        ELSIF TG_OP = 'DELETE' THEN
            v_quantity := OLD.quantity;  -- Restore quantity
            v_txn_value := COALESCE(OLD.txn_value, 0);  -- Restore value
            v_commission := 0;
        END IF;

    ELSIF TG_TABLE_NAME = 'bonus_records' THEN
        -- BONUS: Increase quantity (free shares), NO cost
        -- This dilutes the WACC (same total cost, more shares)
        IF TG_OP = 'INSERT' THEN
            v_quantity := NEW.quantity;
            v_txn_value := 0;  -- Free shares
            v_commission := 0;  -- No cost
        ELSIF TG_OP = 'UPDATE' THEN
            v_quantity := NEW.quantity - OLD.quantity;
            v_txn_value := 0;
            v_commission := 0;
        ELSIF TG_OP = 'DELETE' THEN
            v_quantity := -OLD.quantity;
            v_txn_value := 0;
            v_commission := 0;
        END IF;

    ELSIF TG_TABLE_NAME = 'right_records' THEN
        -- RIGHT: Increase quantity, add cost (paid for rights)
        IF TG_OP = 'INSERT' THEN
            v_quantity := NEW.quantity;
            v_txn_value := COALESCE(NEW.quantity * NEW.effective_rate, 0);
            v_commission := COALESCE(NEW.total_value, NEW.quantity * NEW.effective_rate, 0);
        ELSIF TG_OP = 'UPDATE' THEN
            v_quantity := NEW.quantity - OLD.quantity;
            v_txn_value := COALESCE(NEW.quantity * NEW.effective_rate, 0) - COALESCE(OLD.quantity * OLD.effective_rate, 0);
            v_commission := COALESCE(NEW.total_value, 0) - COALESCE(OLD.total_value, 0);
        ELSIF TG_OP = 'DELETE' THEN
            v_quantity := -OLD.quantity;
            v_txn_value := -COALESCE(OLD.quantity * OLD.effective_rate, 0);
            v_commission := -COALESCE(OLD.total_value, OLD.quantity * OLD.effective_rate, 0);
        END IF;

    ELSIF TG_TABLE_NAME = 'promoter_records' THEN
        -- PROMOTER: Increase quantity, add cost
        IF TG_OP = 'INSERT' THEN
            v_quantity := NEW.quantity;
            v_txn_value := COALESCE(NEW.quantity * NEW.effective_rate, 0);
            v_commission := COALESCE(NEW.quantity * NEW.effective_rate, 0);
        ELSIF TG_OP = 'UPDATE' THEN
            v_quantity := NEW.quantity - OLD.quantity;
            v_txn_value := COALESCE(NEW.quantity * NEW.effective_rate, 0) - COALESCE(OLD.quantity * OLD.effective_rate, 0);
            v_commission := COALESCE(NEW.quantity * NEW.effective_rate, 0) - COALESCE(OLD.quantity * OLD.effective_rate, 0);
        ELSIF TG_OP = 'DELETE' THEN
            v_quantity := -OLD.quantity;
            v_txn_value := -COALESCE(OLD.quantity * OLD.effective_rate, 0);
            v_commission := -COALESCE(OLD.quantity * OLD.effective_rate, 0);
        END IF;

    ELSIF TG_TABLE_NAME = 'ipo_allotment_records' THEN
        -- IPO: Increase quantity, add cost
        IF TG_OP = 'INSERT' THEN
            v_quantity := NEW.quantity;
            v_txn_value := COALESCE(NEW.quantity * NEW.effective_rate, 0);
            v_commission := COALESCE(NEW.quantity * NEW.effective_rate, 0);
        ELSIF TG_OP = 'UPDATE' THEN
            v_quantity := NEW.quantity - OLD.quantity;
            v_txn_value := COALESCE(NEW.quantity * NEW.effective_rate, 0) - COALESCE(OLD.quantity * OLD.effective_rate, 0);
            v_commission := COALESCE(NEW.quantity * NEW.effective_rate, 0) - COALESCE(OLD.quantity * OLD.effective_rate, 0);
        ELSIF TG_OP = 'DELETE' THEN
            v_quantity := -OLD.quantity;
            v_txn_value := -COALESCE(OLD.quantity * OLD.effective_rate, 0);
            v_commission := -COALESCE(OLD.quantity * OLD.effective_rate, 0);
        END IF;

    ELSIF TG_TABLE_NAME = 'closeout_records' THEN
        -- CLOSEOUT: Increase quantity, add cost
        IF TG_OP = 'INSERT' THEN
            v_quantity := NEW.closeout_quantity;
            v_txn_value := COALESCE(NEW.closeout_amount, 0);
            v_commission := COALESCE(NEW.closeout_amount, 0);
        ELSIF TG_OP = 'UPDATE' THEN
            v_quantity := NEW.closeout_quantity - OLD.closeout_quantity;
            v_txn_value := COALESCE(NEW.closeout_amount, 0) - COALESCE(OLD.closeout_amount, 0);
            v_commission := COALESCE(NEW.closeout_amount, 0) - COALESCE(OLD.closeout_amount, 0);
        ELSIF TG_OP = 'DELETE' THEN
            v_quantity := -OLD.closeout_quantity;
            v_txn_value := -COALESCE(OLD.closeout_amount, 0);
            v_commission := -COALESCE(OLD.closeout_amount, 0);
        END IF;

    ELSE
        -- Unknown table, return without changes
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- ========================================================================
    -- Insert or update symbol_holdings
    -- ========================================================================
    INSERT INTO symbol_holdings (
        symbol, fund_id, fiscal_year_id,
        quantity, total_txn_value, total_with_commission,
        source_type, sub_id
    ) VALUES (
        v_symbol, v_fund_id, v_fiscal_year_id,
        v_quantity, v_txn_value, v_commission,
        v_source_type, v_sub_id
    )
    ON CONFLICT (symbol, fund_id, fiscal_year_id) DO UPDATE SET
        quantity = symbol_holdings.quantity + v_quantity,
        total_txn_value = symbol_holdings.total_txn_value + v_txn_value,
        total_with_commission = symbol_holdings.total_with_commission + v_commission;

    -- Delete if quantity becomes zero or negative
    DELETE FROM symbol_holdings
    WHERE symbol = v_symbol
      AND fiscal_year_id = v_fiscal_year_id
      AND fund_id = v_fund_id
      AND COALESCE(quantity, 0) <= 0;

    RETURN COALESCE(NEW, OLD);
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in fn_update_symbol_holdings for table %: %', TG_TABLE_NAME, SQLERRM;
        RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 6: PROFIT/LOSS CALCULATION TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_calculate_sell_profit_loss()
RETURNS TRIGGER AS $$
DECLARE
    fy_effective_rate NUMERIC(14,2);
    sh_wacc_tax_base NUMERIC(14,2);
    calculated_profit_loss NUMERIC(18,4);
    calculated_approx_profit_loss NUMERIC(18,4);
BEGIN
    -- Basic guards: require keys we need
    IF NEW.fund_id IS NULL OR NEW.fiscal_year_id IS NULL OR 
       NEW.symbol IS NULL OR NEW.client_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Skip if quantity missing or zero
    IF NEW.quantity IS NULL OR NEW.quantity = 0 THEN
        RETURN NEW;
    END IF;

    -- Fetch effective_rate from fiscal_year_balance for this client_id, symbol, fiscal_year_id
    SELECT COALESCE(effective_rate, 0)
    INTO fy_effective_rate
    FROM fiscal_year_balance
    WHERE client_id = NEW.client_id
      AND symbol = NEW.symbol
      AND fiscal_year_id = NEW.fiscal_year_id
    LIMIT 1;

    -- If no fiscal_year_balance row found, set to 0
    IF NOT FOUND THEN
        fy_effective_rate := 0;
    END IF;

    -- Fetch wacc_tax_base from symbol_holdings for this fund_id, symbol, fiscal_year_id
    SELECT COALESCE(wacc_tax_base, 0)
    INTO sh_wacc_tax_base
    FROM symbol_holdings
    WHERE fund_id = NEW.fund_id
      AND symbol = NEW.symbol
      AND fiscal_year_id = NEW.fiscal_year_id
    LIMIT 1;

    IF NOT FOUND THEN
        sh_wacc_tax_base := 0;
    END IF;

    -- Calculate accounting profit_loss using fiscal_year_balance.effective_rate
    -- profit_loss = (sell_price - buy_effective_rate) * quantity
    IF NEW.price IS NOT NULL AND NEW.price > 0 THEN
        IF fy_effective_rate > 0 THEN
            calculated_profit_loss := (NEW.price - fy_effective_rate) * NEW.quantity;
            NEW.profit_loss := ROUND(calculated_profit_loss::NUMERIC, 2);
        ELSE
            NEW.profit_loss := 0;
        END IF;
    END IF;

    -- Calculate approx_profit_loss using symbol_holdings.wacc_tax_base and sell effective_rate
    -- approx_profit_loss = (sell_effective_rate - wacc_tax_base) * quantity
    IF NEW.effective_rate IS NOT NULL AND NEW.effective_rate > 0 THEN
        IF sh_wacc_tax_base > 0 THEN
            calculated_approx_profit_loss := (NEW.effective_rate - sh_wacc_tax_base) * NEW.quantity;
            NEW.approx_profit_loss := ROUND(calculated_approx_profit_loss::NUMERIC, 2);
        ELSE
            NEW.approx_profit_loss := 0;
        END IF;
    END IF;

    RETURN NEW;

EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in fn_calculate_sell_profit_loss for contract %: %', 
                      COALESCE(NEW.contract_number, '<no-contract>'), SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 7: ORDER_BOOK TO STAGING TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_insert_order_book_to_staging()
RETURNS TRIGGER AS $$
DECLARE
    v_fund_id INTEGER;
BEGIN
    -- Get fund_id from client_broker_mapping
    SELECT fund_id INTO v_fund_id
    FROM client_broker_mapping
    WHERE client_id = NEW.client_id
    LIMIT 1;

    -- If client not found, skip
    IF v_fund_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Ensure stock exists
    PERFORM ensure_stock_exists(NEW.symbol);

    -- Insert into appropriate staging table based on transaction_type
    IF UPPER(NEW.transaction_type) = 'BUY' THEN
        INSERT INTO buy_records_staging (
            fund_id, upload_id, contract_number, client_id, symbol,
            quantity, price, txn_value, transaction_date, fiscal_year_id
        ) VALUES (
            v_fund_id, NEW.upload_id, NEW.contract_number, NEW.client_id, NEW.symbol,
            NEW.quantity, NEW.price, NEW.txn_value, NEW.transaction_date, NEW.fiscal_year_id
        )
        ON CONFLICT (contract_number) DO UPDATE SET
            quantity = EXCLUDED.quantity,
            price = EXCLUDED.price,
            txn_value = EXCLUDED.txn_value,
            transaction_date = EXCLUDED.transaction_date,
            fiscal_year_id = EXCLUDED.fiscal_year_id;

    ELSIF UPPER(NEW.transaction_type) = 'SELL' THEN
        INSERT INTO sell_records_staging (
            fund_id, upload_id, contract_number, client_id, symbol,
            quantity, price, txn_value, transaction_date, fiscal_year_id
        ) VALUES (
            v_fund_id, NEW.upload_id, NEW.contract_number, NEW.client_id, NEW.symbol,
            NEW.quantity, NEW.price, NEW.txn_value, NEW.transaction_date, NEW.fiscal_year_id
        )
        ON CONFLICT (contract_number) DO UPDATE SET
            quantity = EXCLUDED.quantity,
            price = EXCLUDED.price,
            txn_value = EXCLUDED.txn_value,
            transaction_date = EXCLUDED.transaction_date,
            fiscal_year_id = EXCLUDED.fiscal_year_id;
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in fn_insert_order_book_to_staging: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- ============================================================================
-- PART 3: CARRYFORWARD FUNCTION AND TRIGGER CREATION
-- ============================================================================

-- ============================================================================
-- SECTION 8: FISCAL YEAR CARRYFORWARD FUNCTION (WITH STAGING SUPPORT)
-- ============================================================================

CREATE OR REPLACE FUNCTION carryforward_fiscal_year_balance(
    fromyear INTEGER,
    toyear INTEGER
) RETURNS TEXT AS $$
DECLARE
    v_record RECORD;
    v_staging_record RECORD;
    v_count INTEGER := 0;
    v_staging_count INTEGER := 0;
BEGIN
    -- Validate fiscal years exist
    IF NOT EXISTS (SELECT 1 FROM fiscal_years WHERE fiscal_year_id = fromyear) THEN
        RAISE EXCEPTION 'Source fiscal year % does not exist', fromyear;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM fiscal_years WHERE fiscal_year_id = toyear) THEN
        RAISE EXCEPTION 'Target fiscal year % does not exist', toyear;
    END IF;

    -- ========================================================================
    -- PART 1: Carryforward fiscal_year_balance (client-specific holdings)
    -- ========================================================================
    FOR v_record IN
        SELECT 
            client_id, symbol, fund_id, source_type, sub_id,
            COALESCE(closing_quantity, 0) AS closing_qty,
            COALESCE(effective_rate, 0) AS closing_rate
        FROM fiscal_year_balance
        WHERE fiscal_year_id = fromyear
          AND COALESCE(closing_quantity, 0) > 0
    LOOP
        -- Insert as opening balance in new fiscal year
        INSERT INTO fiscal_year_balance (
            client_id, symbol, fiscal_year_id, fund_id,
            opening_quantity, added_quantity, effective_rate,
            opening_rate, source_type, sub_id, demat, non_demat
        )
        VALUES (
            v_record.client_id, v_record.symbol, toyear, v_record.fund_id,
            v_record.closing_qty, 0, v_record.closing_rate,
            v_record.closing_rate, v_record.source_type, v_record.sub_id,
            0, v_record.closing_qty  -- All carried forward as non_demat initially
        )
        ON CONFLICT (client_id, symbol, fiscal_year_id) DO UPDATE SET
            opening_quantity = EXCLUDED.opening_quantity,
            opening_rate = EXCLUDED.opening_rate,
            effective_rate = EXCLUDED.effective_rate,
            source_type = EXCLUDED.source_type,
            sub_id = EXCLUDED.sub_id,
            added_quantity = 0,
            demat = 0,
            non_demat = EXCLUDED.opening_quantity;
        
        v_count := v_count + 1;
    END LOOP;

    -- ========================================================================
    -- PART 2: Carryforward fiscal_year_balance_staging (non-dematerialized holdings)
    -- ========================================================================
    FOR v_staging_record IN
        SELECT 
            symbol, fund_id, source_type, sub_id,
            COALESCE(closing_quantity, 0) AS closing_qty,
            COALESCE(effective_rate, 0) AS closing_rate,
            remarks
        FROM fiscal_year_balance_staging
        WHERE fiscal_year_id = fromyear
          AND COALESCE(closing_quantity, 0) > 0
    LOOP
        -- Insert as opening balance in new fiscal year staging
        INSERT INTO fiscal_year_balance_staging (
            symbol, fiscal_year_id, fund_id, sub_id,
            opening_quantity, added_quantity, effective_rate,
            opening_rate, source_type, demat, non_demat, remarks
        )
        VALUES (
            v_staging_record.symbol, toyear, v_staging_record.fund_id, v_staging_record.sub_id,
            v_staging_record.closing_qty, 0, v_staging_record.closing_rate,
            v_staging_record.closing_rate, v_staging_record.source_type,
            0, v_staging_record.closing_qty,  -- All carried forward as non_demat
            COALESCE(v_staging_record.remarks, '') || ' | Carried forward from FY ' || fromyear
        );
        
        v_staging_count := v_staging_count + 1;
    END LOOP;

    RETURN FORMAT('Successfully carried forward %s fiscal_year_balance records and %s fiscal_year_balance_staging records from fiscal year %s to %s', 
                  v_count, v_staging_count, fromyear, toyear);
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error in carryforward_fiscal_year_balance: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 9: CONFIRM STAGING RECORDS FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION confirm_staging_records(uploadid INTEGER)
RETURNS VOID AS $$
DECLARE
    v_record RECORD;
    v_wacc NUMERIC(14,2);
    v_profit_loss NUMERIC(14,2);
    v_cost_basis NUMERIC(16,2);
BEGIN
    -- Validate upload exists and is not confirmed
    IF NOT EXISTS (
        SELECT 1 FROM uploads 
        WHERE upload_id = uploadid 
        AND is_confirmed = false
    ) THEN
        RAISE EXCEPTION 'Upload % does not exist or is already confirmed', uploadid;
    END IF;

    -- Copy buy_records_staging to buy_records
    INSERT INTO buy_records (
        fund_id, upload_id, client_id, symbol, quantity, price, txn_value,
        commission_rate, commission_amount, sebon_commission, effective_rate,
        net_payable, transaction_date, recorded_at, contract_number, fiscal_year_id
    )
    SELECT 
        fund_id, upload_id, client_id, symbol, quantity, price, txn_value,
        commission_rate, commission_amount, sebon_commission, effective_rate,
        net_payable, transaction_date, recorded_at, contract_number, fiscal_year_id
    FROM buy_records_staging
    WHERE upload_id = uploadid
    ON CONFLICT (contract_number) DO UPDATE SET
        quantity = EXCLUDED.quantity,
        price = EXCLUDED.price,
        txn_value = EXCLUDED.txn_value,
        commission_rate = EXCLUDED.commission_rate,
        commission_amount = EXCLUDED.commission_amount,
        sebon_commission = EXCLUDED.sebon_commission,
        effective_rate = EXCLUDED.effective_rate,
        net_payable = EXCLUDED.net_payable,
        transaction_date = EXCLUDED.transaction_date;

    -- Copy sell_records_staging to sell_records
    -- Profit/loss will be calculated by trigger
    INSERT INTO sell_records (
        fund_id, upload_id, client_id, symbol, quantity, price, txn_value,
        commission_rate, commission_amount, capital_gain_tax, sebon_commission,
        effective_rate, net_receivable, transaction_date, recorded_at,
        approx_profit_loss, contract_number, fiscal_year_id
    )
    SELECT 
        fund_id, upload_id, client_id, symbol, quantity, price, txn_value,
        commission_rate, commission_amount, capital_gain_tax, sebon_commission,
        effective_rate, net_receivable, transaction_date, recorded_at,
        approx_profit_loss, contract_number, fiscal_year_id
    FROM sell_records_staging
    WHERE upload_id = uploadid
    ON CONFLICT (contract_number) DO UPDATE SET
        quantity = EXCLUDED.quantity,
        price = EXCLUDED.price,
        txn_value = EXCLUDED.txn_value,
        commission_rate = EXCLUDED.commission_rate,
        commission_amount = EXCLUDED.commission_amount,
        capital_gain_tax = EXCLUDED.capital_gain_tax,
        sebon_commission = EXCLUDED.sebon_commission,
        effective_rate = EXCLUDED.effective_rate,
        net_receivable = EXCLUDED.net_receivable,
        transaction_date = EXCLUDED.transaction_date;

    -- Mark upload as confirmed
    UPDATE uploads SET is_confirmed = true WHERE upload_id = uploadid;

    -- Delete staging records (optional - keep for audit trail)
    -- DELETE FROM buy_records_staging WHERE upload_id = uploadid;
    -- DELETE FROM sell_records_staging WHERE upload_id = uploadid;

END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 10: DATA INTEGRITY CHECK FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION check_data_integrity()
RETURNS TABLE(issue_type VARCHAR(100), details TEXT) AS $$
BEGIN
    -- Check for negative quantities in fiscal_year_balance
    RETURN QUERY
    SELECT 
        'Negative quantity in fiscal_year_balance'::VARCHAR(100),
        FORMAT('Client: %s, Symbol: %s, FY: %s, Quantity: %s', 
               client_id, symbol, fiscal_year_id, 
               (COALESCE(opening_quantity, 0) + COALESCE(added_quantity, 0)))::TEXT
    FROM fiscal_year_balance
    WHERE (COALESCE(opening_quantity, 0) + COALESCE(added_quantity, 0)) < 0;

    -- Check for negative quantities in symbol_holdings
    RETURN QUERY
    SELECT 
        'Negative quantity in symbol_holdings'::VARCHAR(100),
        FORMAT('Symbol: %s, Fund: %s, FY: %s, Quantity: %s', 
               symbol, fund_id, fiscal_year_id, quantity)::TEXT
    FROM symbol_holdings
    WHERE COALESCE(quantity, 0) < 0;

    -- Check for orphaned fiscal_year_balance records
    RETURN QUERY
    SELECT 
        'Orphaned fiscal_year_balance record'::VARCHAR(100),
        FORMAT('Client: %s, Symbol: %s, FY: %s', 
               fyb.client_id, fyb.symbol, fyb.fiscal_year_id)::TEXT
    FROM fiscal_year_balance fyb
    LEFT JOIN client_broker_mapping cbm ON fyb.client_id = cbm.client_id
    WHERE cbm.client_id IS NULL;

    -- Check for missing WACC when quantity > 0
    RETURN QUERY
    SELECT 
        'Missing WACC in symbol_holdings'::VARCHAR(100),
        FORMAT('Symbol: %s, Fund: %s, FY: %s, Quantity: %s, Total Value: %s', 
               symbol, fund_id, fiscal_year_id, quantity, total_txn_value)::TEXT
    FROM symbol_holdings
    WHERE COALESCE(quantity, 0) > 0 
      AND (wacc_tax_base IS NULL OR wacc_tax_base = 0) 
      AND COALESCE(total_txn_value, 0) > 0;

    -- Check for records with NULL fiscal_year_id
    RETURN QUERY
    SELECT 
        'Missing fiscal_year_id in buy_records'::VARCHAR(100),
        FORMAT('Contract: %s, Symbol: %s, Date: %s', 
               contract_number, symbol, transaction_date)::TEXT
    FROM buy_records
    WHERE fiscal_year_id IS NULL;

    RETURN QUERY
    SELECT 
        'Missing fiscal_year_id in sell_records'::VARCHAR(100),
        FORMAT('Contract: %s, Symbol: %s, Date: %s', 
               contract_number, symbol, transaction_date)::TEXT
    FROM sell_records
    WHERE fiscal_year_id IS NULL;

    RETURN;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 11: CLEANUP ZERO QUANTITY RECORDS FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_zero_quantity_records()
RETURNS VOID AS $$
DECLARE
    v_deleted_fyb INTEGER;
    v_deleted_sh INTEGER;
    v_deleted_fys INTEGER;
BEGIN
    -- Clean up fiscal_year_balance
    DELETE FROM fiscal_year_balance
    WHERE (COALESCE(opening_quantity, 0) + COALESCE(added_quantity, 0)) <= 0;
    
    GET DIAGNOSTICS v_deleted_fyb = ROW_COUNT;
    
    -- Clean up symbol_holdings
    DELETE FROM symbol_holdings
    WHERE COALESCE(quantity, 0) <= 0;
    
    GET DIAGNOSTICS v_deleted_sh = ROW_COUNT;
    
    -- Clean up fiscal_year_balance_staging
    DELETE FROM fiscal_year_balance_staging
    WHERE (COALESCE(opening_quantity, 0) + COALESCE(added_quantity, 0)) <= 0;
    
    GET DIAGNOSTICS v_deleted_fys = ROW_COUNT;
    
    RAISE NOTICE 'Cleaned up % fiscal_year_balance, % symbol_holdings, and % fiscal_year_balance_staging records', 
                 v_deleted_fyb, v_deleted_sh, v_deleted_fys;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 12: CREATE ALL TRIGGERS
-- ============================================================================

-- Triggers for fiscal_year_balance updates
CREATE TRIGGER trg_buy_records_fiscal_balance
    AFTER INSERT OR UPDATE OR DELETE ON buy_records
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_fiscal_year_balance();

CREATE TRIGGER trg_sell_records_fiscal_balance
    AFTER INSERT OR UPDATE OR DELETE ON sell_records
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_fiscal_year_balance();

CREATE TRIGGER trg_bonus_records_fiscal_balance
    AFTER INSERT OR UPDATE OR DELETE ON bonus_records
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_fiscal_year_balance();

CREATE TRIGGER trg_right_records_fiscal_balance
    AFTER INSERT OR UPDATE OR DELETE ON right_records
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_fiscal_year_balance();

CREATE TRIGGER trg_promoter_records_fiscal_balance
    AFTER INSERT OR UPDATE OR DELETE ON promoter_records
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_fiscal_year_balance();

CREATE TRIGGER trg_ipo_allotment_records_fiscal_balance
    AFTER INSERT OR UPDATE OR DELETE ON ipo_allotment_records
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_fiscal_year_balance();

CREATE TRIGGER trg_closeout_records_fiscal_balance
    AFTER INSERT OR UPDATE OR DELETE ON closeout_records
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_fiscal_year_balance();

-- Triggers for fiscal_year_balance_staging updates
-- Note: ipo_allotment_staging table does not exist in current schema
-- IPO data is managed directly in fiscal_year_balance_staging via application code

CREATE TRIGGER trg_bonus_staging_fiscal_balance_staging
    AFTER INSERT OR UPDATE OR DELETE ON bonus_records_staging
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_fiscal_year_balance_staging();

CREATE TRIGGER trg_right_staging_fiscal_balance_staging
    AFTER INSERT OR UPDATE OR DELETE ON right_records_staging
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_fiscal_year_balance_staging();

-- Triggers for symbol_holdings updates (all transaction types affect WACC)
CREATE TRIGGER trg_buy_records_symbol_holdings
    AFTER INSERT OR UPDATE OR DELETE ON buy_records
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_symbol_holdings();

CREATE TRIGGER trg_sell_records_symbol_holdings
    AFTER INSERT OR UPDATE OR DELETE ON sell_records
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_symbol_holdings();

CREATE TRIGGER trg_bonus_records_symbol_holdings
    AFTER INSERT OR UPDATE OR DELETE ON bonus_records
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_symbol_holdings();

CREATE TRIGGER trg_right_records_symbol_holdings
    AFTER INSERT OR UPDATE OR DELETE ON right_records
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_symbol_holdings();

CREATE TRIGGER trg_promoter_records_symbol_holdings
    AFTER INSERT OR UPDATE OR DELETE ON promoter_records
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_symbol_holdings();

CREATE TRIGGER trg_ipo_allotment_records_symbol_holdings
    AFTER INSERT OR UPDATE OR DELETE ON ipo_allotment_records
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_symbol_holdings();

CREATE TRIGGER trg_closeout_records_symbol_holdings
    AFTER INSERT OR UPDATE OR DELETE ON closeout_records
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_symbol_holdings();

-- Triggers for profit/loss calculations
CREATE TRIGGER trg_sell_records_profit_loss
    BEFORE INSERT OR UPDATE ON sell_records
    FOR EACH ROW
    EXECUTE FUNCTION fn_calculate_sell_profit_loss();

CREATE TRIGGER trg_sell_records_staging_profit_loss
    BEFORE INSERT OR UPDATE ON sell_records_staging
    FOR EACH ROW
    EXECUTE FUNCTION fn_calculate_sell_profit_loss();

-- Trigger for order_book to staging conversion
CREATE TRIGGER trg_order_book_to_staging
    AFTER INSERT ON order_book
    FOR EACH ROW
    EXECUTE FUNCTION fn_insert_order_book_to_staging();

-- ============================================================================
-- SECTION 13: GRANT PERMISSIONS (OPTIONAL)
-- ============================================================================

-- Grant execute permissions on functions to your application user
-- GRANT EXECUTE ON FUNCTION calculate_weighted_average TO your_app_user;
-- GRANT EXECUTE ON FUNCTION ensure_stock_exists TO your_app_user;
-- GRANT EXECUTE ON FUNCTION carryforward_fiscal_year_balance TO your_app_user;
-- GRANT EXECUTE ON FUNCTION confirm_staging_records TO your_app_user;
-- GRANT EXECUTE ON FUNCTION check_data_integrity TO your_app_user;
-- GRANT EXECUTE ON FUNCTION cleanup_zero_quantity_records TO your_app_user;

-- ============================================================================
-- END OF TRIGGER AND FUNCTION DEFINITIONS
-- ============================================================================

-- To apply this file, run:
-- psql -U your_username -d your_database -f database_triggers_functions_part1.sql
-- psql -U your_username -d your_database -f database_triggers_functions_part2.sql
-- psql -U your_username -d your_database -f database_triggers_functions_part3.sql

-- Or combine all parts and run as one file
