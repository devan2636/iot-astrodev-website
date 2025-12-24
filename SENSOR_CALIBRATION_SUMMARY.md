# Summary: Fitur Kalibrasi Sensor dan Threshold Notifikasi

## ✅ Apa yang Sudah Dibuat

### 1. Frontend (UI)

**File**: `src/components/Sensors.tsx`

**Fitur yang ditambahkan**:

- ✅ Tombol **Edit** pada setiap sensor (icon pensil biru)
- ✅ Dialog Edit Sensor dengan form lengkap:
  - **Min Value** & **Max Value** - Batas nilai sensor
  - **Kalibrasi Sensor** (y = ax + b):
    - Koefisien (a) - Default: 1
    - Bias (b) - Default: 0
    - Preview perhitungan real-time
  - **Threshold Notifikasi**:
    - Threshold Low ⚠️ - Alarm jika nilai < threshold
    - Threshold High 🚨 - Alarm jika nilai > threshold
  - **Description** - Deskripsi sensor

**Screenshot Fitur**:

```
┌─────────────────────────────────────────┐
│ Edit Sensor: Temperature Sensor         │
├─────────────────────────────────────────┤
│ Min Value: [0]    Max Value: [100]      │
│                                          │
│ ┌─ Kalibrasi Sensor ──────────────────┐ │
│ │ Persamaan: y = ax + b                │ │
│ │ Koefisien (a): [1.0]  Bias (b): [0]  │ │
│ │ Contoh: x=10 → y = 1.0×10 + 0 = 10   │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ ┌─ Threshold Notifikasi ──────────────┐ │
│ │ ⚠️ Threshold Low:  [5]               │ │
│ │ 🚨 Threshold High: [40]              │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ [Update Sensor] [Cancel]                 │
└─────────────────────────────────────────┘
```

---

### 2. Database Migrations

**Files**:

- `supabase/migrations/20251224000000_add_sensor_calibration_and_threshold.sql`
- `supabase/migrations/20251224000001_create_sensor_alerts_table.sql`

**Tabel `sensors` - Kolom Baru**:
| Kolom | Tipe | Default | Deskripsi |
|-------|------|---------|-----------|
| `calibration_a` | DECIMAL(10,6) | 1.0 | Koefisien dalam y = ax + b |
| `calibration_b` | DECIMAL(10,6) | 0.0 | Bias dalam y = ax + b |
| `threshold_low` | DECIMAL(10,3) | NULL | Batas minimum untuk alarm |
| `threshold_high` | DECIMAL(10,3) | NULL | Batas maksimum untuk alarm |

**Tabel Baru `sensor_alerts`**:
Untuk menyimpan log alert/notifikasi sensor:

