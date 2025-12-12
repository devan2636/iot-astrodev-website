-- Create device_status table
create table device_status (
  id uuid default uuid_generate_v4() primary key,
  device_id uuid references devices(id),
  status text,
  battery integer,
  wifi_rssi integer,
  uptime integer,
  free_heap integer,
  ota_update text,
  timestamp timestamptz default now(),
  created_at timestamptz default now()
);

-- Create index for better query performance
create index device_status_device_id_timestamp_idx on device_status(device_id, timestamp);

-- Add RLS (Row Level Security) policies
alter table device_status enable row level security;

-- Policy to allow authenticated users to read device status
create policy "Allow authenticated users to read device status" on device_status
  for select using (auth.role() = 'authenticated');

-- Policy to allow service role to insert device status
create policy "Allow service role to insert device status" on device_status
  for insert with check (auth.role() = 'service_role');

-- Policy to allow service role to update device status
create policy "Allow service role to update device status" on device_status
  for update using (auth.role() = 'service_role');
