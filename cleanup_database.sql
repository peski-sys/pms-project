-- ============================================================================
-- COMPLETE DATABASE CLEANUP SCRIPT
-- This script removes ALL triggers and functions from the portfolio database
-- Run this before reapplying database_triggers_functions_COMPLETE.sql
-- ============================================================================

-- Disable all triggers temporarily to prevent cascading issues
SET session_replication_role = replica;

-- ============================================================================
-- SECTION 1: DROP ALL TRIGGERS (Based on actual analysis)
-- ============================================================================

-- Drop triggers on uploads
DROP TRIGGER IF EXISTS trg_cascade_delete_order_book ON uploads CASCADE;

-- Drop triggers on buy_records
DROP TRIGGER IF EXISTS trg_buy_records_fiscal_balance ON buy_records CASCADE;
DROP TRIGGER IF EXISTS trg_temporal_recalc_buy_records ON buy_records CASCADE;

-- Drop triggers on sell_records  
DROP TRIGGER IF EXISTS trg_sell_records_fiscal_balance ON sell_records CASCADE;
DROP TRIGGER IF EXISTS trg_sell_records_symbol_holdings ON sell_records CASCADE;
DROP TRIGGER IF EXISTS trg_sell_records_profit_loss ON sell_records CASCADE;

-- Drop triggers on bonus_records
DROP TRIGGER IF EXISTS trg_temporal_recalc_bonus_records ON bonus_records CASCADE;

-- Drop triggers on right_records
DROP TRIGGER IF EXISTS trg_temporal_recalc_right_records ON right_records CASCADE;

-- Drop triggers on promoter_records
DROP TRIGGER IF EXISTS trg_temporal_recalc_promoter_records ON promoter_records CASCADE;

-- Drop triggers on ipo_allotment_records
DROP TRIGGER IF EXISTS trg_temporal_recalc_ipo_allotment_records ON ipo_allotment_records CASCADE;

-- Drop triggers on closeout_records
DROP TRIGGER IF EXISTS trg_temporal_recalc_closeout_records ON closeout_records CASCADE;

-- Drop triggers on cash_records
DROP TRIGGER IF EXISTS trg_cash_records_fiscal_balance ON cash_records CASCADE;
DROP TRIGGER IF EXISTS trg_cash_records_symbol_holdings ON cash_records CASCADE;

-- Drop triggers on order_book
DROP TRIGGER IF EXISTS trg_order_book_to_staging ON order_book CASCADE;

-- Drop triggers on staging tables
DROP TRIGGER IF EXISTS trg_bonus_staging_fiscal_balance_staging ON bonus_records_staging CASCADE;
DROP TRIGGER IF EXISTS trg_bonus_staging_symbol_holdings ON bonus_records_staging CASCADE;
DROP TRIGGER IF EXISTS trg_right_staging_fiscal_balance_staging ON right_records_staging CASCADE;
DROP TRIGGER IF EXISTS trg_right_staging_symbol_holdings ON right_records_staging CASCADE;
DROP TRIGGER IF EXISTS trg_cash_staging_fiscal_balance_staging ON cash_records_staging CASCADE;
DROP TRIGGER IF EXISTS trg_cash_staging_symbol_holdings ON cash_records_staging CASCADE;
DROP TRIGGER IF EXISTS trg_sell_records_staging_profit_loss ON sell_records_staging CASCADE;

-- ============================================================================
-- SECTION 2: DROP ALL FUNCTIONS (Based on actual analysis)
-- ============================================================================

-- Drop main trigger functions
DROP FUNCTION IF EXISTS fn_update_fiscal_year_balance() CASCADE;
DROP FUNCTION IF EXISTS fn_update_fiscal_year_balance_staging() CASCADE;
DROP FUNCTION IF EXISTS fn_update_symbol_holdings() CASCADE;
DROP FUNCTION IF EXISTS fn_calculate_sell_profit_loss() CASCADE;
DROP FUNCTION IF EXISTS fn_insert_order_book_to_staging() CASCADE;

