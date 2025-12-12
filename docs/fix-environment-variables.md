# Fix Environment Variables - Telegram Integration

## Error yang Terjadi
```
500 - TELEGRAM_BOT_TOKEN environment variable is required
```

## Solusi: Set Environment Variables di Supabase

### Langkah 1: Buka Project Settings
1. Di Supabase Dashboard, klik **"Settings"** di sidebar kiri
2. Pilih **"Environment variables"** atau **"Secrets"**

### Langkah 2: Tambah Environment Variables
Tambahkan 2 variables berikut:

**Variable 1:**
- Name: `TELEGRAM_BOT_TOKEN`
- Value: `8132058716:AAF6wQGdPJBi46emnzCn74RYOwtmFaPxStI`
- Klik "Add" atau "Save"

**Variable 2:**
- Name: `TELEGRAM_CHAT_ID`
- Value: `8164555966`
- Klik "Add" atau "Save"

### Langkah 3: Restart Function (Opsional)
Setelah menambah environment variables:
1. Kembali ke **"Functions"**
2. Klik function **"telegram-notifications"**
3. Klik **"Redeploy"** atau **"Deploy"** lagi untuk memastikan variables ter-load

### Langkah 4: Test Ulang
1. Di function test, gunakan payload:
```json
{
  "device_id": "test-device-01",
  "event": "test"
}
```

2. Klik **"Send Request"**

3. Response yang diharapkan:
```json
{
  "message": "Notifications sent successfully",
  "events_count": 1,
  "results": [...]
}
```

### Langkah 5: Cek Telegram
- Buka chat dengan bot @AstrodevIoT_bot
- Anda harus menerima pesan test notification

## Troubleshooting

### Jika masih error "environment variable required":
1. Pastikan nama variable **persis sama**: `TELEGRAM_BOT_TOKEN` dan `TELEGRAM_CHAT_ID`
2. Pastikan tidak ada spasi di awal/akhir value
3. Coba redeploy function setelah set variables

### Jika error "Chat not found":
1. Pastikan sudah start chat dengan bot: https://t.me/AstrodevIoT_bot
2. Kirim pesan `/start` ke bot
3. Gunakan Chat ID yang benar: `8164555966`

### Jika error "Unauthorized":
1. Cek bot token benar: `8132058716:AAF6wQGdPJBi46emnzCn74RYOwtmFaPxStI`
2. Pastikan bot masih aktif

## Next Steps Setelah Berhasil

1. **Test dengan script Python:**
```bash
cd examples/telegram-testing
python test_telegram.py
```

2. **Update MQTT data handler** untuk integrasi otomatis

3. **Monitor logs** untuk memastikan tidak ada error

4. **Test dengan data device real** via MQTT
