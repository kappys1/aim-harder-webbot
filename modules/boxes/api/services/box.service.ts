import { supabase } from '@/core/database/supabase';
import type { DetectedBoxInfo, BoxWithAccess } from '../../models/box.model';
import { BoxUrlUtils } from '../../utils/url.utils';
import type {
  BoxApiResponse,
  BoxWithAccessApiResponse,
} from '../models/box.api';

export class BoxService {
  /**
   * Create or update box in database
   * If box with same boxId exists, return existing box
   */
  static async upsertBox(boxInfo: DetectedBoxInfo): Promise<BoxApiResponse> {
    const baseUrl = BoxUrlUtils.buildBaseUrl(boxInfo.subdomain);

    // Check if box already exists
    const { data: existingBox } = await supabase
      .from('boxes')
      .select('*')
      .eq('box_id', boxInfo.boxId)
      .single();

    if (existingBox) {
      return existingBox as BoxApiResponse;
    }

    // Insert new box
    const { data, error } = await supabase
      .from('boxes')
      .insert({
        box_id: boxInfo.boxId,
        subdomain: boxInfo.subdomain,
        name: boxInfo.name,
        phone: boxInfo.phone,
        email: boxInfo.email,
        address: boxInfo.address,
        website: boxInfo.website,
        logo_url: boxInfo.logoUrl,
        base_url: baseUrl,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create box: ${error.message}`);
    }

    return data as BoxApiResponse;
  }

  /**
   * Link user to box (create user_boxes relationship)
   */
  static async linkUserToBox(userEmail: string, boxId: string): Promise<void> {
    const { error } = await supabase.from('user_boxes').insert({
      user_email: userEmail,
      box_id: boxId,
      detected_at: new Date().toISOString(),
    });

    // Ignore unique constraint violations (user already linked)
    if (error && !error.message.includes('duplicate key')) {
      throw new Error(`Failed to link user to box: ${error.message}`);
    }
  }

  /**
   * Get all boxes for a user (with access info)
   */
  static async getUserBoxes(userEmail: string): Promise<BoxWithAccessApiResponse[]> {
    const { data, error } = await supabase
      .from('user_boxes')
      .select(
        `
        last_accessed_at,
        boxes (
          id,
          box_id,
          subdomain,
          name,
          phone,
          email,
          address,
          website,
          logo_url,
          base_url,
          created_at,
          updated_at
        )
      `
      )
      .eq('user_email', userEmail)
      .order('last_accessed_at', { ascending: false, nullsFirst: false });

    if (error) {
      throw new Error(`Failed to fetch user boxes: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    // Transform joined data into BoxWithAccessApiResponse
    return data.map((item: any) => ({
      ...(item.boxes as BoxApiResponse),
      last_accessed_at: item.last_accessed_at,
    }));
  }

  /**
   * Get a specific box by ID
   */
  static async getBoxById(boxId: string): Promise<BoxApiResponse | null> {
    const { data, error } = await supabase
      .from('boxes')
      .select('*')
      .eq('id', boxId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch box: ${error.message}`);
    }

    return data as BoxApiResponse;
  }

  /**
   * Update last accessed timestamp for a user-box relationship
   */
  static async updateLastAccessed(
    userEmail: string,
    boxId: string
  ): Promise<void> {
    const { error } = await supabase
      .from('user_boxes')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('user_email', userEmail)
      .eq('box_id', boxId);

    if (error) {
      throw new Error(`Failed to update last accessed: ${error.message}`);
    }
  }

  /**
   * Get user's default box (last accessed or first box)
   */
  static async getUserDefaultBox(
    userEmail: string
  ): Promise<BoxWithAccessApiResponse | null> {
    const boxes = await this.getUserBoxes(userEmail);

    if (boxes.length === 0) {
      return null;
    }

    // Return first box (already sorted by last_accessed_at DESC)
    return boxes[0];
  }
}
