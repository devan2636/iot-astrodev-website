# Sensor Calibration and Threshold Implementation Guide

## Overview

Dokumentasi ini menjelaskan implementasi kalibrasi sensor dan threshold untuk notifikasi/alarm pada sistem AWLR AstroDev Cloud.

## Database Schema

### Kolom Baru di Tabel `sensors`

| Kolom            | Tipe          | Default | Deskripsi                                                    |
| ---------------- | ------------- | ------- | ------------------------------------------------------------ |
| `calibration_a`  | DECIMAL(10,6) | 1.0     | Koefisien (a) dalam persamaan y = ax + b                     |
| `calibration_b`  | DECIMAL(10,6) | 0.0     | Bias (b) dalam persamaan y = ax + b                          |
| `threshold_low`  | DECIMAL(10,3) | NULL    | Batas bawah untuk alarm (trigger jika nilai < threshold_low) |
| `threshold_high` | DECIMAL(10,3) | NULL    | Batas atas untuk alarm (trigger jika nilai > threshold_high) |

## Kalibrasi Sensor

### Persamaan Kalibrasi

```
y = ax + b
```

Dimana:

- **y** = Output (hasil kalibrasi)
- **a** = Koefisien kalibrasi (calibration_a)
- **b** = Bias/offset (calibration_b)
- **x** = Input dari sensor (raw value)

### Contoh Penggunaan

#### Contoh 1: Sensor Temperatur dengan Offset

Jika sensor temperatur memiliki bias +2°C:

- calibration_a = 1.0
- calibration_b = -2.0
- Input sensor = 25°C
- Output = 1.0 × 25 + (-2.0) = 23°C

#### Contoh 2: Sensor dengan Faktor Skala

Jika sensor tekanan perlu dikali 0.98:

- calibration_a = 0.98
- calibration_b = 0
- Input sensor = 1000 hPa
- Output = 0.98 × 1000 + 0 = 980 hPa

#### Contoh 3: Kalibrasi Linear Lengkap

- calibration_a = 1.05
- calibration_b = -3.5
- Input sensor = 50
- Output = 1.05 × 50 + (-3.5) = 49

## Threshold untuk Notifikasi/Alarm

### Cara Kerja Threshold

1. **Threshold Low**: Alarm aktif jika nilai sensor < threshold_low
2. **Threshold High**: Alarm aktif jika nilai sensor > threshold_high

### Contoh Konfigurasi

#### Sensor Ketinggian Air

```json
{
  "name": "Water Level Sensor",
  "type": "Ketinggian Air",
  "unit": "cm",
  "min_value": 0,
  "max_value": 500,
  "calibration_a": 1.0,
  "calibration_b": 0,
  "threshold_low": 50, // Alert jika air terlalu rendah (< 50 cm)
  "threshold_high": 400 // Alert jika air terlalu tinggi (> 400 cm)
}
```

#### Sensor Temperatur

```json
{
  "name": "Temperature Sensor",
  "type": "Temperature",
  "unit": "°C",
  "min_value": -20,
  "max_value": 80,
  "calibration_a": 1.0,
  "calibration_b": 0,
  "threshold_low": 5, // Alert jika terlalu dingin (< 5°C)
  "threshold_high": 40 // Alert jika terlalu panas (> 40°C)
}
```

## Backend Implementation (Supabase Functions)

### 1. Fungsi untuk Apply Kalibrasi

Buat Supabase Edge Function untuk mengaplikasikan kalibrasi pada data sensor:

```typescript
// supabase/functions/apply-sensor-calibration/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const { sensorId, rawValue } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get sensor calibration data
    const { data: sensor, error } = await supabase
      .from("sensors")
      .select("calibration_a, calibration_b")
      .eq("id", sensorId)
      .single();

    if (error) throw error;

    const a = sensor.calibration_a || 1.0;
    const b = sensor.calibration_b || 0.0;

    // Apply calibration: y = ax + b
    const calibratedValue = a * rawValue + b;

    return new Response(
      JSON.stringify({
        rawValue,
        calibratedValue,
        formula: `y = ${a} × ${rawValue} + ${b} = ${calibratedValue}`,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
```

### 2. Fungsi untuk Check Threshold dan Kirim Notifikasi

