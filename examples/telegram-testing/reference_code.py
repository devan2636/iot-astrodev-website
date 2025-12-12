import paho.mqtt.client as mqtt
import json
import random
import time
from datetime import datetime
import threading
import ssl

# MQTT Configuration
MQTT_BROKER = "mqtt.astrodev.cloud"
MQTT_PORT = 443
MQTT_USERNAME = "astrodev"
MQTT_PASSWORD = "Astroboy26@"
MQTT_TRANSPORT = "websockets"

# Device IDs yang sudah ada
DEVICES = [
    {
        "id": "086e7e43-9a40-437e-8ffd-fc029aa86d9a",
        "name": "AWLR",
        "status": "online",
        "battery": 85,
        "wifi_rssi": -65,
        "uptime": 3600,
        "free_heap": 123456
    },
    {
        "id": "2d6ea74e-3235-435e-8e4f-e6965f1ce2e1",
        "name": "ESP32-Weather",
        "status": "online",
        "battery": 72,
        "wifi_rssi": -58,
        "uptime": 7200,
        "free_heap": 98765
    },
    {
        "id": "34168ffc-17fe-4a79-bec9-7b3386700cf9",
        "name": "ESP32",
        "status": "online",
        "battery": 90,
        "wifi_rssi": -45,
        "uptime": 14400,
        "free_heap": 145000
    },
    {
        "id": "65cef40a-5e73-4602-8d46-e93e694db47f",
        "name": "Weather Station 2",
        "status": "offline",
        "battery": 45,
        "wifi_rssi": -78,
        "uptime": 1800,
        "free_heap": 87654
    },
    {
        "id": "ab74435f-1ff7-45b3-a2bf-67b8a8bcc87e",
        "name": "ESP32-LoRa",
        "status": "online",
        "battery": 68,
        "wifi_rssi": -62,
        "uptime": 5400,
        "free_heap": 112000
    },
    {
        "id": "f2b0150e-9e05-4ec1-b95f-82126b16e158",
        "name": "Weather Station",
        "status": "online",
        "battery": 78,
        "wifi_rssi": -55,
        "uptime": 9000,
        "free_heap": 134000
    }
]

