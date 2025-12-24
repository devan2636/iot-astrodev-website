import paho.mqtt.client as mqtt
import json
import random
import time
from datetime import datetime, timedelta
import sys
import os
from typing import Dict, Tuple, Optional

# --- KONFIGURASI MQTT ---
MQTT_BROKER = os.getenv("MQTT_BROKER", "147.139.247.39")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
MQTT_USERNAME = os.getenv("MQTT_USERNAME", "astrodev")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "Astroboy26@")

# --- DEBUG MODE ---
DEBUG = os.getenv("DEBUG", "False").lower() == "true"

# --- DEFINISI SKENARIO ---
SCENARIOS = {
    "NORMAL": {
        "desc": "✅ AMAN (Air Rendah, Cerah)",
        "water_range": (5.0, 19.0),
        "rain_range": (0.0, 0.0),
        "batt_range": (80, 100)
    },
    "WASPADA": {
        "desc": "⚠️ WASPADA (Air Sedang, Hujan Ringan)",
        "water_range": (20.5, 39.5),
        "rain_range": (1.0, 5.0),
        "batt_range": (60, 80)
    },
    "BAHAYA": {
        "desc": "🚨 BAHAYA (Banjir, Hujan Deras)",
        "water_range": (41.0, 65.0),
        "rain_range": (10.0, 20.0),
        "batt_range": (40, 60)
    },
    "EXTREME_WEATHER": {
        "desc": "⛈️ CUACA EKSTREM (Air Normal, Hujan Badai)",
        "water_range": (10.0, 18.0),
        "rain_range": (25.0, 50.0),
        "batt_range": (50, 70)
    }
}

# --- DAFTAR DEVICE ---
DEVICES = [
    {"id": "51c11d31-1e00-47a5-b5fe-646bda4c3317", "name": "AWLR 1 (Pos 1)", "scenario": "NORMAL", "uptime": 3660},
    {"id": "aac7d59f-595f-4b61-83bd-cab4641f3ab7", "name": "AWLR 2 (Pos 2)", "scenario": "WASPADA", "uptime": 7200},
    {"id": "a76ad429-b475-4baa-8876-76a4ab0909d9", "name": "AWLR 3 (Pos 3)", "scenario": "BAHAYA", "uptime": 14400},
    {"id": "1c7ab70e-3805-4a42-a786-25c31749e9f8", "name": "AWLR 4 (Pos 4)", "scenario": "EXTREME_WEATHER", "uptime": 1980}
]