-- Drop helper calculation functions
DROP FUNCTION IF EXISTS calculate_weighted_average(NUMERIC, NUMERIC, NUMERIC, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS calculate_effective_rate_view_ledger_formula(VARCHAR, VARCHAR, INTEGER, INTEGER) CASCADE;

-- Drop utility functions
DROP FUNCTION IF EXISTS ensure_stock_exists(VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS is_triggers_disabled() CASCADE;
DROP FUNCTION IF EXISTS disable_triggers_safely() CASCADE;
DROP FUNCTION IF EXISTS enable_triggers_safely() CASCADE;

-- Drop recursion protection functions
DROP FUNCTION IF EXISTS check_recursion_depth(TEXT, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS release_recursion_depth(TEXT) CASCADE;

-- Drop audit and safety functions
DROP FUNCTION IF EXISTS log_deletion_audit(VARCHAR, VARCHAR, JSONB) CASCADE;
DROP FUNCTION IF EXISTS validate_deletion_safety(VARCHAR, INTEGER, VARCHAR, VARCHAR, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS safe_delete_record(VARCHAR, INTEGER, VARCHAR, VARCHAR, INTEGER, INTEGER) CASCADE;

-- Drop recalculation functions
DROP FUNCTION IF EXISTS fn_recalculate_balances_from_date(DATE, VARCHAR, VARCHAR, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS fn_recalculate_fiscal_balances_from_date(DATE, VARCHAR, VARCHAR, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS fn_rebuild_single_fiscal_balance(VARCHAR, VARCHAR, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS fn_recalculate_symbol_holdings_from_date(DATE, VARCHAR, VARCHAR, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS fn_rebuild_single_symbol_holding(VARCHAR, INTEGER, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS fn_recalculate_sell_profit_loss_from_date(DATE, VARCHAR, VARCHAR, INTEGER) CASCADE;

-- Drop carryforward function
DROP FUNCTION IF EXISTS carryforward_fiscal_year_balance(INTEGER, INTEGER) CASCADE;

-- Drop batch processing functions
DROP FUNCTION IF EXISTS confirm_staging_records(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS fn_batch_update_after_staging_confirmation(INTEGER) CASCADE;

-- Drop data integrity and maintenance functions
DROP FUNCTION IF EXISTS check_data_integrity() CASCADE;
DROP FUNCTION IF EXISTS cleanup_zero_quantity_records() CASCADE;
DROP FUNCTION IF EXISTS repair_fiscal_year_balance_data() CASCADE;
DROP FUNCTION IF EXISTS fn_cascade_delete_order_book() CASCADE;
DROP FUNCTION IF EXISTS verify_and_fix_holdings() CASCADE;

-- Drop helper functions for safe updates
DROP FUNCTION IF EXISTS safe_update_fiscal_year_balance(VARCHAR, VARCHAR, INTEGER, INTEGER, INTEGER, NUMERIC, NUMERIC, INTEGER, VARCHAR, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS safe_update_fiscal_year_balance_staging(VARCHAR, INTEGER, INTEGER, INTEGER, INTEGER, NUMERIC, NUMERIC, INTEGER, VARCHAR, INTEGER, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS dematerialize_ipo_allotment(VARCHAR, VARCHAR, INTEGER, INTEGER, INTEGER, INTEGER) CASCADE;

-- Drop stock transfer functions
DROP FUNCTION IF EXISTS process_stock_transfer(BIGINT, BIGINT, TEXT, JSONB, VARCHAR, TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_stock_distribution(BIGINT, BIGINT, TEXT) CASCADE;

-- Drop monitoring and emergency functions
DROP FUNCTION IF EXISTS monitor_trigger_performance() CASCADE;
DROP FUNCTION IF EXISTS reset_recursion_guards() CASCADE;
DROP FUNCTION IF EXISTS emergency_disable_triggers() CASCADE;
DROP FUNCTION IF EXISTS emergency_enable_triggers() CASCADE;
DROP FUNCTION IF EXISTS check_system_health() CASCADE;

-- Drop temporal recalculation functions
DROP FUNCTION IF EXISTS fn_temporal_recalc_bonus_records() CASCADE;
DROP FUNCTION IF EXISTS fn_temporal_recalc_right_records() CASCADE;
DROP FUNCTION IF EXISTS fn_temporal_recalc_promoter_records() CASCADE;
DROP FUNCTION IF EXISTS fn_temporal_recalc_ipo_allotment_records() CASCADE;
DROP FUNCTION IF EXISTS fn_temporal_recalc_closeout_records() CASCADE;
DROP FUNCTION IF EXISTS fn_temporal_recalc_buy_records() CASCADE;

-- ============================================================================
-- SECTION 3: CLEAN UP CONFIGURATION SETTINGS
-- ============================================================================

-- Reset all custom configuration settings
SELECT set_config('custom.recursion_depth_fn_update_fiscal_year_balance', '0', false);
SELECT set_config('custom.recursion_depth_fn_update_symbol_holdings', '0', false);
SELECT set_config('custom.recursion_depth_fn_calculate_sell_profit_loss', '0', false);

-- ============================================================================
-- SECTION 4: CLEAN UP CONSTRAINTS
-- ============================================================================

-- Drop any custom constraints that might have been added
ALTER TABLE stock_transfer_details DROP CONSTRAINT IF EXISTS check_from_quantities CASCADE;
ALTER TABLE fiscal_year_balance DROP CONSTRAINT IF EXISTS check_positive_quantities CASCADE;
ALTER TABLE symbol_holdings DROP CONSTRAINT IF EXISTS check_positive_holdings CASCADE;

-- ============================================================================
-- SECTION 5: RESET SESSION SETTINGS
-- ============================================================================

-- Re-enable triggers
SET session_replication_role = DEFAULT;

-- Reset any other session settings
RESET ALL;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check remaining triggers (should return empty)
SELECT 
    n.nspname as schema_name,
    c.relname as table_name,
    t.tgname as trigger_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname;

-- Check remaining functions (should return empty or only system functions)
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (p.proname LIKE 'fn_%' 
   OR p.proname LIKE 'calculate_%'
   OR p.proname LIKE 'process_%'
   OR p.proname LIKE 'confirm_%'
   OR p.proname LIKE 'check_%'
   OR p.proname LIKE 'cleanup_%'
   OR p.proname LIKE 'repair_%'
   OR p.proname LIKE 'carryforward_%'
   OR p.proname LIKE 'ensure_%'
   OR p.proname LIKE 'get_%'
   OR p.proname LIKE 'monitor_%'
   OR p.proname LIKE 'emergency_%'
   OR p.proname LIKE 'safe_%'
   OR p.proname LIKE 'reset_%'
   OR p.proname LIKE 'release_%'
   OR p.proname LIKE 'is_triggers_%'
   OR p.proname LIKE 'disable_triggers_%'
   OR p.proname LIKE 'enable_triggers_%'
   OR p.proname LIKE 'log_deletion_%'
   OR p.proname LIKE 'validate_deletion_%'
   OR p.proname LIKE 'safe_delete_%'
   OR p.proname LIKE 'dematerialize_%'
   OR p.proname LIKE 'verify_and_fix_%')
ORDER BY function_name;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'DATABASE CLEANUP COMPLETED SUCCESSFULLY';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'All triggers and functions have been removed from the database.';
    RAISE NOTICE 'You can now safely run database_triggers_functions_COMPLETE.sql';
    RAISE NOTICE '============================================================================';
END $$;
