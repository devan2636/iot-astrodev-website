-- Add full access policy for device_status table similar to sensor_readings
ALTER POLICY "Allow service role to insert device status" ON "public"."device_status" RENAME TO "Allow service role to insert device status (old)";
ALTER POLICY "Allow service role to update device status" ON "public"."device_status" RENAME TO "Allow service role to update device status (old)";

-- Create new policy with full access like sensor_readings
CREATE POLICY "Allow full access to device_status" ON "public"."device_status"
AS PERMISSIVE FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- Drop old restrictive policies
DROP POLICY IF EXISTS "Allow service role to insert device status (old)" ON "public"."device_status";
DROP POLICY IF EXISTS "Allow service role to update device status (old)" ON "public"."device_status";
