-- Create public_device_access table
CREATE TABLE
IF NOT EXISTS public_device_access
(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid
(),
  device_id UUID NOT NULL REFERENCES devices
(id) ON
DELETE CASCADE,
  is_public BOOLEAN
DEFAULT true,
  created_at TIMESTAMP
WITH TIME ZONE DEFAULT now
(),
  updated_at TIMESTAMP
WITH TIME ZONE DEFAULT now
(),
  UNIQUE
(device_id)
);

-- Create index for faster lookups
CREATE INDEX idx_public_device_access_device_id ON public_device_access(device_id);
CREATE INDEX idx_public_device_access_is_public ON public_device_access(is_public);

-- Enable RLS
ALTER TABLE public_device_access ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read public access settings
CREATE POLICY "Allow authenticated users to read public access settings"
  ON public_device_access
  FOR
SELECT
    TO authenticated
USING
(true);

-- Policy: Allow superadmin to manage public access
CREATE POLICY "Allow superadmin to manage public access"
  ON public_device_access
  FOR ALL
  TO authenticated
  USING
(
    EXISTS
(
      SELECT 1
FROM profiles
WHERE profiles.id = auth.uid()
    AND profiles.role = 'superadmin'
    )
)
  WITH CHECK
(
    EXISTS
(
      SELECT 1
FROM profiles
WHERE profiles.id = auth.uid()
    AND profiles.role = 'superadmin'
    )
);

-- Policy: Allow admin to manage public access
CREATE POLICY "Allow admin to manage public access"
  ON public_device_access
  FOR ALL
  TO authenticated
  USING
(
    EXISTS
(
      SELECT 1
FROM profiles
WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
    )
)
  WITH CHECK
(
    EXISTS
(
      SELECT 1
FROM profiles
WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
    )
);

-- Policy: Allow anon to read public devices
CREATE POLICY "Allow anon to read public devices"
  ON public_device_access
  FOR
SELECT
    TO anon
USING
(is_public = true);
