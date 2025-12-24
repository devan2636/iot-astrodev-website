# Deployment Guide: Sensor Calibration & Threshold Features

## Panduan Deploy Fitur Kalibrasi Sensor dan Threshold Notifikasi

### 🎯 Fitur yang Ditambahkan

1. **Kalibrasi Sensor** (y = ax + b)

   - Edit nilai koefisien (a) dan bias (b)
   - Preview hasil kalibrasi real-time
   - Apply kalibrasi otomatis pada data sensor baru

2. **Threshold Notifikasi/Alarm**

   - Set threshold low (batas minimum)
   - Set threshold high (batas maksimum)
   - Notifikasi otomatis ke Telegram saat threshold terlewati
   - Log alert tersimpan di database

3. **Edit Min/Max Value**
   - Update batas nilai minimum dan maksimum sensor
   - Validasi range nilai sensor

---

## 📋 Prerequisites

- Akses ke Supabase Dashboard
- Supabase CLI (opsional, untuk deployment otomatis)
- File migration sudah dibuat:
  - `20251224000000_add_sensor_calibration_and_threshold.sql`
  - `20251224000001_create_sensor_alerts_table.sql`

---

## 🚀 Deployment Steps

### Step 1: Deploy Database Migration

#### Option A: Menggunakan Supabase Dashboard (Recommended)

