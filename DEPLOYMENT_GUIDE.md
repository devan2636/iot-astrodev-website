# Deployment Guide - Device Status Monitoring

Panduan lengkap untuk deploy dan test sistem device status monitoring.

## 1. Setup Database (Migrasi Tabel)

### Opsi A: Via Supabase Dashboard
1. Buka [Supabase Dashboard](https://supabase.com/dashboard)
2. Pilih project Anda
3. Klik **SQL Editor** di sidebar kiri
4. Klik **New Query**
5. Copy-paste isi file `supabase/migrations/create_device_status_table.sql`:

```sql
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
```

6. Klik **Run** untuk execute query

### Opsi B: Via Supabase CLI
```bash
# Install Supabase CLI jika belum ada
npm install -g supabase

# Login ke Supabase
supabase login

# Link project (ganti dengan project ID Anda)
supabase link --project-ref YOUR_PROJECT_ID

# Apply migration
supabase db push
```

## 2. Deploy MQTT Data Handler Function

### Opsi A: Via Supabase Dashboard
1. Buka **Edge Functions** di Supabase Dashboard
2. Klik **Create Function**
3. Nama function: `mqtt-data-handler`
4. Copy-paste isi file `supabase/functions/mqtt-data-handler/index.ts`
5. Klik **Deploy Function**

### Opsi B: Via Supabase CLI
```bash
# Deploy function
supabase functions deploy mqtt-data-handler

# Verify deployment
supabase functions list
```

### Opsi C: Manual Upload
1. Zip folder `supabase/functions/mqtt-data-handler/`
2. Upload via Supabase Dashboard > Edge Functions
3. Set function name: `mqtt-data-handler`

## 3. Verify Deployment

### Test Database Table
```sql
-- Check if table exists
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'device_status';

-- Check table structure
\d device_status;
```

### Test MQTT Data Handler Function
```bash
# Test sensor data
curl -X POST 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/mqtt-data-handler' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "topic": "iot/devices/086e7e43-9a40-437e-8ffd-fc029aa86d9a/data",
    "payload": "{\"temperature\": 25.5, \"humidity\": 65.2, \"pressure\": 1013.2}"
  }'

# Test device status
curl -X POST 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/mqtt-data-handler' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "topic": "iot/devices/086e7e43-9a40-437e-8ffd-fc029aa86d9a/status",
    "payload": "{\"status\": \"online\", \"battery\": 85, \"wifi_rssi\": -65, \"uptime\": 3600, \"free_heap\": 123456, \"ota_update\": \"up_to_date\"}"
  }'
```

## 4. Environment Variables

Pastikan environment variables sudah diset di Supabase:

1. Buka **Settings** > **Environment Variables**
2. Pastikan ada:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

## 5. Setup MQTT Bridge

Karena MQTT broker tidak langsung terhubung ke Supabase, kita perlu bridge script:

### Setup Bridge Script
```bash
# Install dependencies
cd examples/mqtt-to-supabase
pip install -r requirements.txt

# Update konfigurasi di mqtt_bridge.py
# Ganti SUPABASE_URL dan SUPABASE_ANON_KEY dengan nilai yang benar
```

### Jalankan Bridge
```bash
# Terminal 1: Jalankan bridge
python mqtt_bridge.py

# Terminal 2: Generate test data
cd ../device-status-dummy
python mqtt_device_status.py
```

## 6. Test Script MQTT

```bash
# Install dependencies
cd examples/device-status-dummy
pip install -r requirements.txt

# Run test
python mqtt_device_status.py

# Pilih option 3 untuk test connection
# Jika berhasil, pilih option 2 untuk continuous testing
```

## 7. Monitoring & Debugging

### Check Function Logs
```bash
# Via CLI
supabase functions logs mqtt-data-handler

# Via Dashboard
# Supabase Dashboard > Edge Functions > mqtt-data-handler > Logs
```

### Check Bridge Logs
Bridge script akan menampilkan log real-time:
```
✅ Connected to MQTT Broker successfully
📡 Subscribed to MQTT topics
📨 Received: iot/devices/xxx/data -> {"temperature": 25.5}
✅ Data sent to Supabase successfully
```

### Check Database Data
```sql
-- Check device status data
SELECT * FROM device_status ORDER BY created_at DESC LIMIT 10;

-- Check sensor data
SELECT * FROM sensor_readings ORDER BY created_at DESC LIMIT 10;
```

## Troubleshooting

### Database Issues
- **Table not found**: Re-run migration SQL
- **Permission denied**: Check RLS policies
- **Foreign key error**: Pastikan device_id exists di tabel devices

### Function Issues
- **Function not found**: Re-deploy function
- **Timeout**: Check function logs
- **CORS error**: Function sudah include CORS headers

### MQTT Issues
- **Connection failed**: Check broker URL dan credentials
- **SSL error**: Pastikan menggunakan WSS (port 443)
- **Auth failed**: Verify username/password

## Next Steps

Setelah deployment berhasil:
1. Jalankan script testing untuk generate dummy data
2. Buka halaman Monitoring di aplikasi
3. Verify data muncul di grafik dan cards
4. Test export Excel functionality