```typescript
// supabase/functions/check-sensor-threshold/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface ThresholdAlert {
  sensorId: string;
  sensorName: string;
  value: number;
  thresholdType: "low" | "high";
  thresholdValue: number;
}

serve(async (req) => {
  try {
    const { sensorId, value } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get sensor threshold data
    const { data: sensor, error } = await supabase
      .from("sensors")
      .select("id, name, threshold_low, threshold_high, unit, devices(name)")
      .eq("id", sensorId)
      .single();

    if (error) throw error;

    const alerts: ThresholdAlert[] = [];

    // Check low threshold
    if (sensor.threshold_low !== null && value < sensor.threshold_low) {
      alerts.push({
        sensorId: sensor.id,
        sensorName: sensor.name,
        value,
        thresholdType: "low",
        thresholdValue: sensor.threshold_low,
      });
    }

    // Check high threshold
    if (sensor.threshold_high !== null && value > sensor.threshold_high) {
      alerts.push({
        sensorId: sensor.id,
        sensorName: sensor.name,
        value,
        thresholdType: "high",
        thresholdValue: sensor.threshold_high,
      });
    }

    // Send alerts if any
    if (alerts.length > 0) {
      for (const alert of alerts) {
        // Send to Telegram
        const telegramMessage = `
🚨 SENSOR ALERT 🚨

Device: ${sensor.devices.name}
Sensor: ${alert.sensorName}
Current Value: ${alert.value} ${sensor.unit}
Threshold ${alert.thresholdType.toUpperCase()}: ${alert.thresholdValue} ${
          sensor.unit
        }

${
  alert.thresholdType === "low"
    ? `⚠️ Nilai sensor terlalu RENDAH!`
    : `🔥 Nilai sensor terlalu TINGGI!`
}
        `.trim();

        // Call telegram notification function
        await supabase.functions.invoke("send-telegram-notification", {
          body: { message: telegramMessage },
        });
      }
    }

    return new Response(
      JSON.stringify({
        alerts,
        alertCount: alerts.length,
        message:
          alerts.length > 0
            ? "Threshold alerts triggered"
            : "All values within threshold",
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
```

### 3. Integration dengan MQTT Handler

Update existing MQTT handler untuk mengaplikasikan kalibrasi dan check threshold:

```typescript
// Dalam fungsi yang handle incoming MQTT data
async function processSensorData(deviceId: string, sensorData: any) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Get sensor info with calibration
  const { data: sensor } = await supabase
    .from("sensors")
    .select("*")
    .eq("device_id", deviceId)
    .eq("name", sensorData.name)
    .single();

  if (sensor) {
    const rawValue = parseFloat(sensorData.value);

    // Apply calibration
    const a = sensor.calibration_a || 1.0;
    const b = sensor.calibration_b || 0.0;
    const calibratedValue = a * rawValue + b;

    // Save to sensor_data with both raw and calibrated values
    await supabase.from("sensor_data").insert({
      sensor_id: sensor.id,
      value: calibratedValue,
      raw_value: rawValue,
      timestamp: new Date().toISOString(),
    });

    // Check threshold
    await supabase.functions.invoke("check-sensor-threshold", {
      body: {
        sensorId: sensor.id,
        value: calibratedValue,
      },
    });
  }
}
```

## Migration Instructions

1. **Apply Migration**:

   ```bash
   # Jika menggunakan Supabase CLI
   supabase db push

   # Atau jalankan SQL migration secara manual di Supabase Dashboard:
   # SQL Editor > New query > Copy paste dari file migration
   ```

2. **Deploy Edge Functions**:

   ```bash
   supabase functions deploy apply-sensor-calibration
   supabase functions deploy check-sensor-threshold
   ```

3. **Test Calibration**:
   ```bash
   curl -X POST https://your-project.supabase.co/functions/v1/apply-sensor-calibration \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{"sensorId": "sensor-uuid", "rawValue": 25.5}'
   ```

## Frontend Usage

UI sudah diimplementasi di `src/components/Sensors.tsx` dengan fitur:

- ✅ Edit min/max value
- ✅ Edit kalibrasi (a dan b)
- ✅ Edit threshold low dan high
- ✅ Preview perhitungan kalibrasi
- ✅ Visual indicator untuk threshold

## Testing Checklist

- [ ] Migration berhasil dijalankan
- [ ] Sensor dapat di-edit dengan nilai kalibrasi
- [ ] Sensor dapat di-edit dengan threshold
- [ ] Kalibrasi diterapkan pada data sensor baru
- [ ] Notifikasi Telegram terkirim saat threshold terlewati
- [ ] UI menampilkan preview kalibrasi dengan benar

## Notes

- Kalibrasi hanya diterapkan pada data BARU yang masuk setelah konfigurasi
- Data lama tidak akan di-recalculate otomatis
- Threshold menggunakan nilai SETELAH kalibrasi
- Untuk recalculate data lama, buat script terpisah atau edge function
