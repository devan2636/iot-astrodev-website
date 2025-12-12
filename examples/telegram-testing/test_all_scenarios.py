import paho.mqtt.client as mqtt
import json
import time
from datetime import datetime
import ssl
import random
import threading
import queue

# MQTT Configuration
MQTT_BROKER = "mqtt.astrodev.cloud"
MQTT_PORT = 443
MQTT_USERNAME = "astrodev"
MQTT_PASSWORD = "Astroboy26@"
MQTT_TRANSPORT = "websockets"

# Test devices
test_devices = [
    {
        "id": "65cef40a-5e73-4602-8d46-e93e694db47f",
        "name": "Weather Station 2 POLBAN",
        "type": "weather-station"
    },
    {
        "id": "f2b0150e-9e05-4ec1-b95f-82126b16e158",
        "name": "Weather Station ITB",
        "type": "sensor-node"
    },
    {
        "id": "2d6ea74e-3235-435e-8e4f-e6965f1ce2e1",
        "name": "ESP32-Weather",
        "type": "esp32-lora"
    }
]

class MQTTTester:
    def __init__(self):
        self.client = mqtt.Client(transport=MQTT_TRANSPORT)
        self.client.on_connect = self.on_connect
        self.client.on_disconnect = self.on_disconnect
        self.client.on_publish = self.on_publish
        self.connected = False
        self.message_queue = queue.Queue()
        
        # Set credentials
        self.client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
        self.client.tls_set(tls_version=ssl.PROTOCOL_TLS)
    
    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            print("✅ Connected to MQTT Broker")
            self.connected = True
        else:
            print(f"❌ Failed to connect. Return code: {rc}")
    
    def on_disconnect(self, client, userdata, rc):
        print("🔌 Disconnected from MQTT Broker")
        self.connected = False
    
    def on_publish(self, client, userdata, mid):
        print(f"   📤 Message published (ID: {mid})")
    
    def connect(self):
        try:
            print(f"🔗 Connecting to {MQTT_BROKER}:{MQTT_PORT}")
            self.client.connect(MQTT_BROKER, MQTT_PORT, 60)
            self.client.loop_start()
            time.sleep(3)
            return self.connected
        except Exception as e:
            print(f"❌ Connection error: {e}")
            return False
    
    def disconnect(self):
        self.client.loop_stop()
        self.client.disconnect()
    
    def publish_message(self, topic, payload):
        try:
            result = self.client.publish(topic, json.dumps(payload))
            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                print(f"   ✅ Message sent to {topic}")
                return True
            else:
                print(f"   ❌ Failed to send message (rc: {result.rc})")
                return False
        except Exception as e:
            print(f"   ❌ Error: {e}")
            return False

    def test_alert_conditions(self):
        """Test various alert conditions"""
        print("\n🚨 Testing Alert Conditions")
        print("=" * 40)
        
        alert_scenarios = [
            {
                "name": "Critical Battery",
                "device": test_devices[0],
                "payload": {
                    "status": "online",
                    "battery": 5,  # Critical < 10%
                    "wifi_rssi": -75,
                    "uptime": 3600,
                    "free_heap": 123456,
                    "timestamp": datetime.now().isoformat()
                }
            },
            {
                "name": "Warning Battery",
                "device": test_devices[1],
                "payload": {
                    "status": "online",
                    "battery": 15,  # Warning < 20%
                    "wifi_rssi": -75,
                    "uptime": 3600,
                    "free_heap": 123456,
                    "timestamp": datetime.now().isoformat()
                }
            },
            {
                "name": "Weak WiFi",
                "device": test_devices[2],
                "payload": {
                    "status": "online",
                    "battery": 80,
                    "wifi_rssi": -89,  # Weak < -80 dBm
                    "uptime": 3600,
                    "free_heap": 123456,
                    "timestamp": datetime.now().isoformat()
                }
            }
        ]
        
        for scenario in alert_scenarios:
            print(f"\n📋 Testing: {scenario['name']}")
            print(f"   Device: {scenario['device']['name']}")
            topic = f"iot/devices/{scenario['device']['id']}/status"
            self.publish_message(topic, scenario['payload'])
            time.sleep(5)

    def test_sensor_alerts(self):
        """Test sensor data alerts"""
        print("\n🌡️ Testing Sensor Alerts")
        print("=" * 40)
        
        sensor_scenarios = [
            {
                "name": "Critical Temperature",
                "device": test_devices[0],
                "payload": {
                    "temperature": 45.5,  # Critical > 40°C
                    "humidity": 60.2,
                    "pressure": 1013.25,
                    "timestamp": datetime.now().isoformat()
                }
            },
            {
                "name": "Critical Humidity",
                "device": test_devices[1],
                "payload": {
                    "temperature": 25.5,
                    "humidity": 85.8,  # Critical > 80%
                    "pressure": 1013.25,
                    "timestamp": datetime.now().isoformat()
                }
            },
            {
                "name": "Critical Pressure",
                "device": test_devices[2],
                "payload": {
                    "temperature": 25.5,
                    "humidity": 60.2,
                    "pressure": 965.2,  # Critical < 970 hPa
                    "timestamp": datetime.now().isoformat()
                }
            }
        ]
        
        for scenario in sensor_scenarios:
            print(f"\n📋 Testing: {scenario['name']}")
            print(f"   Device: {scenario['device']['name']}")
            topic = f"iot/devices/{scenario['device']['id']}/data"
            self.publish_message(topic, scenario['payload'])
            time.sleep(5)

    def test_multiple_alerts(self):
        """Test multiple simultaneous alerts"""
        print("\n⚡ Testing Multiple Simultaneous Alerts")
        print("=" * 40)
        
        # Generate multiple alerts for same device
        device = test_devices[0]
        status_payload = {
            "status": "online",
            "battery": 8,  # Critical
            "wifi_rssi": -85,  # Weak
            "uptime": 3600,
            "free_heap": 8000,  # Low
            "timestamp": datetime.now().isoformat()
        }
        
        sensor_payload = {
            "temperature": 42.5,  # Critical
            "humidity": 85.8,  # Critical
            "pressure": 965.2,  # Critical
            "timestamp": datetime.now().isoformat()
        }
        
        print(f"\n📋 Testing multiple alerts for {device['name']}")
        print("   Expected: Multiple alerts in quick succession")
        
        # Send both payloads quickly
        status_topic = f"iot/devices/{device['id']}/status"
        data_topic = f"iot/devices/{device['id']}/data"
        
        self.publish_message(status_topic, status_payload)
        time.sleep(1)
        self.publish_message(data_topic, sensor_payload)
        time.sleep(5)

    def test_error_scenarios(self):
        """Test various error scenarios"""
        print("\n❌ Testing Error Scenarios")
        print("=" * 40)
        
        # Test 1: Invalid topic format
        print("\n📋 Testing: Invalid topic format")
        self.publish_message("invalid/topic", {"test": "data"})
        time.sleep(2)
        
        # Test 2: Invalid JSON payload
        print("\n📋 Testing: Invalid JSON payload")
        topic = f"iot/devices/{test_devices[0]['id']}/status"
        self.client.publish(topic, "invalid json data{")
        time.sleep(2)
        
        # Test 3: Missing required fields
        print("\n📋 Testing: Missing required fields")
        self.publish_message(topic, {"status": "online"})  # Missing other fields
        time.sleep(2)
        
        # Test 4: Invalid data types
        print("\n📋 Testing: Invalid data types")
        self.publish_message(topic, {
            "status": "online",
            "battery": "not a number",
            "wifi_rssi": "invalid",
            "uptime": "invalid",
            "timestamp": datetime.now().isoformat()
        })
        time.sleep(2)

