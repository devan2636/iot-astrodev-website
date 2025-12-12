import paho.mqtt.client as mqtt
import time
import ssl
import json # Diperlukan untuk mengirim data dalam format JSON
import random # Diperlukan untuk mensimulasikan data sensor

# --- PENGATURAN KONEKSI MQTT ---
# Langkah 1: Konfigurasi MQTT
# Isi Broker URL dengan alamat broker MQTT (contoh: wss://mqtt.astrodev.cloud:443)
broker_address = "mqtt.astrodev.cloud"
port = 443
transport_protocol = "websockets" # Menggunakan websockets untuk koneksi WSS
# Masukkan Client ID yang unik untuk identifikasi perangkat
client_id = "master_publisher_devan_multi_device" # Mengubah Client ID untuk multi-device
# Isi Username dan Password sesuai kredensial broker
username = "astrodev"
password = "Astroboy26@"

# Langkah 2: Konfigurasi Topic
# Topic Data: Untuk MENGIRIMKAN data sensor ke topik default (iot/devices/+/data)
# Kami akan mensimulasikan pengiriman dari beberapa ID perangkat yang berbeda.
device_ids_to_simulate = ["65cef40a-5e73-4602-8d46-e93e694db47f", "086e7e43-9a40-437e-8ffd-fc029aa86d9a", "ff0920f2-95ee-42e6-a2a3-64df3f804942"]

# --- FUNGSI CALLBACK ---

# == FUNGSI CALLBACK saat berhasil terhubung ke Broker MQTT ==
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ Berhasil terhubung ke Broker MQTT (Program Master Multi-Device)!")
    else:
        print(f"❌ Gagal terhubung, kode balasan: {rc}")
        # Tambahkan logika penanganan kegagalan koneksi di sini jika diperlukan

# == FUNGSI CALLBACK saat pesan berhasil terkirim (published) ==
def on_publish(client, userdata, mid):
    # Callback ini dapat menjadi sangat 'ramai' jika banyak pesan dikirim.
    # Untuk tujuan simulasi multi-device, kita akan menonaktifkan pencetakan di sini
    # dan hanya mencetak di loop utama.
    pass

# --- INISIALISASI DAN KONEKSI ---

# Membuat instance klien MQTT baru dengan Client ID yang unik
master_client = mqtt.Client(client_id=client_id, transport=transport_protocol)

# Menetapkan kredensial username dan password
master_client.username_pw_set(username, password)

# Mengatur koneksi TLS/SSL. Ini wajib untuk port 443 (WSS)
master_client.tls_set(tls_version=ssl.PROTOCOL_TLS)

# Menetapkan fungsi callback yang telah didefinisikan
master_client.on_connect = on_connect
master_client.on_publish = on_publish # Menambahkan fungsi callback untuk konfirmasi pengiriman

# Mencoba terhubung ke broker MQTT
print(f"Menghubungkan program master ke broker MQTT di {broker_address}:{port}...")
try:
    master_client.connect(broker_address, port)
except Exception as e:
    print(f"❌ Gagal terhubung ke broker: {e}")
    print("Pastikan Broker URL, port, username, dan password sudah benar.")
    exit(1) # Keluar dari program jika koneksi gagal

# Memulai loop jaringan di latar belakang.
# master_client.loop_start() memungkinkan program utama untuk terus berjalan (mengirim pesan).
master_client.loop_start()

# --- LOGIKA PENGIRIMAN PESAN SENSOR UNTUK MULTI-DEVICE ---
print(f"\nProgram Master berjalan dan akan mengirim data sensor dari {len(device_ids_to_simulate)} perangkat berbeda secara berkala.")

try:
    count = 1
    while True:
        print(f"\n--- Iterasi Pengiriman Data Sensor Ke-{count} ---")
        for device_id in device_ids_to_simulate:
            # Topik untuk setiap perangkat akan disesuaikan
            topic_to_publish_current = f"iot/devices/{device_id}/data"

            # Mensimulasikan data sensor (untuk setiap perangkat)
            temperature = round(random.uniform(20.0, 30.0), 2) # Suhu dalam Celsius
            humidity = random.randint(40, 80)                   # Kelembaban dalam %
            pressure = round(random.uniform(1000.0, 1020.0), 2) # Tekanan dalam hPa

            co2 = round(random.uniform(380.0, 500.0), 2)       # CO2 dalam ppm
            o2 = round(random.uniform(19.0, 21.5), 2)          # O2 dalam %
            ph = round(random.uniform(6.0, 8.0), 1)            # pH (skala 0-14)
            curah_hujan = round(random.uniform(0.0, 10.0), 2)  # Curah Hujan dalam mm/jam
            # Membuat objek JSON sesuai format yang ditentukan
            sensor_data = {
                "temperature": temperature,
                "humidity": humidity,
                "pressure": pressure
            }

            # Mengubah objek JSON menjadi string JSON
            pesan_json = json.dumps(sensor_data)

            print(f"  [Device: {device_id}] Mengirim data ke topik '{topic_to_publish_current}': {pesan_json}")
            # Mengirim pesan JSON ke topik yang telah ditentukan
            master_client.publish(topic_to_publish_current, pesan_json)

        time.sleep(5) # Jeda 5 detik sebelum mengirim data dari semua perangkat lagi
        count += 1
except KeyboardInterrupt:
    print("\nProses pengiriman data sensor dihentikan oleh pengguna.")
except Exception as e:
    print(f"\nTerjadi kesalahan tak terduga: {e}")
finally:
    # Menghentikan loop jaringan dan memutuskan koneksi saat program berakhir
    master_client.loop_stop()
    master_client.disconnect()
    print("Koneksi ke broker terputus.")
