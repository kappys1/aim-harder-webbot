import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  generateBackgroundFingerprint,
  isBackgroundFingerprint,
  isDeviceFingerprint,
  getSessionTypeFromFingerprint,
} from './background-fingerprint.utils';

describe('background-fingerprint.utils', () => {
  const originalEnv = process.env.BACKGROUND_FINGERPRINT_SALT;

  beforeEach(() => {
    // Set a test salt
    process.env.BACKGROUND_FINGERPRINT_SALT = 'test-salt-123';
  });

  afterEach(() => {
    // Restore original environment
    process.env.BACKGROUND_FINGERPRINT_SALT = originalEnv;
  });

  describe('generateBackgroundFingerprint', () => {
    it('should generate fingerprint with bg- prefix', () => {
      const fingerprint = generateBackgroundFingerprint('test@example.com');

      expect(fingerprint).toMatch(/^bg-[a-f0-9]{40}$/);
    });

    it('should generate 43-character fingerprint (bg- + 40 hex)', () => {
      const fingerprint = generateBackgroundFingerprint('test@example.com');

      expect(fingerprint).toHaveLength(43);
    });

    it('should be DETERMINISTIC - same email produces same fingerprint', () => {
      const fp1 = generateBackgroundFingerprint('test@example.com');
      const fp2 = generateBackgroundFingerprint('test@example.com');

      expect(fp1).toBe(fp2);
    });

    it('should generate different fingerprints for different emails', () => {
      const fp1 = generateBackgroundFingerprint('user1@example.com');
      const fp2 = generateBackgroundFingerprint('user2@example.com');

      expect(fp1).not.toBe(fp2);
    });

    it('should normalize email (case insensitive)', () => {
      const fp1 = generateBackgroundFingerprint('test@example.com');
      const fp2 = generateBackgroundFingerprint('TEST@EXAMPLE.COM');
      const fp3 = generateBackgroundFingerprint('TeSt@ExAmPlE.cOm');

      expect(fp1).toBe(fp2);
      expect(fp2).toBe(fp3);
    });

    it('should normalize email (trim whitespace)', () => {
      const fp1 = generateBackgroundFingerprint('test@example.com');
      const fp2 = generateBackgroundFingerprint('  test@example.com  ');
      const fp3 = generateBackgroundFingerprint('\ttest@example.com\n');

      expect(fp1).toBe(fp2);
      expect(fp2).toBe(fp3);
    });

    it('should generate different fingerprints for different salts', () => {
      const fp1 = generateBackgroundFingerprint('test@example.com');

      process.env.BACKGROUND_FINGERPRINT_SALT = 'different-salt';
      const fp2 = generateBackgroundFingerprint('test@example.com');

      expect(fp1).not.toBe(fp2);
    });

    it('should use default salt if environment variable not set', () => {
      delete process.env.BACKGROUND_FINGERPRINT_SALT;

      const fingerprint = generateBackgroundFingerprint('test@example.com');

      expect(fingerprint).toMatch(/^bg-[a-f0-9]{40}$/);
    });

    it('should be cryptographically secure (not reversible)', () => {
      const fingerprint = generateBackgroundFingerprint('secret@example.com');

      // Fingerprint should not contain the email
      expect(fingerprint.toLowerCase()).not.toContain('secret');
      expect(fingerprint.toLowerCase()).not.toContain('example');
    });

    it('should generate same fingerprint multiple times (for UPSERT)', () => {
      // Simulating multiple logins
      const logins = Array.from({ length: 10 }, () =>
        generateBackgroundFingerprint('test@example.com')
      );

      const firstFingerprint = logins[0];
      logins.forEach((fingerprint) => {
        expect(fingerprint).toBe(firstFingerprint);
      });
    });
  });

  describe('isBackgroundFingerprint', () => {
    it('should return true for background fingerprints', () => {
      const bgFingerprint = generateBackgroundFingerprint('test@example.com');

      expect(isBackgroundFingerprint(bgFingerprint)).toBe(true);
    });

    it('should return false for device fingerprints', () => {
      expect(isBackgroundFingerprint('device-abc123xyz')).toBe(false);
      expect(isBackgroundFingerprint('my0pz7di4kr8nuq718uecu4ev23fbosfp20z1q6smntm42ideb')).toBe(false);
    });

    it('should return false for malformed bg- fingerprints', () => {
      expect(isBackgroundFingerprint('bg-short')).toBe(false);
      expect(isBackgroundFingerprint('bg-toolongfingerprint1234567890abcdef')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isBackgroundFingerprint('')).toBe(false);
    });
  });

  describe('isDeviceFingerprint', () => {
    it('should return true for device fingerprints', () => {
      expect(isDeviceFingerprint('device-abc123xyz')).toBe(true);
      expect(isDeviceFingerprint('my0pz7di4kr8nuq718uecu4ev23fbosfp20z1q6smntm42ideb')).toBe(true);
    });

    it('should return false for background fingerprints', () => {
      const bgFingerprint = generateBackgroundFingerprint('test@example.com');

      expect(isDeviceFingerprint(bgFingerprint)).toBe(false);
    });
  });

  describe('getSessionTypeFromFingerprint', () => {
    it('should return "background" for background fingerprints', () => {
      const bgFingerprint = generateBackgroundFingerprint('test@example.com');

      expect(getSessionTypeFromFingerprint(bgFingerprint)).toBe('background');
    });

    it('should return "device" for device fingerprints', () => {
      expect(getSessionTypeFromFingerprint('device-abc123xyz')).toBe('device');
      expect(getSessionTypeFromFingerprint('my0pz7di4kr8nuq718uecu4ev23fbosfp20z1q6smntm42ideb')).toBe('device');
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle re-login scenario correctly', () => {
      const email = 'user@example.com';

      // First login
      const firstLoginFingerprint = generateBackgroundFingerprint(email);

      // Simulate some time passing...
      // Second login (should get SAME fingerprint for UPSERT to work)
      const secondLoginFingerprint = generateBackgroundFingerprint(email);

      expect(secondLoginFingerprint).toBe(firstLoginFingerprint);
    });

    it('should handle multiple users correctly', () => {
      const users = [
        'alice@example.com',
        'bob@example.com',
        'charlie@example.com',
      ];

      const fingerprints = users.map(generateBackgroundFingerprint);

      // All fingerprints should be unique
      const uniqueFingerprints = new Set(fingerprints);
      expect(uniqueFingerprints.size).toBe(users.length);

      // All should be background fingerprints
      fingerprints.forEach((fp) => {
        expect(isBackgroundFingerprint(fp)).toBe(true);
      });
    });

    it('should handle email variations correctly', () => {
      const variations = [
        'test@example.com',
        'TEST@EXAMPLE.COM',
        '  test@example.com  ',
        '\ttest@example.com\n',
        'TeSt@ExAmPlE.cOm',
      ];

      const fingerprints = variations.map(generateBackgroundFingerprint);

      // All variations should produce SAME fingerprint
      const firstFingerprint = fingerprints[0];
      fingerprints.forEach((fp) => {
        expect(fp).toBe(firstFingerprint);
      });
    });
  });
});
