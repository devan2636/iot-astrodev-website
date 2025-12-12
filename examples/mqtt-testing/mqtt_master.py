#!/usr/bin/env python3
import paho.mqtt.client as mqtt
import time
import ssl
import json
import random

# MQTT Configuration
broker_address = "mqtt.astrodev.cloud"
port = 443
transport_protocol = "websockets"
client_id = "master_publisher_devan_multi_device"
username = "astrodev"
password = "Astroboy26@"

# Device IDs to simulate
device_ids_to_simulate = [
    "65cef40a-5e73-4602-8d46-e93e694db47f",
    "086e7e43-9a40-437e-8ffd-fc029aa86d9a", 
    "ff0920f2-95ee-42e6-a2a3-64df3f804942"
]

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ Berhasil terhubung ke Broker MQTT (Program Master Multi-Device)!")
    else:
        print(f"❌ Gagal terhubung, kode balasan: {rc}")

def on_publish(client, userdata, mid):
    pass

def main():
    # Create MQTT client instance
    master_client = mqtt.Client(client_id=client_id, transport=transport_protocol)
    
    # Set credentials
    master_client.username_pw_set(username, password)
    
    # Configure TLS/SSL
    master_client.tls_set(tls_version=ssl.PROTOCOL_TLS)
    
    # Set callbacks
    master_client.on_connect = on_connect
    master_client.on_publish = on_publish
    
    # Connect to broker
    print(f"Menghubungkan program master ke broker MQTT di {broker_address}:{port}...")
    try:
        master_client.connect(broker_address, port)
    except Exception as e:
        print(f"❌ Gagal terhubung ke broker: {e}")
        print("Pastikan Broker URL, port, username, dan password sudah benar.")
        return
    
    # Start network loop
    master_client.loop_start()
    
    print(f"\nProgram Master berjalan dan akan mengirim data sensor dari {len(device_ids_to_simulate)} perangkat berbeda secara berkala.")
    
    try:
        count = 1
        while True:
            print(f"\n--- Iterasi Pengiriman Data Sensor Ke-{count} ---")
            
            for device_id in device_ids_to_simulate:
                topic = f"iot/devices/{device_id}/data"
                
                # Generate simulated sensor data
                sensor_data = {
                    "temperature": round(random.uniform(20.0, 30.0), 2),
                    "humidity": random.randint(40, 80),
                    "pressure": round(random.uniform(1000.0, 1020.0), 2)
                }
                
                # Convert to JSON string
                payload = json.dumps(sensor_data)
                
                print(f"  [Device: {device_id}] Mengirim data ke topik '{topic}': {payload}")
                master_client.publish(topic, payload)
            
            time.sleep(5)
            count += 1
            
    except KeyboardInterrupt:
        print("\nProses pengiriman data sensor dihentikan oleh pengguna.")
    except Exception as e:
        print(f"\nTerjadi kesalahan tak terduga: {e}")
    finally:
        master_client.loop_stop()
        master_client.disconnect()
        print("Koneksi ke broker terputus.")

if __name__ == "__main__":
    main()
