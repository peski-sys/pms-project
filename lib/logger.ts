/**
 * Production-grade logging system
 * Replaces console.log with structured logging
 */

import { createLogger, format, transports } from 'winston';

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Create logger instance
const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  levels: logLevels,
  format: format.combine(
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss:ms',
    }),
    format.errors({ stack: true }),
    format.json(),
    format.printf(({ timestamp, level, message, ...meta }) => {
      return JSON.stringify({
        timestamp,
        level,
        message,
        ...meta,
      });
    })
  ),
  transports: [
    // Console transport for development
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      ),
    }),
    
    // File transport for production
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    new transports.File({
      filename: 'logs/combined.log',
    }),
  ],
});

// Business event logging
export const businessLogger = {
  portfolioCalculation: (data: {
    clientId: string;
    symbol: string;
    operation: string;
    oldValue?: number;
    newValue?: number;
  }) => {
    logger.info('Portfolio Calculation', {
      category: 'BUSINESS',
      subcategory: 'PORTFOLIO_CALC',
      ...data,
    });
  },

  corporateAction: (data: {
    clientId: string;
    symbol: string;
    actionType: string;
    quantity: number;
    effectiveDate: string;
  }) => {
    logger.info('Corporate Action', {
      category: 'BUSINESS',
      subcategory: 'CORPORATE_ACTION',
      ...data,
    });
  },

  financialTransaction: (data: {
    clientId: string;
    symbol: string;
    transactionType: string;
    amount: number;
    quantity: number;
  }) => {
    logger.info('Financial Transaction', {
      category: 'BUSINESS',
      subcategory: 'TRANSACTION',
      ...data,
    });
  },

  userAction: (data: {
    userId: string;
    action: string;
    resource: string;
    metadata?: Record<string, any>;
  }) => {
    logger.info('User Action', {
      category: 'SECURITY',
      subcategory: 'USER_ACTION',
      ...data,
    });
  },
};

// Performance logging
export const performanceLogger = {
  apiCall: (data: {
    endpoint: string;
    method: string;
    duration: number;
    statusCode: number;
    userId?: string;
  }) => {
    logger.info('API Performance', {
      category: 'PERFORMANCE',
      subcategory: 'API_CALL',
      ...data,
    });
  },

  databaseQuery: (data: {
    query: string;
    duration: number;
    rowCount?: number;
    error?: string;
  }) => {
    logger.info('Database Query', {
      category: 'PERFORMANCE',
      subcategory: 'DB_QUERY',
      ...data,
    });
  },
};

// Error logging with context
export const errorLogger = {
  apiError: (error: Error, context: {
    endpoint: string;
    userId?: string;
    requestId?: string;
    payload?: any;
  }) => {
    logger.error('API Error', {
      category: 'ERROR',
      subcategory: 'API_ERROR',
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      ...context,
    });
  },

  businessLogicError: (error: Error, context: {
    operation: string;
    clientId?: string;
    symbol?: string;
    data?: any;
  }) => {
    logger.error('Business Logic Error', {
      category: 'ERROR',
      subcategory: 'BUSINESS_ERROR',
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      ...context,
    });
  },

  systemError: (error: Error, context: {
    component: string;
    operation: string;
    metadata?: any;
  }) => {
    logger.error('System Error', {
      category: 'ERROR',
      subcategory: 'SYSTEM_ERROR',
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      ...context,
    });
  },
};

export default logger;
