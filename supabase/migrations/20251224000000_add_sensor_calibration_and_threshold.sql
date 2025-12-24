-- Migration: Add calibration and threshold fields to sensors table
-- Description: Menambahkan field untuk kalibrasi sensor (y=ax+b) dan threshold untuk notifikasi/alarm

-- Add calibration fields
ALTER TABLE sensors 
ADD COLUMN IF NOT EXISTS calibration_a DECIMAL(10, 6) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS calibration_b DECIMAL(10, 6) DEFAULT 0.0;

-- Add threshold fields for notifications/alarms
ALTER TABLE sensors 
ADD COLUMN IF NOT EXISTS threshold_low DECIMAL(10, 3),
ADD COLUMN IF NOT EXISTS threshold_high DECIMAL(10, 3);

-- Add comments to explain the fields
COMMENT ON COLUMN sensors.calibration_a IS 'Koefisien (a) dalam persamaan kalibrasi y = ax + b, dimana y adalah output dan x adalah input sensor';
COMMENT ON COLUMN sensors.calibration_b IS 'Bias (b) dalam persamaan kalibrasi y = ax + b';
COMMENT ON COLUMN sensors.threshold_low IS 'Batas bawah untuk trigger notifikasi/alarm ketika nilai sensor < threshold_low';
COMMENT ON COLUMN sensors.threshold_high IS 'Batas atas untuk trigger notifikasi/alarm ketika nilai sensor > threshold_high';

-- Create index for threshold queries (optional, for performance)
CREATE INDEX IF NOT EXISTS idx_sensors_threshold ON sensors(threshold_low, threshold_high) 
WHERE threshold_low IS NOT NULL OR threshold_high IS NOT NULL;
