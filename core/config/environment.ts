import {
  getEnvBoolean,
  getEnvNumber,
  getEnvString,
} from "@/common/utils/env.utils";

/**
 * Token refresh configuration
 */
export const TokenRefreshConfig = {
  // Frontend configuration
  getFrontendRefreshIntervalMinutes: (): number =>
    getEnvNumber("NEXT_PUBLIC_TOKEN_REFRESH_INTERVAL_MINUTES", {
      defaultValue: 15,
      min: 1,
      max: 60,
    }),

  // Backend configuration
  getBackendRefreshThresholdMinutes: (): number =>
    getEnvNumber("TOKEN_REFRESH_THRESHOLD_MINUTES", {
      defaultValue: 60,
      min: 5,
      max: 120,
    }),

  getBulkUpdateIntervalMinutes: (): number =>
    getEnvNumber("TOKEN_BULK_UPDATE_INTERVAL_MINUTES", {
      defaultValue: 15,
      min: 5,
      max: 60,
    }),

  // API configuration
  getAimharderFingerprint: (): string =>
    getEnvString(
      "AIMHARDER_FINGERPRINT",
      "my0pz7di4kr8nuq718uecu4ev23fbosfp20z1q6smntm42ideb"
    ),

  getFrontendAimharderFingerprint: (): string =>
    getEnvString(
      "NEXT_PUBLIC_AIMHARDER_FINGERPRINT",
      "my0pz7di4kr8nuq718uecu4ev23fbosfp20z1q6smntm42ideb"
    ),

  // Debug configuration
  getDebugMode: (): boolean => getEnvBoolean("TOKEN_REFRESH_DEBUG", false),
} as const;

/**
 * Export commonly used configurations
 */
export const ENV = {
  ...TokenRefreshConfig,

  // Add other environment configurations here as needed
  getAppUrl: (): string => getEnvString("APP_URL"),
  getDiscordWebhookUrl: (): string | undefined =>
    process.env.DISCORD_WEBHOOK_URL,
} as const;
