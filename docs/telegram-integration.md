# Telegram Integration Setup Guide

## Overview
Sistem IoT monitoring ini telah diintegrasikan dengan Telegram Bot untuk mengirim notifikasi real-time ketika terjadi event atau alert dari device.

## Bot Information
- **Bot Name**: AstrodevIoT_bot
- **Bot Username**: @AstrodevIoT_bot
- **Bot Token**: `8132058716:AAF6wQGdPJBi46emnzCn74RYOwtmFaPxStI`

## Setup Instructions

### 1. Environment Variables
Tambahkan environment variables berikut di Supabase Dashboard:

```bash
TELEGRAM_BOT_TOKEN=8132058716:AAF6wQGdPJBi46emnzCn74RYOwtmFaPxStI
TELEGRAM_CHAT_ID=8164555966
TELEGRAM_CHAT_ID=-4691595195
```

### 2. Mendapatkan Chat ID

#### Untuk Personal Chat:
1. Start chat dengan bot: https://t.me/AstrodevIoT_bot
2. Kirim pesan `/start` ke bot
3. Buka URL berikut di browser:
   ```
   https://api.telegram.org/bot8132058716:AAF6wQGdPJBi46emnzCn74RYOwtmFaPxStI/getUpdates
   ```
4. Cari `chat.id` dari response JSON
5. Gunakan chat ID tersebut untuk environment variable `TELEGRAM_CHAT_ID`

#### Untuk Group Chat:
1. Tambahkan bot ke group
2. Kirim pesan mention bot: `@AstrodevIoT_bot hello`
3. Buka URL getUpdates seperti di atas
4. Cari `chat.id` yang bernilai negatif (untuk group)

### 3. Install Supabase CLI

Sebelum deploy functions, install Supabase CLI terlebih dahulu:

```bash
# Install Node.js jika belum ada
# Windows: Download dari https://nodejs.org/

# Install Supabase CLI via npm
npm install -g supabase

# Login ke Supabase (browser akan terbuka)
supabase login

# Link project (ganti PROJECT_ID dengan ID project Anda)
supabase link --project-ref PROJECT_ID
```

### 4. Deploy Supabase Functions

Deploy kedua functions ke Supabase:

#### Windows (PowerShell):
```powershell
# Run deployment script
.\scripts\deploy-telegram.ps1

# Atau manual:
supabase functions deploy telegram-notifications
supabase functions deploy mqtt-data-handler
```

#### Linux/Mac (Bash):
```bash
# Run deployment script
bash scripts/deploy-telegram.sh

# Atau manual:
supabase functions deploy telegram-notifications
supabase functions deploy mqtt-data-handler
```

Note: Jika mengalami error "supabase not found", pastikan:
1. Node.js sudah terinstall (`node --version`)
2. Supabase CLI sudah terinstall (`npm list -g supabase`)
3. Path npm global sudah ada di PATH environment variable

### 4. Set Environment Variables di Supabase

```bash
supabase secrets set TELEGRAM_BOT_TOKEN=8132058716:AAF6wQGdPJBi46emnzCn74RYOwtmFaPxStI
supabase secrets set TELEGRAM_CHAT_ID=YOUR_CHAT_ID
```

## Notification Types

Bot akan mengirim notifikasi untuk event berikut:

### 🔋 Battery Alerts
- **Critical**: Battery < 10%
- **Warning**: Battery < 20%

### 📶 WiFi Signal Alerts
- **Warning**: RSSI < -80 dBm

### 💾 Memory Alerts
- **Warning**: Free memory < 10 KB

### 🌡️ Sensor Alerts
- **Temperature**: Critical (≤5°C atau ≥40°C), Warning (≤10°C atau ≥35°C)
- **Humidity**: Critical (≤20% atau ≥80%), Warning (≤30% atau ≥70%)
- **Pressure**: Critical (≤970 atau ≥1040 hPa), Warning (≤980 atau ≥1030 hPa)

### ✅ Device Status
- **Success**: Device online dan mengirim data

## Message Format

Setiap notifikasi akan dikirim dengan format:

```
🔋 Battery Critical

📱 Device: Weather Station 01
📝 Message: Device battery level critically low: 8%
🕐 Time: 15/01/2024, 14:30

IoT Monitoring System - AstroDev
```

## Testing

### Manual Test
Anda dapat test function secara manual dengan curl:

```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/telegram-notifications' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "device_id": "test-device-id",
    "event": "test"
  }'
```

### Automatic Trigger
Notifikasi akan otomatis terkirim ketika:
1. Device mengirim data status via MQTT
2. MQTT data handler memproses data
3. Function telegram-notifications dipanggil
4. Alert digenerate berdasarkan threshold
5. Notifikasi dikirim ke Telegram

## Troubleshooting

### Bot tidak merespon
1. Pastikan bot token benar
2. Pastikan bot sudah di-start dengan `/start`
3. Check environment variables di Supabase

### Tidak menerima notifikasi
1. Pastikan chat ID benar
2. Check logs di Supabase Functions
3. Pastikan MQTT data handler berjalan dengan baik

### Error "Chat not found"
1. Pastikan sudah start chat dengan bot
2. Untuk group, pastikan bot sudah ditambahkan dan diberi permission

## Security Notes

⚠️ **PENTING**: 
- Jangan share bot token di public repository
- Gunakan environment variables untuk menyimpan credentials
- Regularly monitor bot usage di Telegram

## API Reference

### Telegram Bot API
- **Send Message**: `https://api.telegram.org/bot{token}/sendMessage`
- **Get Updates**: `https://api.telegram.org/bot{token}/getUpdates`

### Supabase Function Endpoints
- **Telegram Notifications**: `/functions/v1/telegram-notifications`
- **MQTT Data Handler**: `/functions/v1/mqtt-data-handler`
