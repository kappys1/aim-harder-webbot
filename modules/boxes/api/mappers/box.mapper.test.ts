import { describe, it, expect } from 'vitest';
import { BoxMapper } from './box.mapper';
import type { BoxApiResponse, UserBoxApiResponse, BoxWithAccessApiResponse } from '../models/box.api';
import type { Box, UserBox, BoxWithAccess } from '../../models/box.model';

describe('BoxMapper', () => {
  const mockBoxApi: BoxApiResponse = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    box_id: '10122',
    subdomain: 'crossfitcerdanyola',
    name: 'CrossFit Cerdanyola',
    phone: '+34123456789',
    email: 'info@crossfit.com',
    address: '123 Main St, Barcelona',
    website: 'https://crossfit-external.com',
    logo_url: 'https://cdn.example.com/logo.png',
    base_url: 'https://crossfitcerdanyola.aimharder.com',
    created_at: '2025-01-01T10:00:00.000Z',
    updated_at: '2025-01-15T12:30:00.000Z',
  };

  const mockBoxDomain: Box = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    boxId: '10122',
    subdomain: 'crossfitcerdanyola',
    name: 'CrossFit Cerdanyola',
    phone: '+34123456789',
    email: 'info@crossfit.com',
    address: '123 Main St, Barcelona',
    website: 'https://crossfit-external.com',
    logoUrl: 'https://cdn.example.com/logo.png',
    baseUrl: 'https://crossfitcerdanyola.aimharder.com',
    createdAt: new Date('2025-01-01T10:00:00.000Z'),
    updatedAt: new Date('2025-01-15T12:30:00.000Z'),
  };

  describe('toDomain', () => {
    it('should convert API box to domain box', () => {
      const result = BoxMapper.toDomain(mockBoxApi);

      expect(result).toEqual(mockBoxDomain);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should convert timestamps to Date objects', () => {
      const result = BoxMapper.toDomain(mockBoxApi);

      expect(result.createdAt.toISOString()).toBe('2025-01-01T10:00:00.000Z');
      expect(result.updatedAt.toISOString()).toBe('2025-01-15T12:30:00.000Z');
    });

    it('should handle optional fields when present', () => {
      const result = BoxMapper.toDomain(mockBoxApi);

      expect(result.phone).toBe('+34123456789');
      expect(result.email).toBe('info@crossfit.com');
      expect(result.address).toBe('123 Main St, Barcelona');
      expect(result.website).toBe('https://crossfit-external.com');
      expect(result.logoUrl).toBe('https://cdn.example.com/logo.png');
    });

    it('should handle optional fields when missing', () => {
      const minimalApi: BoxApiResponse = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        box_id: '10122',
        subdomain: 'mybox',
        name: 'My Box',
        base_url: 'https://mybox.aimharder.com',
        created_at: '2025-01-01T10:00:00.000Z',
        updated_at: '2025-01-15T12:30:00.000Z',
      };

      const result = BoxMapper.toDomain(minimalApi);

      expect(result.phone).toBeUndefined();
      expect(result.email).toBeUndefined();
      expect(result.address).toBeUndefined();
      expect(result.website).toBeUndefined();
      expect(result.logoUrl).toBeUndefined();
    });

    it('should preserve all required fields', () => {
      const result = BoxMapper.toDomain(mockBoxApi);

      expect(result.id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(result.boxId).toBe('10122');
      expect(result.subdomain).toBe('crossfitcerdanyola');
      expect(result.name).toBe('CrossFit Cerdanyola');
      expect(result.baseUrl).toBe('https://crossfitcerdanyola.aimharder.com');
    });
  });

  describe('toApi', () => {
    it('should convert domain box to API box', () => {
      const result = BoxMapper.toApi(mockBoxDomain);

      expect(result).toEqual(mockBoxApi);
    });

    it('should convert Date objects to ISO strings', () => {
      const result = BoxMapper.toApi(mockBoxDomain);

      expect(result.created_at).toBe('2025-01-01T10:00:00.000Z');
      expect(result.updated_at).toBe('2025-01-15T12:30:00.000Z');
      expect(typeof result.created_at).toBe('string');
      expect(typeof result.updated_at).toBe('string');
    });

    it('should handle optional fields when present', () => {
      const result = BoxMapper.toApi(mockBoxDomain);

      expect(result.phone).toBe('+34123456789');
      expect(result.email).toBe('info@crossfit.com');
      expect(result.address).toBe('123 Main St, Barcelona');
      expect(result.website).toBe('https://crossfit-external.com');
      expect(result.logo_url).toBe('https://cdn.example.com/logo.png');
    });

    it('should handle optional fields when missing', () => {
      const minimalDomain: Box = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        boxId: '10122',
        subdomain: 'mybox',
        name: 'My Box',
        baseUrl: 'https://mybox.aimharder.com',
        createdAt: new Date('2025-01-01T10:00:00.000Z'),
        updatedAt: new Date('2025-01-15T12:30:00.000Z'),
      };

      const result = BoxMapper.toApi(minimalDomain);

      expect(result.phone).toBeUndefined();
      expect(result.email).toBeUndefined();
      expect(result.address).toBeUndefined();
      expect(result.website).toBeUndefined();
      expect(result.logo_url).toBeUndefined();
    });

    it('should preserve all required fields', () => {
      const result = BoxMapper.toApi(mockBoxDomain);

      expect(result.id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(result.box_id).toBe('10122');
      expect(result.subdomain).toBe('crossfitcerdanyola');
      expect(result.name).toBe('CrossFit Cerdanyola');
      expect(result.base_url).toBe('https://crossfitcerdanyola.aimharder.com');
    });
  });

  describe('userBoxToDomain', () => {
    const mockUserBoxApi: UserBoxApiResponse = {
      id: '223e4567-e89b-12d3-a456-426614174001',
      user_email: 'user@example.com',
      box_id: '123e4567-e89b-12d3-a456-426614174000',
      last_accessed_at: '2025-01-15T14:00:00.000Z',
      detected_at: '2025-01-10T10:00:00.000Z',
      created_at: '2025-01-05T08:00:00.000Z',
      updated_at: '2025-01-15T14:00:00.000Z',
    };

    it('should convert API user box to domain user box', () => {
      const result = BoxMapper.userBoxToDomain(mockUserBoxApi);

      expect(result.id).toBe('223e4567-e89b-12d3-a456-426614174001');
      expect(result.userEmail).toBe('user@example.com');
      expect(result.boxId).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(result.lastAccessedAt).toBeInstanceOf(Date);
      expect(result.detectedAt).toBeInstanceOf(Date);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should convert timestamps to Date objects', () => {
      const result = BoxMapper.userBoxToDomain(mockUserBoxApi);

      expect(result.lastAccessedAt?.toISOString()).toBe('2025-01-15T14:00:00.000Z');
      expect(result.detectedAt.toISOString()).toBe('2025-01-10T10:00:00.000Z');
      expect(result.createdAt.toISOString()).toBe('2025-01-05T08:00:00.000Z');
      expect(result.updatedAt.toISOString()).toBe('2025-01-15T14:00:00.000Z');
    });

    it('should handle missing lastAccessedAt', () => {
      const apiWithoutLastAccess: UserBoxApiResponse = {
        ...mockUserBoxApi,
        last_accessed_at: undefined,
      };

      const result = BoxMapper.userBoxToDomain(apiWithoutLastAccess);

      expect(result.lastAccessedAt).toBeUndefined();
    });

    it('should preserve all required fields', () => {
      const result = BoxMapper.userBoxToDomain(mockUserBoxApi);

      expect(result.id).toBe('223e4567-e89b-12d3-a456-426614174001');
      expect(result.userEmail).toBe('user@example.com');
      expect(result.boxId).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(result.detectedAt).toBeInstanceOf(Date);
    });
  });

  describe('boxWithAccessToDomain', () => {
    const mockBoxWithAccessApi: BoxWithAccessApiResponse = {
      ...mockBoxApi,
      last_accessed_at: '2025-01-15T14:00:00.000Z',
    };

    it('should convert API box with access to domain box with access', () => {
      const result = BoxMapper.boxWithAccessToDomain(mockBoxWithAccessApi);

      expect(result.id).toBe(mockBoxDomain.id);
      expect(result.name).toBe(mockBoxDomain.name);
      expect(result.lastAccessedAt).toBeInstanceOf(Date);
      expect(result.lastAccessedAt?.toISOString()).toBe('2025-01-15T14:00:00.000Z');
    });

    it('should include all box fields', () => {
      const result = BoxMapper.boxWithAccessToDomain(mockBoxWithAccessApi);

      expect(result.boxId).toBe('10122');
      expect(result.subdomain).toBe('crossfitcerdanyola');
      expect(result.name).toBe('CrossFit Cerdanyola');
      expect(result.phone).toBe('+34123456789');
      expect(result.email).toBe('info@crossfit.com');
      expect(result.address).toBe('123 Main St, Barcelona');
      expect(result.website).toBe('https://crossfit-external.com');
      expect(result.logoUrl).toBe('https://cdn.example.com/logo.png');
      expect(result.baseUrl).toBe('https://crossfitcerdanyola.aimharder.com');
    });

    it('should handle missing lastAccessedAt', () => {
      const apiWithoutLastAccess: BoxWithAccessApiResponse = {
        ...mockBoxApi,
        last_accessed_at: undefined,
      };

      const result = BoxMapper.boxWithAccessToDomain(apiWithoutLastAccess);

      expect(result.lastAccessedAt).toBeUndefined();
    });

    it('should convert timestamps correctly', () => {
      const result = BoxMapper.boxWithAccessToDomain(mockBoxWithAccessApi);

      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
      expect(result.lastAccessedAt).toBeInstanceOf(Date);
    });
  });

  describe('boxWithAccessListToDomain', () => {
    const mockBoxWithAccessApi1: BoxWithAccessApiResponse = {
      ...mockBoxApi,
      id: '123e4567-e89b-12d3-a456-426614174000',
      last_accessed_at: '2025-01-15T14:00:00.000Z',
    };

    const mockBoxWithAccessApi2: BoxWithAccessApiResponse = {
      ...mockBoxApi,
      id: '223e4567-e89b-12d3-a456-426614174001',
      box_id: '10123',
      subdomain: 'anotherbox',
      name: 'Another Box',
      last_accessed_at: '2025-01-14T12:00:00.000Z',
    };

    it('should convert array of API boxes to domain boxes', () => {
      const result = BoxMapper.boxWithAccessListToDomain([
        mockBoxWithAccessApi1,
        mockBoxWithAccessApi2,
      ]);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(result[1].id).toBe('223e4567-e89b-12d3-a456-426614174001');
    });

    it('should convert all boxes correctly', () => {
      const result = BoxMapper.boxWithAccessListToDomain([
        mockBoxWithAccessApi1,
        mockBoxWithAccessApi2,
      ]);

      expect(result[0].name).toBe('CrossFit Cerdanyola');
      expect(result[0].lastAccessedAt?.toISOString()).toBe('2025-01-15T14:00:00.000Z');

      expect(result[1].name).toBe('Another Box');
      expect(result[1].lastAccessedAt?.toISOString()).toBe('2025-01-14T12:00:00.000Z');
    });

    it('should handle empty array', () => {
      const result = BoxMapper.boxWithAccessListToDomain([]);

      expect(result).toEqual([]);
    });

    it('should handle single box', () => {
      const result = BoxMapper.boxWithAccessListToDomain([mockBoxWithAccessApi1]);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should preserve order of boxes', () => {
      const result = BoxMapper.boxWithAccessListToDomain([
        mockBoxWithAccessApi1,
        mockBoxWithAccessApi2,
      ]);

      expect(result[0].subdomain).toBe('crossfitcerdanyola');
      expect(result[1].subdomain).toBe('anotherbox');
    });

    it('should handle boxes without lastAccessedAt', () => {
      const apiWithoutLastAccess: BoxWithAccessApiResponse = {
        ...mockBoxApi,
        last_accessed_at: undefined,
      };

      const result = BoxMapper.boxWithAccessListToDomain([apiWithoutLastAccess]);

      expect(result[0].lastAccessedAt).toBeUndefined();
    });

    it('should convert all Date fields correctly', () => {
      const result = BoxMapper.boxWithAccessListToDomain([
        mockBoxWithAccessApi1,
        mockBoxWithAccessApi2,
      ]);

      result.forEach((box) => {
        expect(box.createdAt).toBeInstanceOf(Date);
        expect(box.updatedAt).toBeInstanceOf(Date);
        if (box.lastAccessedAt) {
          expect(box.lastAccessedAt).toBeInstanceOf(Date);
        }
      });
    });
  });
});
