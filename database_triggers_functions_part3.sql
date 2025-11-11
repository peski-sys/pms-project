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

-- Trigger for symbol_holdings updates (only buy_records affect WACC)
CREATE TRIGGER trg_buy_records_symbol_holdings
    AFTER INSERT OR UPDATE OR DELETE ON buy_records
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
