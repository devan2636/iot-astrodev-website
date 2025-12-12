# Telegram Integration Testing

Script untuk testing integrasi Telegram Bot dengan sistem IoT monitoring.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Edit `test_telegram.py` dan ganti:
```python
SUPABASE_URL = "YOUR_SUPABASE_URL"  # Ganti dengan URL Supabase Anda
SUPABASE_ANON_KEY = "YOUR_ANON_KEY"  # Ganti dengan anon key Anda
```

## Running Tests

```bash
python test_telegram.py
```

## Test Scenarios

Script akan melakukan testing:

1. **Bot Connection Test** - Memverifikasi koneksi ke Telegram Bot
2. **Get Updates** - Mencari chat ID dari pesan terbaru
3. **Send Test Message** - Mengirim pesan test langsung via Telegram API
4. **Supabase Function Test** - Test function telegram-notifications
5. **Alert Scenarios** - Menampilkan contoh skenario alert

## Getting Chat ID

### Untuk Personal Chat:
1. Start chat dengan bot: https://t.me/AstrodevIoT_bot
2. Kirim pesan `/start`
3. Jalankan script, chat ID akan muncul di output

### Untuk Group Chat:
1. Tambahkan bot ke group
2. Kirim mention: `@AstrodevIoT_bot hello`
3. Jalankan script, chat ID group akan muncul (biasanya negatif)

## Sample Output

```
🤖 Telegram Bot Integration Test
========================================

1. Testing bot connection...
✅ Bot connected: AstrodevIoT
   Username: @AstrodevIoT_bot

2. Getting recent updates...
✅ Recent chats found:
   Chat ID: 123456789 - John Doe
   Chat ID: -987654321 - IoT Monitoring Group

3. Enter Chat ID to test: 123456789
✅ Test message sent successfully!

4. Testing Supabase function...
✅ Supabase function test successful!
   Response: {'message': 'Notifications sent successfully', 'events_count': 3}

5. Sample alert scenarios:
   Scenario 1:
   Device: weather-station-01
   Battery: 8% (Critical)
   WiFi: -85 dBm (Weak)
   
   Scenario 2:
   Device: sensor-node-02
   Battery: 15% (Warning)
   WiFi: -75 dBm (Good)
   Temperature: 45°C (Critical)
   Humidity: 85% (Critical)

========================================
🎉 Test completed!
```

## Troubleshooting

### Bot tidak merespon
- Pastikan bot token benar
- Pastikan sudah start chat dengan `/start`

### Chat ID tidak ditemukan
- Kirim pesan ke bot terlebih dahulu
- Tunggu beberapa detik lalu jalankan script lagi

### Supabase function error
- Pastikan URL dan anon key benar
- Pastikan function sudah di-deploy
- Check environment variables di Supabase

## Next Steps

Setelah testing berhasil:

1. Set environment variable `TELEGRAM_CHAT_ID` di Supabase
2. Deploy function `telegram-notifications`
3. Test dengan data device real
4. Monitor logs di Supabase Functions