1. Buka [Supabase Dashboard](https://app.supabase.com)
2. Pilih project Anda
3. Navigasi ke **SQL Editor** (ikon database di sidebar)
4. Klik **New query**

5. **Migration 1**: Copy paste isi dari file:
   ```
   supabase/migrations/20251224000000_add_sensor_calibration_and_threshold.sql
   ```
6. Klik **Run** untuk execute
7. Verify: Cek tabel `sensors` sekarang memiliki kolom baru:

   - `calibration_a`
   - `calibration_b`
   - `threshold_low`
   - `threshold_high`

8. **Migration 2**: Buat query baru, copy paste isi dari file:
   ```
   supabase/migrations/20251224000001_create_sensor_alerts_table.sql
   ```
9. Klik **Run** untuk execute
10. Verify: Cek tabel baru `sensor_alerts` sudah terbuat

#### Option B: Menggunakan Supabase CLI

```bash
# Pastikan Supabase CLI sudah terinstall
npm install -g supabase

# Login ke Supabase
supabase login

# Link project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push

# Verify
supabase db diff
```

---

### Step 2: Deploy Edge Functions

#### Deploy Function: apply-sensor-calibration

```bash
cd supabase/functions

# Deploy function
supabase functions deploy apply-sensor-calibration

# Test function
curl -X POST https://your-project.supabase.co/functions/v1/apply-sensor-calibration \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sensorId": "test-sensor-uuid",
    "rawValue": 25.5
  }'
```

#### Deploy Function: check-sensor-threshold

```bash
# Deploy function
supabase functions deploy check-sensor-threshold

# Test function
curl -X POST https://your-project.supabase.co/functions/v1/check-sensor-threshold \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sensorId": "test-sensor-uuid",
    "value": 100
  }'
```

---

### Step 3: Update Frontend

Frontend sudah diupdate di file `src/components/Sensors.tsx` dengan:

- ✅ Dialog Edit Sensor
- ✅ Form untuk kalibrasi (a, b)
- ✅ Form untuk threshold (low, high)
- ✅ Preview hasil kalibrasi
- ✅ Tombol Edit pada setiap sensor

**Build dan deploy frontend:**

```bash
# Build
npm run build

# Preview build
npm run preview

# Deploy (sesuaikan dengan hosting Anda)
# Contoh untuk Vercel:
vercel --prod

# Atau untuk Netlify:
netlify deploy --prod
```

---

### Step 4: Update MQTT Handler (Backend Integration)

Update file yang handle MQTT data untuk mengapply kalibrasi dan check threshold.

**Contoh lokasi**: `supabase/functions/mqtt-handler/index.ts` atau sejenisnya

Tambahkan logic setelah menerima data sensor:

```typescript
// Setelah menerima data dari MQTT
const rawValue = parseFloat(sensorData.value);

// 1. Apply calibration
const { data: calibrated } = await supabase.functions.invoke(
  "apply-sensor-calibration",
  {
    body: {
      sensorId: sensor.id,
      rawValue: rawValue,
    },
  }
);

const calibratedValue = calibrated.calibratedValue;

// 2. Save to database (with both raw and calibrated)
await supabase.from("sensor_data").insert({
  sensor_id: sensor.id,
  value: calibratedValue,
  raw_value: rawValue,
  timestamp: new Date().toISOString(),
});

// 3. Check threshold
await supabase.functions.invoke("check-sensor-threshold", {
  body: {
    sensorId: sensor.id,
    value: calibratedValue,
  },
});
```

---

## 🧪 Testing

### Test 1: UI Edit Sensor

1. Login ke aplikasi sebagai admin
2. Navigate ke halaman **Sensors**
3. Klik tombol **Edit** (icon pensil) pada salah satu sensor
4. Dialog edit akan muncul dengan form:
   - Min Value & Max Value
   - Calibration A & B (dengan preview)
   - Threshold Low & High
5. Ubah nilai dan klik **Update Sensor**
6. Verify: Data tersimpan di database

### Test 2: Kalibrasi Berfungsi

1. Set kalibrasi pada sensor, contoh:

   - calibration_a = 1.5
   - calibration_b = -2

2. Kirim data sensor (raw value = 10) via MQTT
3. Check database `sensor_data`:
   - raw_value harus = 10
   - value (calibrated) harus = (1.5 × 10) - 2 = 13

### Test 3: Threshold Alert

1. Set threshold pada sensor, contoh:

   - threshold_low = 5
   - threshold_high = 30

2. Kirim data sensor dengan value = 3 (di bawah threshold_low)
3. Verify:

   - Notifikasi Telegram terkirim
   - Alert tersimpan di tabel `sensor_alerts`

4. Kirim data sensor dengan value = 35 (di atas threshold_high)
5. Verify:
   - Notifikasi Telegram terkirim
   - Alert tersimpan di tabel `sensor_alerts`

### Test 4: Check Database

```sql
-- Check sensors with calibration
SELECT id, name, calibration_a, calibration_b, threshold_low, threshold_high
FROM sensors
WHERE calibration_a IS NOT NULL OR threshold_low IS NOT NULL;

-- Check recent alerts
SELECT
  sa.*,
  s.name as sensor_name,
  d.name as device_name
FROM sensor_alerts sa
JOIN sensors s ON sa.sensor_id = s.id
JOIN devices d ON sa.device_id = d.id
ORDER BY sa.created_at DESC
LIMIT 10;

-- Check sensor data with calibration
SELECT
  sd.id,
  s.name as sensor_name,
  sd.raw_value,
  sd.value as calibrated_value,
  sd.timestamp
FROM sensor_data sd
JOIN sensors s ON sd.sensor_id = s.id
ORDER BY sd.timestamp DESC
LIMIT 10;
```

---

## 📊 Monitoring & Troubleshooting

### Check Function Logs

```bash
# View logs for calibration function
supabase functions logs apply-sensor-calibration

# View logs for threshold function
supabase functions logs check-sensor-threshold
```

### Common Issues

#### Issue 1: Column does not exist

**Solution**: Migration belum dijalankan. Jalankan migration di Step 1.

#### Issue 2: Function not found

**Solution**: Function belum di-deploy. Deploy function di Step 2.

#### Issue 3: Telegram notification not sent

**Solution**:

- Check function `send-telegram-alert` sudah exist dan berfungsi
- Verify Telegram bot token dan chat ID sudah dikonfigurasi
- Check function logs untuk error detail

#### Issue 4: Calibration tidak apply

**Solution**:

- Verify MQTT handler sudah di-update dengan logic kalibrasi
- Check function logs untuk error
- Verify sensor memiliki nilai calibration_a dan calibration_b

---

## 🔒 Security Notes

- ✅ RLS (Row Level Security) sudah dikonfigurasi untuk tabel `sensor_alerts`
- ✅ Only admin/superadmin dapat edit sensor
- ✅ Users hanya bisa lihat alerts dari devices yang mereka akses
- ✅ Service role key hanya digunakan di backend functions

---

## 📝 Additional Notes

### Default Values

- `calibration_a`: Default = 1.0 (no scaling)
- `calibration_b`: Default = 0.0 (no offset)
- `threshold_low`: Default = NULL (tidak ada threshold)
- `threshold_high`: Default = NULL (tidak ada threshold)

### Data Storage

- **Raw value**: Disimpan di kolom `raw_value` (nilai asli dari sensor)
- **Calibrated value**: Disimpan di kolom `value` (nilai setelah kalibrasi)
- **Alert logs**: Disimpan di tabel `sensor_alerts`

### Performance Considerations

- Index sudah dibuat untuk query threshold
- Alert logs bisa di-archive secara periodik (rekomendasi: > 30 hari)
- Implement rate limiting untuk prevent spam notifikasi

---

## 📚 References

- [Sensor Calibration & Threshold Guide](./sensor-calibration-threshold-guide.md)
- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Telegram Bot API](https://core.telegram.org/bots/api)

---

## ✅ Checklist Deployment

- [ ] Database migrations executed successfully
- [ ] Edge functions deployed
- [ ] Frontend updated and deployed
- [ ] MQTT handler updated with calibration logic
- [ ] Telegram notification tested
- [ ] UI edit sensor tested
- [ ] Threshold alerts tested and logged
- [ ] Documentation updated

---

**Status**: ✅ Ready for Deployment

**Last Updated**: December 24, 2025

**Version**: 1.0.0
