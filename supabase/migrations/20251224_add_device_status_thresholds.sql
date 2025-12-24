-- Add per-device status thresholds for battery and WiFi RSSI
alter table public.devices
  add column if not exists battery_low_threshold_percent integer;

alter table public.devices
  add column if not exists wifi_rssi_weak_threshold_dbm integer;

-- Optional defaults; commented to avoid rewriting existing rows blindly
-- update public.devices set battery_low_threshold_percent = 20 where battery_low_threshold_percent is null;
-- update public.devices set wifi_rssi_weak_threshold_dbm = -85 where wifi_rssi_weak_threshold_dbm is null;

-- Indexes for potential filtering/use
create index if not exists devices_battery_threshold_idx on public.devices (battery_low_threshold_percent);
create index if not exists devices_wifi_rssi_threshold_idx on public.devices (wifi_rssi_weak_threshold_dbm);
