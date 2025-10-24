import type { Box, UserBox, BoxWithAccess } from '../../models/box.model';
import type {
  BoxApiResponse,
  UserBoxApiResponse,
  BoxWithAccessApiResponse,
} from '../models/box.api';

export class BoxMapper {
  static toDomain(apiBox: BoxApiResponse): Box {
    return {
      id: apiBox.id,
      boxId: apiBox.box_id,
      subdomain: apiBox.subdomain,
      name: apiBox.name,
      phone: apiBox.phone,
      email: apiBox.email,
      address: apiBox.address,
      website: apiBox.website,
      logoUrl: apiBox.logo_url,
      baseUrl: apiBox.base_url,
      timezone: apiBox.timezone,
      createdAt: new Date(apiBox.created_at),
      updatedAt: new Date(apiBox.updated_at),
    };
  }

  static toApi(box: Box): BoxApiResponse {
    return {
      id: box.id,
      box_id: box.boxId,
      subdomain: box.subdomain,
      name: box.name,
      phone: box.phone,
      email: box.email,
      address: box.address,
      website: box.website,
      logo_url: box.logoUrl,
      base_url: box.baseUrl,
      timezone: box.timezone,
      created_at: box.createdAt.toISOString(),
      updated_at: box.updatedAt.toISOString(),
    };
  }

  static userBoxToDomain(apiUserBox: UserBoxApiResponse): UserBox {
    return {
      id: apiUserBox.id,
      userEmail: apiUserBox.user_email,
      boxId: apiUserBox.box_id,
      lastAccessedAt: apiUserBox.last_accessed_at
        ? new Date(apiUserBox.last_accessed_at)
        : undefined,
      detectedAt: new Date(apiUserBox.detected_at),
      createdAt: new Date(apiUserBox.created_at),
      updatedAt: new Date(apiUserBox.updated_at),
    };
  }

  static boxWithAccessToDomain(apiBox: BoxWithAccessApiResponse): BoxWithAccess {
    return {
      ...this.toDomain(apiBox),
      lastAccessedAt: apiBox.last_accessed_at
        ? new Date(apiBox.last_accessed_at)
        : undefined,
    };
  }

  static boxWithAccessListToDomain(
    apiBoxes: BoxWithAccessApiResponse[]
  ): BoxWithAccess[] {
    return apiBoxes.map((box) => this.boxWithAccessToDomain(box));
  }
}