def main():
    print("🚀 Starting Comprehensive MQTT Testing")
    print("=" * 50)
    
    tester = MQTTTester()
    
    if not tester.connect():
        print("❌ Cannot connect to MQTT broker")
        return
    
    try:
        # Test 1: Alert Conditions
        tester.test_alert_conditions()
        
        # Test 2: Sensor Alerts
        tester.test_sensor_alerts()
        
        # Test 3: Multiple Alerts
        tester.test_multiple_alerts()
        
        # Test 4: Error Scenarios
        tester.test_error_scenarios()
        
        print("\n" + "=" * 50)
        print("🎉 Testing completed!")
        print()
        print("📱 Check Telegram group for notifications:")
        print("   Group: Astrodev-IoT")
        print("   Chat ID: -4691595195")
        print()
        print("Expected Results:")
        print("1. Multiple device status alerts")
        print("2. Multiple sensor data alerts")
        print("3. Multiple simultaneous alerts")
        print("4. Error handling messages")
        print()
        print("🔍 If no alerts received, check:")
        print("1. mqtt-data-handler function logs")
        print("2. telegram-notifications function logs")
        print("3. Environment variables in Supabase")
        
    except KeyboardInterrupt:
        print("\n🛑 Testing stopped by user")
    finally:
        tester.disconnect()
        print("🔌 Disconnected from MQTT")

if __name__ == "__main__":
    main()
