import paho.mqtt.client as mqtt
import json
import random
import time
from datetime import datetime
import threading
import ssl
import pandas as pd
import os
# Di bagian paling atas file
from datetime import datetime, timezone

# MQTT Configuration
MQTT_BROKER = "147.139.247.39"
MQTT_PORT = 1883
MQTT_USERNAME = None
MQTT_PASSWORD = None
MQTT_TRANSPORT = "tcp"

# Device list with initial status and parameters
DEVICES = [
    {
        "id": "ff0920f2-95ee-42e6-a2a3-64df3f804942",
        "name": "ESP32-Firebase Test",
        "status": "online",
        "battery": 100,
        "wifi_rssi": -70,
        "uptime": 0,
        "free_heap": 120000,
        "ota_update": None
    },
    {
        "id": "086e7e43-9a40-437e-8ffd-fc029aa86d9a",
        "name": "AWLR",
        "status": "online",
        "battery": 85,
        "wifi_rssi": -86,
        "uptime": 5280,
        "free_heap": 94000,
        "ota_update": "updating"
    },
    {
        "id": "5cef40a-5e73-4602-8d46-e93e694db47f",
        "name": "Weather Station 2",
        "status": "online",
        "battery": 5,
        "wifi_rssi": -95,
        "uptime": 2040,
        "free_heap": 79000,
        "ota_update": "updating"
    },
    {
        "id": "f2b0150e-9e05-4ec1-b95f-82126b16e158",
        "name": "Weather Station",
        "status": "online",
        "battery": 5,
        "wifi_rssi": -100,
        "uptime": 9420,
        "free_heap": 125000,
        "ota_update": None
    },
    {
        "id": "2d6ea74e-3235-435e-8e4f-e6965f1ce2e1",
        "name": "ESP32-Weather",
        "status": "online",
        "battery": 5,
        "wifi_rssi": -100,
        "uptime": 7440,
        "free_heap": 90000,
        "ota_update": "available"
    },
    {
        "id": "ab74435f-1ff7-45b3-a2bf-67b8a8bcc87e",
        "name": "ESP32-LoRa",
        "status": "online",
        "battery": 5,
        "wifi_rssi": -95,
        "uptime": 5580,
        "free_heap": 98000,
        "ota_update": "updating"
    },
    {
        "id": "34168ffc-17fe-4a79-bec9-7b3386700cf9",
        "name": "ESP32",
        "status": "online",
        "battery": 5,
        "wifi_rssi": -99,
        "uptime": 14760,
        "free_heap": 133000,
        "ota_update": "up_to_date"
    },
    {
        "id": "00000000-0000-4000-a000-000000000001",
        "name": "Test Device 0001",
        "status": "online",
        "battery": 100,
        "wifi_rssi": None,
        "uptime": 0,
        "free_heap": None,
        "ota_update": None
    },
    {
        "id": "00000000-0000-4000-a000-000000000002",
        "name": "Test Device 0002",
        "status": "online",
        "battery": 5,
        "wifi_rssi": -85,
        "uptime": 3600,
        "free_heap": 8000,
        "ota_update": None
    }
]

# Thresholds for event monitoring
THRESHOLDS = {
    "battery_critical": 10,
    "battery_low": 20,
    "wifi_weak": -80,
    "memory_low": 10000  # in bytes
}

# Event types
EVENTS = {
    "battery_critical": "Battery Critical (Error)",
    "battery_low": "Low Battery Warning",
    "wifi_weak": "Weak WiFi Signal",
    "memory_low": "Low Memory Warning",
    "device_connected": "Device Connected"
}

