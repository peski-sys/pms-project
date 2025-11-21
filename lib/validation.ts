/**
 * Comprehensive validation schemas using Zod
 * Provides runtime type safety and input validation
 */

import { z } from 'zod';

// Base schemas for common types
export const PositiveNumber = z.number().positive('Must be a positive number');
export const NonNegativeNumber = z.number().min(0, 'Must be non-negative');
export const ClientId = z.string().min(1, 'Client ID is required').max(25, 'Client ID too long');
export const Symbol = z.string().min(1, 'Symbol is required').max(15, 'Symbol too long').toUpperCase();
export const FiscalYearId = z.number().int().positive('Invalid fiscal year ID');
export const FundId = z.number().int().positive('Invalid fund ID');

// Date validation
export const DateString = z.string().refine(
  (date) => !isNaN(Date.parse(date)),
  'Invalid date format'
);

export const FutureDate = z.string().refine(
  (date) => new Date(date) > new Date(),
  'Date must be in the future'
);

export const PastOrPresentDate = z.string().refine(
  (date) => new Date(date) <= new Date(),
  'Date cannot be in the future'
);

// Corporate Action Schemas
export const BonusRecordSchema = z.object({
  currentFund: z.string().min(1, 'Fund is required'),
  currentClient: ClientId,
  stock_symbol: Symbol,
  stock_quantity: PositiveNumber,
  stock_book_close: DateString,
  sub_id: z.number().int().positive().optional(),
});

export const RightsRecordSchema = z.object({
  currentFund: z.string().min(1, 'Fund is required'),
  currentClient: ClientId,
  stock_symbol: Symbol,
  stock_quantity: PositiveNumber,
  stock_price: PositiveNumber,
  stock_book_close: DateString,
  sub_id: z.number().int().positive().optional(),
});

export const CashRecordSchema = z.object({
  currentFund: z.string().min(1, 'Fund is required'),
  currentClient: ClientId,
  stock_symbol: Symbol,
  stock_cash_amount: PositiveNumber,
  stock_book_close: DateString,
});

export const CloseoutRecordSchema = z.object({
  currentFund: z.string().min(1, 'Fund is required'),
  currentClient: ClientId,
  stock_symbol: Symbol,
  stock_quantity: PositiveNumber,
  stock_amount: PositiveNumber,
  stock_added_at: DateString,
});

export const IPOAllotmentSchema = z.object({
  currentFund: z.string().min(1, 'Fund is required'),
  currentClient: ClientId,
  symbol: Symbol,
  stock_quantity: PositiveNumber,
  stock_price: PositiveNumber,
  stock_added_at: DateString,
  sub_id: z.number().int().positive().optional(),
});

// Transaction Schemas
export const BuyRecordSchema = z.object({
  fund_id: FundId,
  client_id: ClientId,
  symbol: Symbol,
  quantity: PositiveNumber,
  price: PositiveNumber,
  txn_value: PositiveNumber,
  net_payable: PositiveNumber,
  transaction_date: DateString,
  fiscal_year_id: FiscalYearId,
  commission_amount: NonNegativeNumber.optional(),
  commission_rate: z.string().optional(),
});

export const SellRecordSchema = z.object({
  fund_id: FundId,
  client_id: ClientId,
  symbol: Symbol,
  quantity: PositiveNumber,
  price: PositiveNumber,
  txn_value: PositiveNumber,
  net_receivable: PositiveNumber,
  transaction_date: DateString,
  fiscal_year_id: FiscalYearId,
  profit_loss: z.number().optional(),
  commission_amount: NonNegativeNumber.optional(),
  capital_gain_tax: NonNegativeNumber.optional(),
});

// API Request Schemas
export const FilterDataSchema = z.object({
  name: z.string().optional(),
  c_id: z.string().optional(),
  t_type: z.string().optional(),
  s_symbol: z.string().optional(),
  start_date: z.date().optional(),
  end_date: z.date().optional(),
});

