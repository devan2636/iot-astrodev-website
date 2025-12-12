import paho.mqtt.client as mqtt
import json
import requests
import time
import ssl
from datetime import datetime

# MQTT Configuration
MQTT_BROKER = "mqtt.astrodev.cloud"
MQTT_PORT = 443
MQTT_USERNAME = "astrodev"
MQTT_PASSWORD = "Astroboy26@"
MQTT_TRANSPORT = "websockets"

# Supabase Configuration
SUPABASE_URL = "https://gdmvqskgtdpsktuhsnal.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkbXZxc2tndGRwc2t0dWhzbmFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM5NzU1NzEsImV4cCI6MjA0OTU1MTU3MX0.Hs6Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_EjLangkah selanjutnya adalah melakukan pengujian end-to-end untuk memastikan seluruh sistem berjalan dengan baik. Berikut langkah-langkah yang harus dilakukan:

1. Jalankan MQTT bridge script (`examples/mqtt-to-supabase/mqtt_bridge.py`) dengan konfigurasi Supabase URL dan Anon Key yang sudah benar.

2. Jalankan script generator device status dummy (`examples/device-status-dummy/mqtt_device_status.py`) untuk mengirim data MQTT ke broker.

3. Pastikan data device status dan sensor masuk ke tabel `device_status` dan `sensor_readings` di Supabase.

4. Buka halaman Monitoring di aplikasi untuk memverifikasi data realtime tampil dengan benar, termasuk device status cards, grafik, dan fitur export Excel.

5. Periksa log Edge Function `mqtt-data-handler` di Supabase untuk memastikan tidak ada error saat menerima dan menyimpan data.

6. Lakukan pengujian pada berbagai skenario, seperti device online/offline, perubahan battery, dan OTA update.


class MQTTToSupabaseBridge:
    def __init__(self):
        self.client = mqtt.Client(transport=MQTT_TRANSPORT)
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_disconnect = self.on_disconnect
        self.running = False
        
        # Set username and password
        self.client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
        
        # Set TLS for WSS
        self.client.tls_set(tls_version=ssl.PROTOCOL_TLS)
    
    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            print("✅ Connected to MQTT Broker successfully")
            self.running = True
            
            # Subscribe to topics
            client.subscribe("iot/devices/+/data")
            client.subscribe("iot/devices/+/status")
            print("📡 Subscribed to MQTT topics")
        else:
            print(f"❌ Failed to connect to MQTT Broker. Return code: {rc}")
    
    def on_disconnect(self, client, userdata, rc):
        print("🔌 Disconnected from MQTT Broker")
        self.running = False
    
    def on_message(self, client, userdata, msg):
        try:
            topic = msg.topic
            payload = msg.payload.decode('utf-8')
            
            print(f"📨 Received: {topic} -> {payload}")
            
            # Send to Supabase Edge Function
            self.send_to_supabase(topic, payload)
            
        except Exception as e:
            print(f"❌ Error processing message: {e}")
    
    def send_to_supabase(self, topic, payload):
        try:
            headers = {
                'Authorization': f'Bearer {SUPABASE_ANON_KEY}',
                'Content-Type': 'application/json'
            }
            
            data = {
                'topic': topic,
                'payload': payload
            }
            
            response = requests.post(EDGE_FUNCTION_URL, json=data, headers=headers)
            
            if response.status_code == 200:
                print(f"✅ Data sent to Supabase successfully")
            else:
                print(f"❌ Failed to send to Supabase: {response.status_code} - {response.text}")
                
        except Exception as e:
            print(f"❌ Error sending to Supabase: {e}")
    
    def connect(self):
        """Connect to MQTT broker"""
        try:
            print(f"🔗 Connecting to MQTT Broker at {MQTT_BROKER}:{MQTT_PORT}")
            self.client.connect(MQTT_BROKER, MQTT_PORT, 60)
            self.client.loop_start()
            time.sleep(2)  # Wait for connection
            return self.running
        except Exception as e:
            print(f"❌ Connection error: {e}")
            return False
    
    def disconnect(self):
        """Disconnect from MQTT broker"""
        self.running = False
        self.client.loop_stop()
        self.client.disconnect()
    
    def run_bridge(self):
        """Run the MQTT to Supabase bridge"""
        if not self.connect():
            return
        
        print("🌉 MQTT to Supabase Bridge started")
        print("📡 Listening for MQTT messages and forwarding to Supabase...")
        print("Press Ctrl+C to stop")
        print("=" * 60)
        
        try:
            while self.running:
                time.sleep(1)
                
        except KeyboardInterrupt:
            print("\n🛑 Bridge stopped by user")
        finally:
            self.disconnect()
            print("✅ Bridge stopped")

def main():
    print("🌉 MQTT to Supabase Bridge")
    print("==========================")
    print(f"📡 MQTT Broker: {MQTT_BROKER}:{MQTT_PORT}")
    print(f"🗄️  Supabase URL: {SUPABASE_URL}")
    print()
    print("⚠️  IMPORTANT: Update SUPABASE_URL and SUPABASE_ANON_KEY in this script!")
    print()
    
    # Check configuration
    if "your-project-id" in SUPABASE_URL or "your-anon-key" in SUPABASE_ANON_KEY:
        print("❌ Please update SUPABASE_URL and SUPABASE_ANON_KEY in the script!")
        return
    
    bridge = MQTTToSupabaseBridge()
    bridge.run_bridge()

if __name__ == "__main__":
    main()