class DeviceManualTrigger:
    def __init__(self):
        self.client = mqtt.Client()
        self.client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
        self.client.on_connect = self.on_connect
        self.client.on_disconnect = self.on_disconnect
        self.connected = False
        self.reconnect_count = 0
        self.max_reconnect = 3

    def on_connect(self, client, userdata, flags, rc, properties=None):
        if rc == 0:
            self.connected = True
            self.reconnect_count = 0
            print("✅ MQTT Connected successfully!")
        else:
            self.connected = False
            print(f"❌ MQTT Connection failed with code {rc}")

    def on_disconnect(self, client, userdata, rc, properties=None):
        self.connected = False
        if rc != 0:
            print(f"⚠️ Unexpected disconnection ({rc}). Attempting to reconnect...")
        else:
            print("🔌 Disconnected from MQTT broker")

    def connect(self) -> bool:
        """Connect to MQTT broker with retry logic"""
        try:
            print(f"🔗 Connecting to {MQTT_BROKER}:{MQTT_PORT}...")
            self.client.connect(MQTT_BROKER, MQTT_PORT, 60)
            self.client.loop_start()
            
            # Wait for connection
            for i in range(10):
                time.sleep(0.5)
                if self.connected:
                    print("✅ Connected!")
                    return True
            
            if not self.connected:
                print("❌ Connection timeout. Check broker address and credentials.")
                return False
                
        except ConnectionRefusedError:
            print(f"❌ Connection refused. Is MQTT broker running at {MQTT_BROKER}:{MQTT_PORT}?")
            return False
        except Exception as e:
            print(f"❌ Connection Error: {type(e).__name__}: {e}")
            return False

    def disconnect(self):
        """Safely disconnect from MQTT"""
        if self.connected:
            print("🔌 Disconnecting...")
            self.client.loop_stop()
            self.client.disconnect()
            time.sleep(1)
            print("✅ Disconnected")

    def get_simulated_values(self, scenario_key: str) -> Tuple[float, float, int]:
        """Generate simulated sensor values based on scenario"""
        if scenario_key not in SCENARIOS:
            raise ValueError(f"Unknown scenario: {scenario_key}")
        
        scenario = SCENARIOS[scenario_key]
        water = round(random.uniform(*scenario["water_range"]), 2)
        rain = round(random.uniform(*scenario["rain_range"]), 1)
        batt_min, batt_max = scenario["batt_range"]
        battery = random.randint(batt_min, batt_max)
        return water, rain, battery

    def send_data(self, device_index: int) -> bool:
        """Send MQTT data for selected device"""
        if not self.connected:
            print("❌ Not connected to MQTT broker!")
            return False
            
        if device_index < 0 or device_index >= len(DEVICES):
            print("❌ Invalid Selection!")
            return False

        try:
            dev = DEVICES[device_index]

            # 1. Generate Data
            water, rain, battery = self.get_simulated_values(dev["scenario"])
            dev["uptime"] += 60
            wifi_rssi = random.randint(-85, -45)
            free_heap = random.randint(80000, 120000)

            # 2. Timestamp WIB
            utc_now = datetime.utcnow()
            wib_time = utc_now + timedelta(hours=7)
            current_timestamp = wib_time.isoformat() + "Z"

            # 3. Payload Sensor (Data)
            sensor_payload = {
                "ketinggian_air": water,
                "curah_hujan": rain,
                "timestamp": current_timestamp
            }

            # 4. Payload Status
            status_payload = {
                "status": "online",
                "battery": battery,
                "wifi_rssi": wifi_rssi,
                "uptime": dev["uptime"],
                "free_heap": free_heap,
                "ota_update": "idle",
                "timestamp": current_timestamp
            }

            # 5. Topik
            topic_data = f"iot/devices/{dev['id']}/data"
            topic_status = f"iot/devices/{dev['id']}/status"

            # 6. Publish
            print(f"\n📤 Mengirim ke {dev['name']}...")

            # Kirim ke topik data
            info_data = self.client.publish(topic_data, json.dumps(sensor_payload))
            if info_data.rc != mqtt.MQTT_ERR_SUCCESS:
                print(f"   ❌ Failed to publish to {topic_data}")
                return False

            # Kirim ke topik status
            info_status = self.client.publish(topic_status, json.dumps(status_payload), retain=True)
            if info_status.rc != mqtt.MQTT_ERR_SUCCESS:
                print(f"   ❌ Failed to publish to {topic_status}")
                return False

            print(f"   🌊 Water: {water} cm | 🌧 Rain: {rain} mm")
            print(f"   🔋 Batt: {battery}% | 📶 RSSI: {wifi_rssi} dBm | ⏱️ Uptime: {dev['uptime']}s")
            print(f"   📍 DeviceID: {dev['id']}")
            print("✅ Berhasil! Data telah dikirim ke MQTT broker.\n")
            
            if DEBUG:
                print(f"[DEBUG] Sensor payload: {sensor_payload}")
                print(f"[DEBUG] Status payload: {status_payload}\n")
            
            return True
            
        except Exception as e:
            print(f"❌ Error sending data: {type(e).__name__}: {e}")
            return False

    def show_menu(self):
        """Interactive menu for device selection and testing"""
        while True:
            try:
                print("="*60)
                print("   🎛️  ASTRODEV CONTROL PANEL - AWLR MQTT SIMULATOR")
                print("="*60)
                print(f"   Status: {'🟢 Connected' if self.connected else '🔴 Disconnected'}")
                print(f"   Broker: {MQTT_BROKER}:{MQTT_PORT}")
                print("="*60)
                
                for i, dev in enumerate(DEVICES):
                    sc_desc = SCENARIOS[dev['scenario']]['desc']
                    print(f"[{i+1}] {dev['name']:<30} -> {sc_desc}")
                
                print("[A] Send ALL devices")
                print("[R] Reconnect")
                print("[0] Exit")
                print("-" * 60)

                choice = input("Pilih Device: ").strip().upper()
                
                if choice == '0':
                    print("Keluar...")
                    break
                elif choice == 'R':
                    self.disconnect()
                    time.sleep(1)
                    if not self.connect():
                        print("Failed to reconnect. Please check your configuration.")
                elif choice == 'A':
                    print("\n📤 Sending data to ALL devices...")
                    for idx in range(len(DEVICES)):
                        self.send_data(idx)
                        time.sleep(1)
                else:
                    try:
                        idx = int(choice) - 1
                        self.send_data(idx)
                    except ValueError:
                        print("❌ Invalid input. Please enter a number.")
                
                if choice not in ['0', 'R']:
                    input("Press Enter to continue...")
                    
            except KeyboardInterrupt:
                print("\n\nInterrupted by user.")
                break
            except Exception as e:
                print(f"❌ Menu error: {e}")
                continue

    def run(self):
        """Main entry point"""
        print("\n" + "="*60)
        print("   🌊 AWLR MQTT Dummy Sensor Simulator")
        print("="*60 + "\n")
        
        if not self.connect():
            print("\n❌ Failed to connect to MQTT broker.")
            print(f"Make sure:")
            print(f"  - Broker is running at {MQTT_BROKER}:{MQTT_PORT}")
            print(f"  - Username: {MQTT_USERNAME}")
            print(f"  - Network connectivity is OK")
            return
        
        try:
            self.show_menu()
        finally:
            self.disconnect()