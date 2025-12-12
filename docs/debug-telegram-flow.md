# Debug MQTT → Telegram Flow

## Flow yang Seharusnya:
```
MQTT → mqtt-data-handler → Database → telegram-notifications → Telegram
```

## Cek di Supabase Dashboard:

1. **Cek mqtt-data-handler logs:**
   - Buka Supabase Dashboard → Functions → mqtt-data-handler → Logs
   - Cari pesan error atau warning
   - Pastikan ada log: `[SAVED] Device status saved for device:`

2. **Cek telegram-notifications logs:**
   - Buka Functions → telegram-notifications → Logs
   - Cari error messages
   - Pastikan function dipanggil oleh mqtt-data-handler

3. **Cek Environment Variables:**
   - Buka Settings → Environment variables
   - Pastikan semua variables ada:
     ```
     TELEGRAM_BOT_TOKEN=8132058716:AAF6wQGdPJBi46emnzCn74RYOwtmFaPxStI
     TELEGRAM_CHAT_ID=-4691595195
     ```

4. **Test telegram-notifications langsung:**
   ```bash
   curl -X POST "https://gdmvqskgtdpsktuhsnal.supabase.co/functions/v1/telegram-notifications" \
   -H "Content-Type: application/json" \
   -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
   -d '{"device_id":"test-device","event":"test"}'
   ```

## Kemungkinan Masalah:

1. **mqtt-data-handler tidak memanggil telegram-notifications**
   - Cek fetch URL di mqtt-data-handler
   - Pastikan SUPABASE_URL dan SUPABASE_ANON_KEY benar

2. **telegram-notifications error**
   - Cek error logs
   - Pastikan bot token dan chat ID benar
   - Test function langsung via curl

3. **Environment variables tidak ter-load**
   - Re-deploy kedua functions
   - Pastikan variables tersimpan

## Solusi:

1. **Re-deploy Functions:**
   ```bash
   cd scripts
   ./deploy-telegram.sh  # atau deploy-telegram.ps1 untuk Windows
   ```

2. **Update Environment Variables:**
   - Hapus dan set ulang di Supabase Dashboard
   - Re-deploy functions setelah update

3. **Test Direct Call:**
   - Test telegram-notifications langsung
   - Jika berhasil, berarti masalah di mqtt-data-handler

4. **Check MQTT Data:**
   - Pastikan format data MQTT sesuai
   - Topic: `iot/devices/{device_id}/status`
   - Payload harus valid JSON

## Next Steps:

1. **Cek logs mqtt-data-handler** untuk memastikan:
   - Data MQTT diterima
   - Database update berhasil
   - Telegram function dipanggil

2. **Cek logs telegram-notifications** untuk:
   - Function dipanggil
   - Environment variables loaded
   - Telegram API response

3. **Test telegram-notifications** langsung:
   - Gunakan curl command di atas
   - Pastikan dapat response 200 OK

4. **Update functions jika perlu:**
   - Copy code terbaru dari docs
   - Deploy ulang kedua functions
   - Set environment variables
   - Test kembali flow lengkap
