import type {
  DetectBoxesRequest,
  DetectBoxesResponse,
  BoxWithAccessApiResponse,
} from '../api/models/box.api';
import { BoxMapper } from '../api/mappers/box.mapper';
import type { BoxWithAccess } from '../models/box.model';

export class BoxManagementBusiness {
  /**
   * Detect and store user boxes
   */
  static async detectBoxes(
    request: DetectBoxesRequest
  ): Promise<{ boxes: BoxWithAccess[]; newBoxesCount: number }> {
    const response = await fetch('/api/boxes/detect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error('Failed to detect boxes');
    }

    const data: DetectBoxesResponse = await response.json();

    return {
      boxes: BoxMapper.boxWithAccessListToDomain(data.boxes),
      newBoxesCount: data.newBoxesCount,
    };
  }

  /**
   * Get all user boxes
   */
  static async getUserBoxes(userEmail: string): Promise<BoxWithAccess[]> {
    const response = await fetch(`/api/boxes?userEmail=${userEmail}`);

    if (!response.ok) {
      throw new Error('Failed to fetch user boxes');
    }

    const data: { boxes: BoxWithAccessApiResponse[] } = await response.json();

    return BoxMapper.boxWithAccessListToDomain(data.boxes);
  }

  /**
   * Get a specific box by ID
   */
  static async getBoxById(
    boxId: string,
    userEmail: string
  ): Promise<BoxWithAccess | null> {
    const response = await fetch(`/api/boxes/${boxId}?userEmail=${userEmail}`);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error('Failed to fetch box');
    }

    const data: { box: BoxWithAccessApiResponse } = await response.json();

    return BoxMapper.boxWithAccessToDomain(data.box);
  }

  /**
   * Update last accessed timestamp
   */
  static async updateLastAccessed(
    boxId: string,
    userEmail: string
  ): Promise<void> {
    const response = await fetch(`/api/boxes/${boxId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userEmail }),
    });

    if (!response.ok) {
      throw new Error('Failed to update last accessed');
    }
  }

  /**
   * Validate user access to a box
   */
  static async validateAccess(
    boxId: string,
    userEmail: string
  ): Promise<boolean> {
    const response = await fetch(
      `/api/boxes/${boxId}/validate-access?userEmail=${userEmail}`
    );

    if (!response.ok) {
      return false;
    }

    const data: { hasAccess: boolean } = await response.json();

    return data.hasAccess;
  }
}
