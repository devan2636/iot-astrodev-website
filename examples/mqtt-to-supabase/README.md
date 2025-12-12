# MQTT to Supabase Bridge

Script Python yang mendengarkan data MQTT dan mengirimkannya ke Supabase Edge Function untuk disimpan ke database.

## Setup

1. **Install dependencies:**
```bash
pip install -r requirements.txt
```

2. **Deploy Edge Function ke Supabase:**
   - Copy folder `supabase/functions/mqtt-data-handler/` ke project Supabase Anda
   - Deploy via Supabase CLI:
   ```bash
   supabase functions deploy mqtt-data-handler
   ```
   - Atau upload manual via Supabase Dashboard > Edge Functions

3. **Update konfigurasi di `mqtt_bridge.py`:**
```python
# Ganti dengan URL dan Key Supabase Anda
SUPABASE_URL = "https://your-project-id.supabase.co"
SUPABASE_ANON_KEY = "your-anon-key"
```

## Cara Menjalankan

```bash
python mqtt_bridge.py
```

## Cara Kerja

1. **Connect ke MQTT Broker** (mqtt.astrodev.cloud:443)
2. **Subscribe ke topics:**
   - `iot/devices/+/data` (sensor data)
   - `iot/devices/+/status` (device status)
3. **Forward data** ke Supabase Edge Function
4. **Edge Function** menyimpan data ke database:
   - Sensor data → tabel `sensor_readings`
   - Device status → tabel `device_status`

## Testing

1. **Jalankan bridge:**
```bash
python mqtt_bridge.py
```

2. **Jalankan data generator** (di terminal lain):
```bash
cd ../device-status-dummy
python mqtt_device_status.py
```

3. **Cek database** di Supabase Dashboard:
```sql
-- Check sensor data
SELECT * FROM sensor_readings ORDER BY created_at DESC LIMIT 10;

-- Check device status
SELECT * FROM device_status ORDER BY created_at DESC LIMIT 10;
```

## Troubleshooting

### Bridge Connection Issues
- **MQTT connection failed**: Check broker URL dan credentials
- **Supabase connection failed**: Check URL dan Anon Key
- **Edge Function not found**: Deploy function terlebih dahulu

### Data Not Saving
- **Check Edge Function logs** di Supabase Dashboard
- **Verify table exists**: `device_status` dan `sensor_readings`
- **Check RLS policies**: Pastikan service role bisa insert

### Performance
- Bridge ini untuk testing/development
- Untuk production, gunakan MQTT broker yang langsung integrate dengan Supabase
- Atau deploy bridge ini sebagai serverless function

## Architecture

```
MQTT Devices → MQTT Broker → Python Bridge → Supabase Edge Function → Database
```

Alternatif untuk production:
```
MQTT Devices → MQTT Broker → Webhook → Supabase Edge Function → Database
