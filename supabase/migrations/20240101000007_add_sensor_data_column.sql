-- Add sensor_data column to device_status table
ALTER TABLE device_status 
ADD COLUMN sensor_data jsonb;

-- Add index for better query performance on sensor_data
CREATE INDEX device_status_sensor_data_idx ON device_status USING gin(sensor_data);

-- Add comment to describe the column
COMMENT ON COLUMN device_status.sensor_data IS 'JSON object containing sensor readings like temperature, humidity, pressure, etc.';
