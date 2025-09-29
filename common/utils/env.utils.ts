/**
 * Environment variable utilities
 * Centralized management of environment variables with type safety and defaults
 */

export interface EnvConfig {
  /** Default value if environment variable is not set */
  defaultValue: string | number;
  /** Minimum value for numeric variables */
  min?: number;
  /** Maximum value for numeric variables */
  max?: number;
  /** Whether this is a required variable (will throw if not set and no default) */
  required?: boolean;
}

/**
 * Get a string environment variable with optional default
 */
export function getEnvString(key: string, defaultValue?: string): string {
  const value = process.env[key];

  if (!value) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Required environment variable ${key} is not set`);
  }

  return value;
}

/**
 * Get a number environment variable with validation and default
 */
export function getEnvNumber(key: string, config: EnvConfig): number {
  const value = process.env[key];
  const { defaultValue, min, max } = config;

  if (!value) {
    if (typeof defaultValue === "number") {
      return defaultValue;
    }
    throw new Error(`Required environment variable ${key} is not set`);
  }

  const parsed = parseInt(value, 10);

  if (isNaN(parsed)) {
    throw new Error(
      `Environment variable ${key} must be a valid number, got: ${value}`
    );
  }

  if (min !== undefined && parsed < min) {
    throw new Error(
      `Environment variable ${key} must be >= ${min}, got: ${parsed}`
    );
  }

  if (max !== undefined && parsed > max) {
    throw new Error(
      `Environment variable ${key} must be <= ${max}, got: ${parsed}`
    );
  }

  return parsed;
}

/**
 * Get a boolean environment variable
 */
export function getEnvBoolean(
  key: string,
  defaultValue: boolean = false
): boolean {
  const value = process.env[key];

  if (!value) {
    return defaultValue;
  }

  return value.toLowerCase() === "true" || value === "1";
}