export const ExportDataSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  data: z.array(z.any()).min(1, 'Data array cannot be empty'),
  pageType: z.enum(['transaction-history', 'view-ledger', 'metric-dashboard']),
  filters: z.record(z.string(), z.any()).optional(),
});

// Deletion Schemas
export const SafeDeleteSchema = z.object({
  table_name: z.enum([
    'bonus_records',
    'right_records', 
    'cash_records',
    'closeout_records',
    'ipo_allotment_records',
    'promoter_records'
  ]),
  record_id: z.number().int().positive(),
  client_id: ClientId,
  symbol: Symbol,
  fiscal_year_id: FiscalYearId,
  force_delete: z.boolean().default(false),
});

// File Upload Schemas
export const FileUploadSchema = z.object({
  files: z.array(z.any()).min(1, 'At least one file is required'),
  uploadType: z.enum(['excel', 'pdf', 'mixed']).optional(),
});

// Validation helper functions
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: boolean;
  data?: T;
  errors?: string[];
} {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.issues.map((err: any) => `${err.path.join('.')}: ${err.message}`)
      };
    }
    return {
      success: false,
      errors: ['Validation failed with unknown error']
    };
  }
}

// Middleware for API validation
export function createValidationMiddleware<T>(schema: z.ZodSchema<T>) {
  return (data: unknown) => {
    const result = validateInput(schema, data);
    if (!result.success) {
      throw new Error(`Validation failed: ${result.errors?.join(', ')}`);
    }
    return result.data!;
  };
}

// Business rule validations
export const BusinessRules = {
  // Validate sufficient holdings for sell/closeout
  validateSufficientHoldings: z.object({
    currentHoldings: NonNegativeNumber,
    requestedQuantity: PositiveNumber,
  }).refine(
    (data) => data.currentHoldings >= data.requestedQuantity,
    'Insufficient holdings for this transaction'
  ),

  // Validate rights subscription ratio
  validateRightsRatio: z.object({
    baseHoldings: PositiveNumber,
    rightsQuantity: PositiveNumber,
    maxRatio: z.number().positive().default(1), // 1:1 default
  }).refine(
    (data) => data.rightsQuantity <= data.baseHoldings * data.maxRatio,
    'Rights quantity exceeds maximum allowed ratio'
  ),

  // Validate transaction date within fiscal year
  validateFiscalYearDate: z.object({
    transactionDate: DateString,
    fiscalYearStart: DateString,
    fiscalYearEnd: DateString,
  }).refine(
    (data) => {
      const txnDate = new Date(data.transactionDate);
      const startDate = new Date(data.fiscalYearStart);
      const endDate = new Date(data.fiscalYearEnd);
      return txnDate >= startDate && txnDate <= endDate;
    },
    'Transaction date must be within the fiscal year'
  ),

  // Validate price reasonableness (prevent obvious errors)
  validateReasonablePrice: z.object({
    price: PositiveNumber,
    symbol: Symbol,
    minPrice: z.number().positive().default(1),
    maxPrice: z.number().positive().default(100000),
  }).refine(
    (data) => data.price >= data.minPrice && data.price <= data.maxPrice,
    'Price seems unreasonable - please verify'
  ),
};

// Configuration validation
export const ConfigSchema = z.object({
  DATABASE_URL: z.string().url('Invalid database URL'),
  MICROSERVICE_URL: z.string().url('Invalid microservice URL'),
  NEXTAUTH_SECRET: z.string().min(32, 'NextAuth secret must be at least 32 characters'),
  NEXTAUTH_URL: z.string().url('Invalid NextAuth URL'),
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  REDIS_URL: z.string().url('Invalid Redis URL').optional(),
  RATE_LIMIT_MAX: z.number().int().positive().default(100),
  RATE_LIMIT_WINDOW: z.number().int().positive().default(900), // 15 minutes
});

export type Config = z.infer<typeof ConfigSchema>;
