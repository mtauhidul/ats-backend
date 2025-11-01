/**
 * Mongoose plugin to add maxTimeMS to all queries
 * This prevents runaway queries from consuming resources
 */
import mongoose from "mongoose";
import logger from "../utils/logger";

const DEFAULT_TIMEOUT_MS = 5000; // 5 seconds

/**
 * Plugin to add query timeout to all queries
 */
export function queryTimeoutPlugin(schema: mongoose.Schema, options?: { timeoutMs?: number }) {
  const timeoutMs = options?.timeoutMs || DEFAULT_TIMEOUT_MS;

  // Add maxTimeMS to all query operations
  schema.pre(/^find/, function (this: any) {
    if (!this.options.maxTimeMS) {
      this.maxTimeMS(timeoutMs);
    }
  });

  schema.pre("aggregate", function (this: any) {
    if (!this.options.maxTimeMS) {
      this.options.maxTimeMS = timeoutMs;
    }
  });

  schema.pre("countDocuments", function (this: any) {
    if (!this.options.maxTimeMS) {
      this.maxTimeMS(timeoutMs);
    }
  });
}

/**
 * Global query timeout configuration
 * Apply this after all models are loaded
 */
let isGlobalTimeoutConfigured = false;
export function configureGlobalQueryTimeout(timeoutMs: number = DEFAULT_TIMEOUT_MS) {
  // Prevent double configuration
  if (isGlobalTimeoutConfigured) {
    logger.warn('⚠️ Global query timeout already configured, skipping...');
    return;
  }

  // Store the original setOptions method BEFORE any modification
  const originalSetOptions = mongoose.Query.prototype.setOptions;

  // Override setOptions to add default maxTimeMS
  mongoose.Query.prototype.setOptions = function (this: any, options: any) {
    // If options is not provided, create it
    if (!options) {
      options = {};
    }
    
    // Only add maxTimeMS if not already set
    if (!options.maxTimeMS) {
      options.maxTimeMS = timeoutMs;
    }
    
    // Call the original stored method (not the overridden one)
    return originalSetOptions.call(this, options);
  };

  isGlobalTimeoutConfigured = true;
  logger.info(`✅ Global query timeout configured: ${timeoutMs}ms`);
}

/**
 * Wrapper to execute query with custom timeout
 */
export async function executeWithTimeout<T>(
  queryFn: () => Promise<T>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  queryName: string = "Query"
): Promise<T> {
  const startTime = Date.now();

  try {
    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            `Query timeout: ${queryName} exceeded ${timeoutMs}ms`
          )
        );
      }, timeoutMs);
    });

    // Race between query and timeout
    const result = await Promise.race([queryFn(), timeoutPromise]);

    const executionTime = Date.now() - startTime;
    if (executionTime > 1000) {
      logger.warn(`Slow query executed: ${queryName}`, {
        executionTimeMs: executionTime,
      });
    }

    return result;
  } catch (error) {
    const executionTime = Date.now() - startTime;
    logger.error(`Query failed or timed out: ${queryName}`, {
      executionTimeMs: executionTime,
      error: error instanceof Error ? error.message : error,
    });
    throw error;
  }
}

/**
 * Circuit breaker for database queries
 * Prevents cascading failures when database is slow
 */
class QueryCircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private isOpen = false;

  constructor(
    private readonly threshold: number = 5,
    private readonly resetTimeMs: number = 60000
  ) {}

  async execute<T>(queryFn: () => Promise<T>, queryName: string): Promise<T> {
    // Check if circuit breaker should reset
    if (
      this.isOpen &&
      Date.now() - this.lastFailureTime > this.resetTimeMs
    ) {
      logger.info(`Circuit breaker reset for: ${queryName}`);
      this.isOpen = false;
      this.failures = 0;
    }

    // If circuit is open, fail fast
    if (this.isOpen) {
      throw new Error(
        `Circuit breaker open for ${queryName}. Too many failures.`
      );
    }

    try {
      const result = await queryFn();
      // Reset failure count on success
      if (this.failures > 0) {
        this.failures = 0;
      }
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();

      if (this.failures >= this.threshold) {
        this.isOpen = true;
        logger.error(
          `Circuit breaker opened for ${queryName}. Threshold reached: ${this.failures} failures`
        );
      }

      throw error;
    }
  }

  getStatus() {
    return {
      isOpen: this.isOpen,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

// Global circuit breaker instance
export const globalCircuitBreaker = new QueryCircuitBreaker(5, 60000);
