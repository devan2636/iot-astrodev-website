-- Create a function to get latest device status
create or replace function get_latest_device_status()
returns table (
  device_id uuid,
  status text,
  battery integer,
  wifi_rssi integer,
  uptime integer,
  free_heap integer,
  ota_update text,
  timestamp timestamptz
)
language sql
security definer
as $$
  with latest_status as (
    select distinct on (device_id)
      device_id,
      status,
      battery,
      wifi_rssi,
      uptime,
      free_heap,
      ota_update,
      timestamp
    from device_status
    order by device_id, timestamp desc
  )
  select * from latest_status;
$$;

-- Grant execute permission to authenticated users
grant execute on function get_latest_device_status to authenticated;
