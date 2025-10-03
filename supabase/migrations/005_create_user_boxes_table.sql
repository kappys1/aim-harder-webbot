-- Create user_boxes table for many-to-many relationship between users and boxes
CREATE TABLE IF NOT EXISTS user_boxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL REFERENCES auth_sessions(user_email) ON DELETE CASCADE,
  box_id UUID NOT NULL REFERENCES boxes(id) ON DELETE CASCADE,
  last_accessed_at TIMESTAMPTZ,             -- Last time user accessed this box
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_email, box_id)                -- One relationship per user-box pair
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_boxes_user_email ON user_boxes(user_email);
CREATE INDEX IF NOT EXISTS idx_user_boxes_box_id ON user_boxes(box_id);
CREATE INDEX IF NOT EXISTS idx_user_boxes_last_accessed ON user_boxes(last_accessed_at DESC);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_user_boxes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_boxes_updated_at_trigger
  BEFORE UPDATE ON user_boxes
  FOR EACH ROW
  EXECUTE FUNCTION update_user_boxes_updated_at();
