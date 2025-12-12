-- Fix RLS policies for device_status table
-- Drop existing policies
drop policy if exists "Allow authenticated users to read device status" on device_status;
drop policy if exists "Allow service role to insert device status" on device_status;
drop policy if exists "Allow service role to update device status" on device_status;

-- Create new policies that allow both service_role and authenticated users
create policy "Allow service role and authenticated users to read device status" on device_status
  for select using (
    auth.role() = 'service_role' OR 
    auth.role() = 'authenticated'
  );

create policy "Allow service role and authenticated users to insert device status" on device_status
  for insert with check (
    auth.role() = 'service_role' OR 
    auth.role() = 'authenticated'
  );

create policy "Allow service role and authenticated users to update device status" on device_status
  for update using (
    auth.role() = 'service_role' OR 
    auth.role() = 'authenticated'
  );

-- Also allow delete for service role
create policy "Allow service role to delete device status" on device_status
  for delete using (auth.role() = 'service_role');
