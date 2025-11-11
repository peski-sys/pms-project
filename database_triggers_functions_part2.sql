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
BEGIN
    -- Only process buy_records for symbol_holdings (WACC calculation)
    IF TG_TABLE_NAME != 'buy_records' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Determine operation type and extract values
    IF TG_OP = 'DELETE' THEN
        v_symbol := OLD.symbol;
        v_fiscal_year_id := OLD.fiscal_year_id;
        v_fund_id := OLD.fund_id;
        v_quantity := -OLD.quantity;
        v_txn_value := -COALESCE(OLD.txn_value, 0);
        v_commission := -COALESCE(OLD.net_payable, 0);
    ELSIF TG_OP = 'UPDATE' THEN
        v_symbol := NEW.symbol;
        v_fiscal_year_id := NEW.fiscal_year_id;
        v_fund_id := NEW.fund_id;
        v_quantity := NEW.quantity - OLD.quantity;
        v_txn_value := COALESCE(NEW.txn_value, 0) - COALESCE(OLD.txn_value, 0);
        v_commission := COALESCE(NEW.net_payable, 0) - COALESCE(OLD.net_payable, 0);
    ELSE -- INSERT
        v_symbol := NEW.symbol;
        v_fiscal_year_id := NEW.fiscal_year_id;
        v_fund_id := NEW.fund_id;
        v_quantity := NEW.quantity;
        v_txn_value := COALESCE(NEW.txn_value, 0);
        v_commission := COALESCE(NEW.net_payable, 0);
    END IF;

    -- Skip if fiscal_year_id is NULL
    IF v_fiscal_year_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Ensure stock exists
    PERFORM ensure_stock_exists(v_symbol);

    -- Insert or update symbol_holdings
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
        RAISE WARNING 'Error in fn_update_symbol_holdings: %', SQLERRM;
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
