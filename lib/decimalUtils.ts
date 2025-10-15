import Decimal from 'decimal.js';

// Configure Decimal.js for financial calculations
Decimal.set({ 
  precision: 20,  // High precision for intermediate calculations
  rounding: Decimal.ROUND_HALF_UP  // Standard accounting rounding
});

/**
 * Financial Calculator utility class for precise monetary calculations
 * All methods return numbers rounded to 2 decimal places following accounting standards
 */
export class FinancialCalculator {
  private static readonly DECIMAL_PLACES = 2;

  /**
   * Add two monetary values with precise decimal arithmetic
   */
  static add(a: number | string | null | undefined, b: number | string | null | undefined): number {
    const valueA = new Decimal(a || 0);
    const valueB = new Decimal(b || 0);
    return valueA.add(valueB).toDecimalPlaces(this.DECIMAL_PLACES, Decimal.ROUND_HALF_UP).toNumber();
  }

  /**
   * Subtract two monetary values with precise decimal arithmetic
   */
  static subtract(a: number | string | null | undefined, b: number | string | null | undefined): number {
    const valueA = new Decimal(a || 0);
    const valueB = new Decimal(b || 0);
    return valueA.sub(valueB).toDecimalPlaces(this.DECIMAL_PLACES, Decimal.ROUND_HALF_UP).toNumber();
  }

  /**
   * Multiply two values with precise decimal arithmetic
   */
  static multiply(a: number | string | null | undefined, b: number | string | null | undefined): number {
    const valueA = new Decimal(a || 0);
    const valueB = new Decimal(b || 0);
    return valueA.mul(valueB).toDecimalPlaces(this.DECIMAL_PLACES, Decimal.ROUND_HALF_UP).toNumber();
  }

  /**
   * Divide two values with precise decimal arithmetic
   */
  static divide(a: number | string | null | undefined, b: number | string | null | undefined): number {
    const valueA = new Decimal(a || 0);
    const valueB = new Decimal(b || 0);
    if (valueB.isZero()) return 0;
    return valueA.div(valueB).toDecimalPlaces(this.DECIMAL_PLACES, Decimal.ROUND_HALF_UP).toNumber();
  }

  /**
   * Calculate percentage with precise arithmetic
   */
  static percentage(part: number | string | null | undefined, total: number | string | null | undefined): number {
    const partValue = new Decimal(part || 0);
    const totalValue = new Decimal(total || 0);
    if (totalValue.isZero()) return 0;
    return partValue.div(totalValue).mul(100).toDecimalPlaces(this.DECIMAL_PLACES, Decimal.ROUND_HALF_UP).toNumber();
  }

  /**
   * Round a value to 2 decimal places using accounting standards
   */
  static round(value: number | string | null | undefined): number {
    return new Decimal(value || 0).toDecimalPlaces(this.DECIMAL_PLACES, Decimal.ROUND_HALF_UP).toNumber();
  }

  /**
   * Sum an array of values with precise arithmetic
   */
  static sum(values: (number | string | null | undefined)[]): number {
    let total = new Decimal(0);
    for (const value of values) {
      total = total.add(new Decimal(value || 0));
    }
    return total.toDecimalPlaces(this.DECIMAL_PLACES, Decimal.ROUND_HALF_UP).toNumber();
  }

  /**
   * Calculate weighted average with precise arithmetic
   */
  static weightedAverage(values: number[], weights: number[]): number {
    if (values.length !== weights.length || values.length === 0) return 0;
    
    let weightedSum = new Decimal(0);
    let totalWeight = new Decimal(0);
    
    for (let i = 0; i < values.length; i++) {
      const value = new Decimal(values[i] || 0);
      const weight = new Decimal(weights[i] || 0);
      weightedSum = weightedSum.add(value.mul(weight));
      totalWeight = totalWeight.add(weight);
    }
    
    if (totalWeight.isZero()) return 0;
    return weightedSum.div(totalWeight).toDecimalPlaces(this.DECIMAL_PLACES, Decimal.ROUND_HALF_UP).toNumber();
  }

  /**
   * Calculate compound values with precise arithmetic (for effective rates)
   */
  static calculateEffectiveRate(totalValue: number | string, quantity: number): number {
    const value = new Decimal(totalValue || 0);
    const qty = new Decimal(quantity || 0);
    if (qty.isZero()) return 0;
    return value.div(qty).toDecimalPlaces(this.DECIMAL_PLACES, Decimal.ROUND_HALF_UP).toNumber();
  }

  /**
   * Safely convert any value to number with 2 decimal places
   */
  static sanitizeNumeric(value: any): number {
    try {
      return new Decimal(value || 0).toDecimalPlaces(this.DECIMAL_PLACES, Decimal.ROUND_HALF_UP).toNumber();
    } catch {
      return 0;
    }
  }

  /**
   * Check if a value is zero or effectively zero (within decimal precision)
   */
  static isZero(value: number | string | null | undefined): boolean {
    return new Decimal(value || 0).abs().lessThan(new Decimal(10).pow(-this.DECIMAL_PLACES));
  }

  /**
   * Format value for display (maintains precision but returns number)
   */
  static formatForApi(value: number | string | null | undefined): number {
    return this.round(value);
  }
}

/**
 * Backward compatibility - enhanced sanitizeNumeric with decimal precision
 */
export function sanitizeNumeric(value: any): number {
  return FinancialCalculator.sanitizeNumeric(value);
}

/**
 * Enhanced percentage calculation with decimal precision
 */
export function calculatePercentage(part: number, total: number): number {
  return FinancialCalculator.percentage(part, total);
}