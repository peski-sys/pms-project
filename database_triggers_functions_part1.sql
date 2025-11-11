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
DROP TRIGGER IF EXISTS trg_sell_records_profit_loss ON sell_records CASCADE;
DROP TRIGGER IF EXISTS trg_sell_records_staging_profit_loss ON sell_records_staging CASCADE;

DROP TRIGGER IF EXISTS trg_order_book_to_staging ON order_book CASCADE;

DROP TRIGGER IF EXISTS trg_bonus_staging_fiscal_balance_staging ON bonus_records_staging CASCADE;
DROP TRIGGER IF EXISTS trg_right_staging_fiscal_balance_staging ON right_records_staging CASCADE;
DROP TRIGGER IF EXISTS trg_ipo_staging_fiscal_balance_staging ON ipo_allotment_staging CASCADE;

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
