# Device Status Dummy Data Generator

Script Python untuk generate dummy data device status via MQTT untuk testing halaman Monitoring.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Konfigurasi MQTT sudah diset untuk Astrodev Cloud (WSS):
```python
MQTT_BROKER = "mqtt.astrodev.cloud"
MQTT_PORT = 443
MQTT_USERNAME = "astrodev"
MQTT_PASSWORD = "Astroboy26@"
MQTT_TRANSPORT = "websockets"
```

## Device IDs yang Digunakan

Script ini menggunakan Device ID yang sudah ada di database:

| Device ID | Name |
|-----------|------|
| 086e7e43-9a40-437e-8ffd-fc029aa86d9a | AWLR |
| 2d6ea74e-3235-435e-8e4f-e6965f1ce2e1 | ESP32-Weather |
| 34168ffc-17fe-4a79-bec9-7b3386700cf9 | ESP32 |
| 65cef40a-5e73-4602-8d46-e93e694db47f | Weather Station 2 |
| ab74435f-1ff7-45b3-a2bf-67b8a8bcc87e | ESP32-LoRa |
| f2b0150e-9e05-4ec1-b95f-82126b16e158 | Weather Station |

## Data yang Digenerate

### 1. Sensor Data
Dikirim ke topic: `iot/devices/{device_id}/data`
```json
{
  "temperature": 25.5,
  "humidity": 65.2,
  "pressure": 1013.2,
  "timestamp": "2024-01-15T10:30:00"
}
```

### 2. Device Status
Dikirim ke topic: `iot/devices/{device_id}/status`
```json
{
  "status": "online",
  "battery": 85,
  "wifi_rssi": -65,
  "uptime": 3600,
  "free_heap": 123456,
  "ota_update": "up_to_date",
  "timestamp": "2024-01-15T10:30:00"
}
```

## Cara Menjalankan

```bash
python mqtt_device_status.py
```

### Pilihan Mode:

1. **Run for specific duration**: Jalankan untuk durasi tertentu (misal 60 menit)
2. **Run continuously**: Jalankan terus menerus sampai dihentikan
3. **Test connection only**: Test koneksi MQTT saja

## Fitur

- ✅ Generate data untuk 6 device sekaligus
- ✅ Simulasi device online/offline secara random
- ✅ Battery level yang berkurang secara realistis
- ✅ WiFi signal yang berfluktuasi
- ✅ Uptime yang terus bertambah
- ✅ Memory usage yang berubah-ubah
- ✅ Data sensor (temperature, humidity, pressure)

## Testing Monitoring Page

1. Jalankan script ini untuk generate dummy data
2. Buka halaman Monitoring di aplikasi
3. Pilih device dari dropdown
4. Lihat data real-time di grafik dan cards
5. Test export Excel dengan data yang sudah ada

## Troubleshooting

### Connection Failed
- Pastikan MQTT broker berjalan
- Check MQTT_BROKER address dan port
- Pastikan firewall tidak memblokir koneksi

### No Data in Monitoring Page
- Pastikan MQTT bridge function di Supabase berjalan
- Check topic MQTT sesuai dengan yang diharapkan aplikasi
- Pastikan device ID sesuai dengan yang ada di database

### Script Error
- Install dependencies: `pip install paho-mqtt`
- Check Python version (minimal 3.6)
- Pastikan tidak ada typo di konfigurasi