class DeviceStatusSimulator:
    def __init__(self):
        self.client = mqtt.Client(transport=MQTT_TRANSPORT)
        self.client.on_connect = self.on_connect
        self.client.on_disconnect = self.on_disconnect
        self.client.on_publish = self.on_publish
        self.running = False
        self.device_data_log = []  # Store published data for export and monitoring
        self.alert_log = []  # Store alerts generated

        # Set username and password
        self.client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

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
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    def generate_device_status(self, device):
        """Generate device status data with simulated changes"""
        # Simulate battery drain
        battery_change = random.randint(-3, 0)  # Battery usually drains or stays
        new_battery = max(0, min(100, device["battery"] + battery_change))

        # Simulate WiFi signal fluctuation
        wifi_change = random.randint(-5, 5)
        if device["wifi_rssi"] is not None:
            new_wifi_rssi = max(-100, min(-30, device["wifi_rssi"] + wifi_change))
        else:
            new_wifi_rssi = None

        # Increase uptime
        new_uptime = device["uptime"] + random.randint(60, 300)  # Add 1-5 minutes

        # Simulate memory usage fluctuation
        if device["free_heap"] is not None:
            heap_change = random.randint(-5000, 3000)
            new_free_heap = max(0, device["free_heap"] + heap_change)
        else:
            new_free_heap = None

        # Simulate OTA update status change randomly
        ota_options = ["available", "up_to_date", "updating", None]
        new_ota_update = random.choice(ota_options)

        # Update device data
        device["battery"] = new_battery
        device["wifi_rssi"] = new_wifi_rssi
        device["uptime"] = new_uptime
        device["free_heap"] = new_free_heap
        device["ota_update"] = new_ota_update

        return {
            "status": device["status"],
            "battery": new_battery,
            "wifi_rssi": new_wifi_rssi,
            "uptime": new_uptime,
            "free_heap": new_free_heap,
            "ota_update": new_ota_update,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    def check_events(self, device, status_data):
        """Check device status against thresholds and generate alerts"""
        alerts = []

        if status_data["battery"] is not None:
            if status_data["battery"] < THRESHOLDS["battery_critical"]:
                alerts.append((device["id"], EVENTS["battery_critical"], f"Battery level {status_data['battery']}%"))
            elif status_data["battery"] < THRESHOLDS["battery_low"]:
                alerts.append((device["id"], EVENTS["battery_low"], f"Battery level {status_data['battery']}%"))

        if status_data["wifi_rssi"] is not None and status_data["wifi_rssi"] < THRESHOLDS["wifi_weak"]:
            alerts.append((device["id"], EVENTS["wifi_weak"], f"WiFi RSSI {status_data['wifi_rssi']} dBm"))

        if status_data["free_heap"] is not None and status_data["free_heap"] < THRESHOLDS["memory_low"]:
            alerts.append((device["id"], EVENTS["memory_low"], f"Free memory {status_data['free_heap']} bytes"))

        # Device connected event
        if device["status"] == "online":
            alerts.append((device["id"], EVENTS["device_connected"], "Device is online"))

        # Log alerts
        for alert in alerts:
            alert_entry = {
                "device_id": alert[0],
                "event": alert[1],
                "message": alert[2],
                "timestamp": datetime.now().isoformat()
            }
            self.alert_log.append(alert_entry)
            print(f"🔔 ALERT: {alert_entry['event']} for device {device['name']} - {alert_entry['message']}")

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
                # Log data
                self.device_data_log.append({
                    "device_id": device["id"],
                    "device_name": device["name"],
                    "type": "sensor",
                    "data": sensor_data,
                    "timestamp": sensor_data["timestamp"]
                })
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
                # Log data
                self.device_data_log.append({
                    "device_id": device["id"],
                    "device_name": device["name"],
                    "type": "status",
                    "data": status_data,
                    "timestamp": status_data["timestamp"]
                })
                # Check for alerts
                self.check_events(device, status_data)
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

    def export_data_to_excel(self, filename="device_data_log.xlsx"):
        """Export logged device data and alerts to Excel file"""
        if not self.device_data_log and not self.alert_log:
            print("⚠️ No data or alerts to export")
            return

        # Prepare dataframes
        data_records = []
        for entry in self.device_data_log:
            record = {
                "Device ID": entry["device_id"],
                "Device Name": entry["device_name"],
                "Type": entry["type"],
                "Timestamp": entry["timestamp"]
            }
            record.update(entry["data"])
            data_records.append(record)

        alerts_records = []
        for alert in self.alert_log:
            alerts_records.append({
                "Device ID": alert["device_id"],
                "Event": alert["event"],
                "Message": alert["message"],
                "Timestamp": alert["timestamp"]
            })

        df_data = pd.DataFrame(data_records)
        df_alerts = pd.DataFrame(alerts_records)

        with pd.ExcelWriter(filename) as writer:
            df_data.to_excel(writer, sheet_name="Device Data", index=False)
            df_alerts.to_excel(writer, sheet_name="Alerts", index=False)

        print(f"📥 Data and alerts exported to {filename}")

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
            self.export_data_to_excel()
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
            self.export_data_to_excel()
            self.disconnect()
            print("✅ Simulation completed")

def main():
    print("🚀 MQTT Device Status Simulator with Monitoring and Alerts")
    print("=========================================================")
    print(f"📡 MQTT Broker: {MQTT_BROKER}:{MQTT_PORT}")
    print(f"📱 Devices: {len(DEVICES)}")

    for device in DEVICES:
        print(f"   - {device['name']} ({device['id'][:8]}...)")

    print("\nMake sure to update MQTT_BROKER, MQTT_USERNAME, and MQTT_PASSWORD if needed!")

    simulator = DeviceStatusSimulator()

    while True:
        choice = input(
            "\nChoose simulation mode:\n"
            "1. Run for specific duration\n"
            "2. Run continuously\n"
            "3. Export logged data to Excel\n"
            "4. Exit\n"
            "Enter choice (1-4): "
        )

        if choice == "1":
            duration = int(input("Enter duration in minutes (default 60): ") or "60")
            interval = int(input("Enter interval in seconds (default 30): ") or "30")
            simulator.run_simulation(duration, interval)
        elif choice == "2":
            interval = int(input("Enter interval in seconds (default 60): ") or "60")
            simulator.run_continuous(interval)
        elif choice == "3":
            filename = input("Enter filename for Excel export (default device_data_log.xlsx): ") or "device_data_log.xlsx"
            simulator.export_data_to_excel(filename)
        elif choice == "4":
            print("Exiting simulator.")
            break
        else:
            print("Invalid choice!")

if __name__ == "__main__":
    main()
