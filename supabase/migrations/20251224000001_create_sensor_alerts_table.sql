-- Migration: Create sensor_alerts table for logging threshold alerts
-- Description: Tabel untuk menyimpan log alert/notifikasi dari sensor yang melewati threshold

-- Create sensor_alerts table
CREATE TABLE IF NOT EXISTS sensor_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sensor_id UUID NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  alert_type VARCHAR(10) NOT NULL CHECK (alert_type IN ('low', 'high')),
  value DECIMAL(10, 3) NOT NULL,
  threshold_value DECIMAL(10, 3) NOT NULL,
  message TEXT,
  is_acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  acknowledged_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sensor_alerts_sensor_id ON sensor_alerts(sensor_id);
CREATE INDEX IF NOT EXISTS idx_sensor_alerts_device_id ON sensor_alerts(device_id);
CREATE INDEX IF NOT EXISTS idx_sensor_alerts_created_at ON sensor_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sensor_alerts_acknowledged ON sensor_alerts(is_acknowledged) WHERE is_acknowledged = FALSE;

-- Add RLS (Row Level Security)
ALTER TABLE sensor_alerts ENABLE ROW LEVEL SECURITY;

-- Policy for superadmin and admin to see all alerts
CREATE POLICY "Superadmin and Admin can view all alerts"
  ON sensor_alerts FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('superadmin', 'admin')
    )
  );

-- Policy for users to see alerts from devices they have access to
CREATE POLICY "Users can view alerts from their accessible devices"
  ON sensor_alerts FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('superadmin', 'admin')
    )
    OR
    device_id IN (
      SELECT device_id FROM user_device_access WHERE user_id = auth.uid()
    )
  );

-- Policy for superadmin and admin to acknowledge alerts
CREATE POLICY "Superadmin and Admin can acknowledge alerts"
  ON sensor_alerts FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('superadmin', 'admin')
    )
  );

-- Add comments
COMMENT ON TABLE sensor_alerts IS 'Log dari alert/notifikasi sensor yang melewati threshold';
COMMENT ON COLUMN sensor_alerts.alert_type IS 'Tipe alert: low (nilai di bawah threshold_low) atau high (nilai di atas threshold_high)';
COMMENT ON COLUMN sensor_alerts.value IS 'Nilai sensor saat alert terjadi';
COMMENT ON COLUMN sensor_alerts.threshold_value IS 'Nilai threshold yang terlewati';
COMMENT ON COLUMN sensor_alerts.is_acknowledged IS 'Apakah alert sudah di-acknowledge oleh user';
COMMENT ON COLUMN sensor_alerts.acknowledged_by IS 'User yang acknowledge alert';

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sensor_alerts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_sensor_alerts_updated_at_trigger
  BEFORE UPDATE ON sensor_alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_sensor_alerts_updated_at();
