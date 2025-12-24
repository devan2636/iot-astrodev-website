-- Backfill default per-device thresholds where NULL
update public.devices
set battery_low_threshold_percent = 20
where battery_low_threshold_percent is null;

update public.devices
set wifi_rssi_weak_threshold_dbm = -85
where wifi_rssi_weak_threshold_dbm is null;