class DeviceStatusSimulator:
    def __init__(self):
        self.client = mqtt.Client(transport=MQTT_TRANSPORT)
        self.client.on_connect = self.on_connect
        self.client.on_disconnect = self.on_disconnect
        self.client.on_publish = self.on_publish
        self.running = False

        # Set username and password
        self.client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

        # Set TLS for WSS
        self.client.tls_set(tls_version=ssl.PROTOCOL_TLS)

    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            print("✅ Connected to MQTT Broker successfully")
            self.running = True
        else:
            print(f"❌ Failed to connect to MQTT Broker. Return code: {rc}")

    def on_disconnect(self, client, userdata, rc):
        print("🔌 Disconnected from MQTT Broker")
        self.running = False

    def on_publish(self, client, userdata, mid):
        print(f"📤 Message published with ID: {mid}")

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

    def generate_sensor_data(self, device):
        """Generate random sensor data for a device"""
        return {
            "temperature": round(random.uniform(20, 35), 1),
            "humidity": round(random.uniform(40, 80), 1),
            "pressure": round(random.uniform(1000, 1020), 1),
            "timestamp": datetime.now().isoformat()
        }

    def generate_device_status(self, device):
        """Generate device status data"""
        # Simulate battery drain
        battery_change = random.randint(-2, 1)  # Battery usually drains
        new_battery = max(10, min(100, device["battery"] + battery_change))

        # Simulate WiFi signal fluctuation
        wifi_change = random.randint(-10, 10)
        new_wifi_rssi = max(-100, min(-30, device["wifi_rssi"] + wifi_change))

        # Increase uptime
        new_uptime = device["uptime"] + random.randint(60, 300)  # Add 1-5 minutes

        # Simulate memory usage fluctuation
        heap_change = random.randint(-10000, 5000)
        new_free_heap = max(50000, device["free_heap"] + heap_change)

        # Update device data
        device["battery"] = new_battery
        device["wifi_rssi"] = new_wifi_rssi
        device["uptime"] = new_uptime
        device["free_heap"] = new_free_heap

        return {
            "status": device["status"],
            "battery": new_battery,
            "wifi_rssi": new_wifi_rssi,
            "uptime": new_uptime,
            "free_heap": new_free_heap,
            "ota_update": random.choice(["available", "up_to_date", "updating", None]),
            "timestamp": datetime.now().isoformat()
        }

    def publish_sensor_data(self, device):
        """Publish sensor data for a device"""
        if device["status"] != "online":
            return

        sensor_data = self.generate_sensor_data(device)
        topic = f"iot/devices/{device['id']}/data"

        try:
            result = self.client.publish(topic, json.dumps(sensor_data))
            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                print(f"📊 Sensor data sent for {device['name']}: T={sensor_data['temperature']}°C, H={sensor_data['humidity']}%")
            else:
                print(f"❌ Failed to publish sensor data for {device['name']}")
        except Exception as e:
            print(f"❌ Error publishing sensor data: {e}")

    def publish_device_status(self, device):
        """Publish device status"""
        status_data = self.generate_device_status(device)
        topic = f"iot/devices/{device['id']}/status"

        try:
            result = self.client.publish(topic, json.dumps(status_data))
            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                print(f"🔋 Status sent for {device['name']}: Battery={status_data['battery']}%, WiFi={status_data['wifi_rssi']}dBm")
            else:
                print(f"❌ Failed to publish status for {device['name']}")
        except Exception as e:
            print(f"❌ Error publishing device status: {e}")

    def simulate_device_offline(self, device):
        """Randomly simulate device going offline/online"""
        if random.randint(1, 20) == 1:  # 5% chance
            if device["status"] == "online":
                device["status"] = "offline"
                print(f"🔴 {device['name']} went OFFLINE")
            else:
                device["status"] = "online"
                print(f"🟢 {device['name']} came ONLINE")

    def run_simulation(self, duration_minutes=60, interval_seconds=30):
        """Run the simulation for specified duration"""
        if not self.connect():
            return

        print(f"🚀 Starting device status simulation for {duration_minutes} minutes")
        print(f"📡 Publishing data every {interval_seconds} seconds")
        print("=" * 60)

        start_time = time.time()
        end_time = start_time + (duration_minutes * 60)
        cycle_count = 0

        try:
            while time.time() < end_time and self.running:
                cycle_count += 1
                print(f"\n🔄 Cycle {cycle_count} - {datetime.now().strftime('%H:%M:%S')}")

                for device in DEVICES:
                    # Randomly simulate device status changes
                    self.simulate_device_offline(device)

                    # Publish device status
                    self.publish_device_status(device)

                    # Publish sensor data (only if online)
                    self.publish_sensor_data(device)

                    time.sleep(1)  # Small delay between devices

                print(f"⏱️  Waiting {interval_seconds} seconds for next cycle...")
                time.sleep(interval_seconds)

        except KeyboardInterrupt:
            print("\n🛑 Simulation stopped by user")
        finally:
            self.disconnect()
            print("✅ Simulation completed")

    def run_continuous(self, interval_seconds=60):
        """Run continuous simulation"""
        if not self.connect():
            return

        print(f"🔄 Starting continuous device status simulation")
        print(f"📡 Publishing data every {interval_seconds} seconds")
        print("Press Ctrl+C to stop")
        print("=" * 60)

        cycle_count = 0

        try:
            while self.running:
                cycle_count += 1
                print(f"\n🔄 Cycle {cycle_count} - {datetime.now().strftime('%H:%M:%S')}")

                for device in DEVICES:
                    # Randomly simulate device status changes
                    self.simulate_device_offline(device)

                    # Publish device status
                    self.publish_device_status(device)

                    # Publish sensor data (only if online)
                    self.publish_sensor_data(device)

                    time.sleep(1)  # Small delay between devices

                print(f"⏱️  Waiting {interval_seconds} seconds for next cycle...")
                time.sleep(interval_seconds)

        except KeyboardInterrupt:
            print("\n🛑 Simulation stopped by user")
        finally:
            self.disconnect()
            print("✅ Simulation completed")

def main():
    print("🚀 MQTT Device Status Simulator")
    print("===============================")
    print(f"📡 MQTT Broker: {MQTT_BROKER}:{MQTT_PORT}")
    print(f"📱 Devices: {len(DEVICES)}")

    for device in DEVICES:
        print(f"   - {device['name']} ({device['id'][:8]}...)")

    print("\nMake sure to update MQTT_BROKER, MQTT_USERNAME, and MQTT_PASSWORD if needed!")

    simulator = DeviceStatusSimulator()

    choice = input("\nChoose simulation mode:\n1. Run for specific duration\n2. Run continuously\n3. Test connection only\nEnter choice (1-3): ")

    if choice == "1":
        duration = int(input("Enter duration in minutes (default 60): ") or "60")
        interval = int(input("Enter interval in seconds (default 30): ") or "30")
        simulator.run_simulation(duration, interval)
    elif choice == "2":
        interval = int(input("Enter interval in seconds (default 60): ") or "60")
        simulator.run_continuous(interval)
    elif choice == "3":
        if simulator.connect():
            print("✅ Connection test successful!")
            time.sleep(2)
            simulator.disconnect()
        else:
            print("❌ Connection test failed!")
    else:
        print("Invalid choice!")

if __name__ == "__main__":
    main()
