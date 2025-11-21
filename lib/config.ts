/**
 * Environment configuration management
 * Validates and provides type-safe access to environment variables
 */

// Simple config validation without external dependencies
interface AppConfig {
  database: {
    url: string;
    maxConnections: number;
    connectionTimeout: number;
  };
  microservice: {
    url: string;
    timeout: number;
    retries: number;
  };
  auth: {
    secret: string;
    url: string;
    sessionTimeout: number;
  };
  app: {
    nodeEnv: 'development' | 'staging' | 'production';
    port: number;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
  };
  security: {
    rateLimitMax: number;
    rateLimitWindow: number;
    corsOrigins: string[];
  };
  features: {
    enableCaching: boolean;
    enableRealTime: boolean;
    enableAnalytics: boolean;
  };
}

function validateEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name] || defaultValue;
  if (!value) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
}

function validateEnvNumber(name: string, defaultValue?: number): number {
  const value = process.env[name];
  if (!value && defaultValue === undefined) {
    throw new Error(`Environment variable ${name} is required`);
  }
  const parsed = parseInt(value || defaultValue?.toString() || '0', 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a number`);
  }
  return parsed;
}

function validateEnvBoolean(name: string, defaultValue: boolean = false): boolean {
  const value = process.env[name];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

function validateUrl(url: string, name: string): string {
  try {
    new URL(url);
    return url;
  } catch {
    throw new Error(`Invalid URL for ${name}: ${url}`);
  }
}

// Load and validate configuration
export const config: AppConfig = {
  database: {
    url: validateUrl(validateEnvVar('DATABASE_URL'), 'DATABASE_URL'),
    maxConnections: validateEnvNumber('DB_MAX_CONNECTIONS', 20),
    connectionTimeout: validateEnvNumber('DB_CONNECTION_TIMEOUT', 30000),
  },
  microservice: {
    url: validateUrl(validateEnvVar('MICROSERVICE_URL'), 'MICROSERVICE_URL'),
    timeout: validateEnvNumber('MICROSERVICE_TIMEOUT', 30000),
    retries: validateEnvNumber('MICROSERVICE_RETRIES', 3),
  },
  auth: {
    secret: validateEnvVar('NEXTAUTH_SECRET'),
    url: validateUrl(validateEnvVar('NEXTAUTH_URL'), 'NEXTAUTH_URL'),
    sessionTimeout: validateEnvNumber('SESSION_TIMEOUT', 86400), // 24 hours
  },
  app: {
    nodeEnv: (validateEnvVar('NODE_ENV', 'development') as AppConfig['app']['nodeEnv']),
    port: validateEnvNumber('PORT', 3000),
    logLevel: (validateEnvVar('LOG_LEVEL', 'info') as AppConfig['app']['logLevel']),
  },
  security: {
    rateLimitMax: validateEnvNumber('RATE_LIMIT_MAX', 100),
    rateLimitWindow: validateEnvNumber('RATE_LIMIT_WINDOW', 900000), // 15 minutes
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
  },
  features: {
    enableCaching: validateEnvBoolean('ENABLE_CACHING', false),
    enableRealTime: validateEnvBoolean('ENABLE_REALTIME', false),
    enableAnalytics: validateEnvBoolean('ENABLE_ANALYTICS', false),
  },
};

// Environment-specific configurations
export const isDevelopment = config.app.nodeEnv === 'development';
export const isProduction = config.app.nodeEnv === 'production';
export const isStaging = config.app.nodeEnv === 'staging';

// Feature flags
export const features = {
  isDebugMode: isDevelopment || config.app.logLevel === 'debug',
  isCachingEnabled: config.features.enableCaching,
  isRealTimeEnabled: config.features.enableRealTime,
  isAnalyticsEnabled: config.features.enableAnalytics,
  isProductionLogging: isProduction,
};

// Database configuration
export const dbConfig = {
  url: config.database.url,
  maxConnections: config.database.maxConnections,
  connectionTimeout: config.database.connectionTimeout,
  enableLogging: isDevelopment,
  enableMetrics: isProduction,
};

// API configuration
export const apiConfig = {
  microserviceUrl: config.microservice.url,
  timeout: config.microservice.timeout,
  retries: config.microservice.retries,
  rateLimitMax: config.security.rateLimitMax,
  rateLimitWindow: config.security.rateLimitWindow,
};

// Security configuration
export const securityConfig = {
  corsOrigins: config.security.corsOrigins,
  sessionTimeout: config.auth.sessionTimeout,
  enableCSP: isProduction,
  enableHSTS: isProduction,
  enableRateLimiting: true,
};

// Logging configuration
export const loggingConfig = {
  level: config.app.logLevel,
  enableConsole: isDevelopment,
  enableFile: isProduction,
  enableRemote: isProduction,
  enableMetrics: isProduction,
};

// Export configuration validator
export function validateConfiguration(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    // Validate required URLs
    new URL(config.database.url);
    new URL(config.microservice.url);
    new URL(config.auth.url);
  } catch (error) {
    errors.push(`Invalid URL configuration: ${error}`);
  }

  // Validate auth secret length
  if (config.auth.secret.length < 32) {
    errors.push('NEXTAUTH_SECRET must be at least 32 characters long');
  }

  // Validate numeric ranges
  if (config.database.maxConnections < 1 || config.database.maxConnections > 100) {
    errors.push('DB_MAX_CONNECTIONS must be between 1 and 100');
  }

  if (config.security.rateLimitMax < 1) {
    errors.push('RATE_LIMIT_MAX must be greater than 0');
  }

  // Validate environment
  if (!['development', 'staging', 'production'].includes(config.app.nodeEnv)) {
    errors.push('NODE_ENV must be development, staging, or production');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Configuration summary for debugging
export function getConfigSummary() {
  return {
    environment: config.app.nodeEnv,
    features: features,
    database: {
      host: new URL(config.database.url).hostname,
      maxConnections: config.database.maxConnections,
    },
    microservice: {
      host: new URL(config.microservice.url).hostname,
      timeout: config.microservice.timeout,
    },
    security: {
      rateLimitMax: config.security.rateLimitMax,
      corsOrigins: config.security.corsOrigins.length,
    },
  };
}
