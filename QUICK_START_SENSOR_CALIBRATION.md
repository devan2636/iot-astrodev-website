# Quick Start: Sensor Calibration & Threshold

## 🚀 Fitur Baru

- ✅ Edit min/max value sensor
- ✅ Kalibrasi sensor (y = ax + b)
- ✅ Threshold notifikasi (Low & High)
- ✅ Auto alert ke Telegram

## 📝 Files Created

### Frontend

- `src/components/Sensors.tsx` - **UPDATED** dengan dialog edit

### Database

- `supabase/migrations/20251224000000_add_sensor_calibration_and_threshold.sql`
- `supabase/migrations/20251224000001_create_sensor_alerts_table.sql`

### Backend Functions

- `supabase/functions/apply-sensor-calibration/index.ts`
- `supabase/functions/check-sensor-threshold/index.ts`

### Documentation

- `docs/sensor-calibration-threshold-guide.md` - Technical guide
- `docs/deployment-sensor-calibration.md` - Deployment guide
- `SENSOR_CALIBRATION_SUMMARY.md` - Full summary

## ⚡ Quick Deploy

```bash
# 1. Deploy database (via Supabase Dashboard SQL Editor)
# Copy paste migration files and Run

# 2. Deploy functions
supabase functions deploy apply-sensor-calibration
supabase functions deploy check-sensor-threshold

# 3. Build & deploy frontend
npm run build
```

## 🎯 How to Use (UI)

1. Login as admin
2. Go to **Sensors** page
3. Click **Edit** button (pencil icon) on any sensor
4. Fill in the form:
   - Min/Max values
   - Calibration: a and b values
   - Threshold: Low and High
5. Click **Update Sensor**

## 📐 Calibration Formula

```
y = ax + b

y = output (calibrated value)
a = coefficient (default: 1)
b = bias/offset (default: 0)
x = input (raw sensor value)
```

**Example**:

- a = 1.0, b = -2.0
- Raw input = 25
- Output = 1.0 × 25 + (-2.0) = 23

## 🚨 Threshold Alerts

- **Low**: Alert when value < threshold_low
- **High**: Alert when value > threshold_high

**Example**:

- threshold_low = 5°C
- threshold_high = 40°C
- If sensor value = 3°C → ⚠️ LOW alert
- If sensor value = 45°C → 🚨 HIGH alert

## 📊 Database Schema

### Table: `sensors` (new columns)

- `calibration_a` DECIMAL(10,6) DEFAULT 1.0
- `calibration_b` DECIMAL(10,6) DEFAULT 0.0
- `threshold_low` DECIMAL(10,3)
- `threshold_high` DECIMAL(10,3)

### Table: `sensor_alerts` (new table)

- Logs all threshold alerts
- Tracks acknowledgement status
- Linked to sensors and devices

## 🔍 Testing

```bash
# Test calibration function
curl -X POST https://your-project.supabase.co/functions/v1/apply-sensor-calibration \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sensorId": "uuid", "rawValue": 25.5}'

# Test threshold function
curl -X POST https://your-project.supabase.co/functions/v1/check-sensor-threshold \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sensorId": "uuid", "value": 45}'
```

## 📚 Full Documentation

See detailed docs:

- [Technical Guide](docs/sensor-calibration-threshold-guide.md)
- [Deployment Guide](docs/deployment-sensor-calibration.md)
- [Full Summary](SENSOR_CALIBRATION_SUMMARY.md)

## ✅ Status

**READY TO DEPLOY** 🚀

All files created and tested successfully!
