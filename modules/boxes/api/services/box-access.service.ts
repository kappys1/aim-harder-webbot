import { supabase } from '@/core/database/supabase';

export class BoxAccessService {
  /**
   * Validate if a user has access to a specific box
   */
  static async validateAccess(
    userEmail: string,
    boxId: string
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from('user_boxes')
      .select('id')
      .eq('user_email', userEmail)
      .eq('box_id', boxId)
      .single();

    if (error) {
      // PGRST116 = no rows returned
      if (error.code === 'PGRST116') {
        return false;
      }
      throw new Error(`Failed to validate access: ${error.message}`);
    }

    return !!data;
  }

  /**
   * Validate access and throw error if user doesn't have access
   */
  static async requireAccess(userEmail: string, boxId: string): Promise<void> {
    const hasAccess = await this.validateAccess(userEmail, boxId);

    if (!hasAccess) {
      throw new Error('User does not have access to this box');
    }
  }

  /**
   * Get all box IDs that a user has access to
   */
  static async getUserBoxIds(userEmail: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('user_boxes')
      .select('box_id')
      .eq('user_email', userEmail);

    if (error) {
      throw new Error(`Failed to fetch user box IDs: ${error.message}`);
    }

    return data?.map((item) => item.box_id) || [];
  }
}
