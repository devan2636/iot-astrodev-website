-- Create webhook for MQTT data handler
create or replace function handle_mqtt_message()
returns trigger as $$
begin
  perform net.http_post(
    url := current_setting('app.mqtt_handler_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.mqtt_handler_key')
    ),
    body := jsonb_build_object(
      'topic', NEW.topic,
      'payload', NEW.payload
    )
  );
  return NEW;
end;
$$ language plpgsql security definer;

-- Create table for MQTT messages
create table if not exists mqtt_messages (
  id uuid default uuid_generate_v4() primary key,
  topic text not null,
  payload jsonb not null,
  created_at timestamptz default now()
);

-- Create trigger to handle MQTT messages
create trigger on_mqtt_message_insert
  after insert on mqtt_messages
  for each row
  execute function handle_mqtt_message();

-- Add RLS policies
alter table mqtt_messages enable row level security;

-- Allow service role to insert messages
create policy "Allow service role to insert messages"
  on mqtt_messages for insert
  with check (auth.role() = 'service_role');

-- Allow authenticated users to read messages
create policy "Allow authenticated users to read messages"
  on mqtt_messages for select
  using (auth.role() = 'authenticated');

-- Add configuration for MQTT handler URL and key
comment on database postgres is E'@app.mqtt_handler_url https://your-project-ref.functions.supabase.co/mqtt-data-handler\n@app.mqtt_handler_key your-service-role-key';
