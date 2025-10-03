-- Create boxes table to store box information
CREATE TABLE IF NOT EXISTS boxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id TEXT UNIQUE NOT NULL,              -- Aimharder box ID (e.g., "10122")
  subdomain TEXT UNIQUE NOT NULL,            -- e.g., "crossfitcerdanyola300"
  name TEXT NOT NULL,                        -- e.g., "CrossFit Cerdanyola"
  phone TEXT,
  email TEXT,
  address TEXT,
  website TEXT,
  logo_url TEXT,
  base_url TEXT NOT NULL,                    -- e.g., "https://crossfitcerdanyola300.aimharder.com"
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_boxes_box_id ON boxes(box_id);
CREATE INDEX IF NOT EXISTS idx_boxes_subdomain ON boxes(subdomain);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_boxes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER boxes_updated_at_trigger
  BEFORE UPDATE ON boxes
  FOR EACH ROW
  EXECUTE FUNCTION update_boxes_updated_at();
