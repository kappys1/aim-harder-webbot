export interface Box {
  id: string;
  boxId: string;
  subdomain: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  logoUrl?: string;
  baseUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserBox {
  id: string;
  userEmail: string;
  boxId: string;
  lastAccessedAt?: Date;
  detectedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface BoxWithAccess extends Box {
  lastAccessedAt?: Date;
}

export interface DetectedBoxInfo {
  subdomain: string;
  name: string;
  boxId: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  logoUrl?: string;
}
