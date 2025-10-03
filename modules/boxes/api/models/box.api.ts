export interface BoxApiResponse {
  id: string;
  box_id: string;
  subdomain: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  logo_url?: string;
  base_url: string;
  created_at: string;
  updated_at: string;
}

export interface UserBoxApiResponse {
  id: string;
  user_email: string;
  box_id: string;
  last_accessed_at?: string;
  detected_at: string;
  created_at: string;
  updated_at: string;
}

export interface BoxWithAccessApiResponse extends BoxApiResponse {
  last_accessed_at?: string;
}

export interface DetectBoxesRequest {
  userEmail: string;
  aimharderToken: string;
  cookies: Array<{ name: string; value: string }>;
}

export interface DetectBoxesResponse {
  boxes: BoxWithAccessApiResponse[];
  newBoxesCount: number;
}

export interface ValidateAccessRequest {
  userEmail: string;
  boxId: string;
}

export interface ValidateAccessResponse {
  hasAccess: boolean;
}
