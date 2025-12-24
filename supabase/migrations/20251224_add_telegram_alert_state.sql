-- Create table to persist last alert state per device + sensor
create table
if not exists public.telegram_alert_state
(
  device_id uuid not null,
  sensor_key text not null,
  last_state text check
(last_state in
('normal','low','high')) default 'normal',
  last_value double precision,
  last_alert_at timestamptz,
  constraint telegram_alert_state_pk primary key
(device_id, sensor_key)
);

-- Helpful index for querying by device
create index
if not exists telegram_alert_state_device_idx on public.telegram_alert_state
(device_id);
