import { getEnvString } from "@/common/utils/env.utils";

/**
 * Export environment configurations
 */
export const ENV = {
  // API configuration
  getAimharderFingerprint: (): string =>
    getEnvString(
      "AIMHARDER_FINGERPRINT",
      "my0pz7di4kr8nuq718uecu4ev23fbosfp20z1q6smntm42ideb"
    ),
} as const;