```sql
CREATE TABLE sensor_alerts (
  id UUID PRIMARY KEY,
  sensor_id UUID REFERENCES sensors(id),
  device_id UUID REFERENCES devices(id),
  alert_type VARCHAR(10), -- 'low' atau 'high'
  value DECIMAL(10,3),
  threshold_value DECIMAL(10,3),
  message TEXT,
  is_acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMP,
  acknowledged_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

### 3. Backend Edge Functions

#### Function 1: `apply-sensor-calibration`

**File**: `supabase/functions/apply-sensor-calibration/index.ts`

**Fungsi**: Apply kalibrasi y = ax + b pada raw value sensor

**Input**:

```json
{
  "sensorId": "uuid-sensor",
  "rawValue": 25.5
}
```

**Output**:

```json
{
  "success": true,
  "rawValue": 25.5,
  "calibratedValue": 23.5,
  "calibration": {
    "a": 1.0,
    "b": -2.0,
    "formula": "y = 1.0 × 25.5 + -2.0 = 23.5"
  }
}
```

#### Function 2: `check-sensor-threshold`

**File**: `supabase/functions/check-sensor-threshold/index.ts`

**Fungsi**: Check apakah nilai sensor melewati threshold dan kirim notifikasi

**Input**:

```json
{
  "sensorId": "uuid-sensor",
  "value": 45
}
```

**Output**:

```json
{
  "success": true,
  "alerts": [
    {
      "sensorId": "uuid",
      "sensorName": "Temperature Sensor",
      "deviceName": "Weather Station",
      "value": 45,
      "unit": "°C",
      "thresholdType": "high",
      "thresholdValue": 40,
      "message": "🚨 BAHAYA: Nilai sensor terlalu TINGGI! 45°C > 40°C"
    }
  ],
  "alertCount": 1,
  "status": "alert",
  "message": "1 threshold alert(s) triggered"
}
```

**Fitur**:

- ✅ Check threshold low dan high
- ✅ Kirim notifikasi ke Telegram
- ✅ Simpan log alert ke database
- ✅ Format message user-friendly

---

### 4. Dokumentasi

#### File 1: `docs/sensor-calibration-threshold-guide.md`

Dokumentasi lengkap tentang:

- Cara kerja kalibrasi
- Cara kerja threshold
- Contoh penggunaan
- Backend implementation guide
- Testing checklist

#### File 2: `docs/deployment-sensor-calibration.md`

Panduan deployment step-by-step:

- Deploy database migration
- Deploy edge functions
- Update frontend
- Testing procedures
- Troubleshooting guide

---

## 🎯 Cara Menggunakan (User Guide)

### Untuk Admin/Superadmin:

1. **Login** ke aplikasi
2. Navigate ke menu **Sensors**
3. Cari sensor yang ingin di-edit
4. Klik tombol **Edit** (icon pensil biru)
5. Isi form sesuai kebutuhan:
   - **Min/Max Value**: Range nilai sensor
   - **Kalibrasi**:
     - Set `a` = koefisien scaling
     - Set `b` = bias/offset
     - Lihat preview perhitungan
   - **Threshold**:
     - Set Low = batas minimum
     - Set High = batas maksimum
6. Klik **Update Sensor**
7. ✅ Done! Data tersimpan

---

## 🔧 Cara Deploy (Developer Guide)

### Step 1: Deploy Database

```bash
# Login ke Supabase Dashboard
# SQL Editor > New Query
# Copy paste isi migration files dan Run
```

Atau dengan CLI:

```bash
supabase db push
```

### Step 2: Deploy Edge Functions

```bash
supabase functions deploy apply-sensor-calibration
supabase functions deploy check-sensor-threshold
```

### Step 3: Update MQTT Handler

Tambahkan logic di MQTT handler untuk:

1. Apply kalibrasi saat data masuk
2. Check threshold setelah kalibrasi
3. Trigger notifikasi jika threshold terlewati

### Step 4: Deploy Frontend

```bash
npm run build
# Deploy ke hosting (Vercel/Netlify/dll)
```

---

## 📊 Contoh Use Case

### Use Case 1: Sensor Temperatur dengan Offset

**Problem**: Sensor selalu lebih tinggi 2°C dari seharusnya

**Solusi**:

- calibration_a = 1.0
- calibration_b = -2.0
- Input sensor: 27°C
- Output: 1.0 × 27 + (-2.0) = 25°C ✅

### Use Case 2: Water Level dengan Alarm

**Problem**: Perlu notifikasi jika air terlalu rendah atau tinggi

**Solusi**:

- threshold_low = 50 cm (air terlalu rendah)
- threshold_high = 400 cm (risiko banjir)
- Jika air < 50cm → Telegram alert ⚠️
- Jika air > 400cm → Telegram alert 🚨

### Use Case 3: Kalibrasi Linear Penuh

**Problem**: Sensor pressure perlu dikoreksi dengan faktor 0.98 dan offset -5

**Solusi**:

- calibration_a = 0.98
- calibration_b = -5
- Input: 1000 hPa
- Output: 0.98 × 1000 + (-5) = 975 hPa

---

## 🚀 Next Steps (Yang Perlu Anda Lakukan)

1. ✅ **Review Code**: Periksa semua file yang sudah dibuat
2. ✅ **Deploy Migration**: Jalankan SQL migration di Supabase
3. ✅ **Deploy Functions**: Deploy edge functions ke Supabase
4. ✅ **Update MQTT Handler**: Integrate kalibrasi di MQTT handler
5. ✅ **Test UI**: Test edit sensor di frontend
6. ✅ **Test Integration**: Kirim data sensor dan verify kalibrasi + threshold
7. ✅ **Test Notification**: Verify Telegram notification terkirim

---

## 📁 File Structure

```
awlr-astrodev-cloud/
├── src/
│   └── components/
│       └── Sensors.tsx                    ← ✅ Updated (UI Edit Sensor)
│
├── supabase/
│   ├── migrations/
│   │   ├── 20251224000000_add_sensor_calibration_and_threshold.sql  ← ✅ New
│   │   └── 20251224000001_create_sensor_alerts_table.sql            ← ✅ New
│   │
│   └── functions/
│       ├── apply-sensor-calibration/
│       │   └── index.ts                   ← ✅ New (Kalibrasi Function)
│       │
│       └── check-sensor-threshold/
│           └── index.ts                   ← ✅ New (Threshold Check Function)
│
└── docs/
    ├── sensor-calibration-threshold-guide.md      ← ✅ New (Technical Docs)
    └── deployment-sensor-calibration.md           ← ✅ New (Deployment Guide)
```

---

## 💡 Tips & Best Practices

1. **Default Calibration**: Jika tidak perlu kalibrasi, biarkan a=1 dan b=0
2. **Threshold Optional**: Tidak semua sensor perlu threshold
3. **Test First**: Test kalibrasi dengan data sample sebelum production
4. **Monitor Logs**: Check function logs untuk debugging
5. **Archive Alerts**: Hapus/archive alerts lama secara periodik (> 30 hari)

---

## 🆘 Support

Jika ada pertanyaan atau issue:

1. Check dokumentasi di `docs/sensor-calibration-threshold-guide.md`
2. Check deployment guide di `docs/deployment-sensor-calibration.md`
3. Review function logs di Supabase Dashboard
4. Check database dengan SQL queries yang ada di docs

---

**Status**: ✅ **READY TO DEPLOY**

Semua file sudah dibuat dan siap untuk deployment!
