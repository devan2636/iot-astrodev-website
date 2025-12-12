import paho.mqtt.client as mqtt
import json
import time
from datetime import datetime
import ssl

# MQTT Configuration
MQTT_BROKER = "mqtt.astrodev.cloud"
MQTT_PORT = 443
MQTT_USERNAME = "astrodev"
MQTT_PASSWORD = "Astroboy26@"
MQTT_TRANSPORT = "websockets"

class EndToEndTester:
    def __init__(self):
        self.client = mqtt.Client(transport=MQTT_TRANSPORT)
        self.client.on_connect = self.on_connect
        self.client.on_disconnect = self.on_disconnect
        self.client.on_publish = self.on_publish
        self.connected = False
        
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

    def test_critical_battery(self):
        """Test critical battery alert"""
        print("\n🔋 Testing Critical Battery Alert")
        print("=" * 40)
        
        device_id = "test-device-battery"
        payload = {
            "status": "online",
            "battery": 5,  # Critical < 10%
            "wifi_rssi": -75,
            "uptime": 3600,
            "free_heap": 123456,
            "timestamp": datetime.now().isoformat()
        }
        
        topic = f"iot/devices/{device_id}/status"
        print(f"📱 Device: {device_id}")
        print(f"🔋 Battery: {payload['battery']}% (Critical)")
        
        self.publish_message(topic, payload)
        print("⏳ Waiting for Telegram notification...")
        time.sleep(10)

    def test_critical_temperature(self):
        """Test critical temperature alert"""
        print("\n🌡️ Testing Critical Temperature Alert")
        print("=" * 40)
        
        device_id = "test-device-temp"
        payload = {
            "temperature": 45.5,  # Critical > 40°C
            "humidity": 60.2,
            "pressure": 1013.25,
            "timestamp": datetime.now().isoformat()
        }
        
        topic = f"iot/devices/{device_id}/data"
        print(f"📱 Device: {device_id}")
        print(f"🌡️ Temperature: {payload['temperature']}°C (Critical)")
        
        self.publish_message(topic, payload)
        print("⏳ Waiting for Telegram notification...")
        time.sleep(10)

    def test_multiple_alerts(self):
        """Test multiple alerts simultaneously"""
        print("\n⚡ Testing Multiple Alerts")
        print("=" * 40)
        
        device_id = "test-device-multi"
        
        # Critical battery status
        status_payload = {
            "status": "online",
            "battery": 8,  # Critical
            "wifi_rssi": -85,  # Weak
            "uptime": 3600,
            "free_heap": 8000,  # Low
            "timestamp": datetime.now().isoformat()
        }
        
        # Critical sensor data
        sensor_payload = {
            "temperature": 42.5,  # Critical
            "humidity": 85.8,  # Critical
            "pressure": 965.2,  # Critical
            "timestamp": datetime.now().isoformat()
        }
        
        print(f"📱 Device: {device_id}")
        print(f"🔋 Battery: {status_payload['battery']}% (Critical)")
        print(f"🌡️ Temperature: {sensor_payload['temperature']}°C (Critical)")
        print(f"💧 Humidity: {sensor_payload['humidity']}% (Critical)")
        print(f"🌪️ Pressure: {sensor_payload['pressure']} hPa (Critical)")
        
        # Send status first
        status_topic = f"iot/devices/{device_id}/status"
        self.publish_message(status_topic, status_payload)
        time.sleep(2)
        
        # Send sensor data
        data_topic = f"iot/devices/{device_id}/data"
        self.publish_message(data_topic, sensor_payload)
        
        print("⏳ Waiting for multiple Telegram notifications...")
        time.sleep(15)

def main():
    print("🚀 Starting End-to-End Telegram Testing")
    print("=" * 50)
    print()
    print("📋 Test Plan:")
    print("1. Critical Battery Alert (< 10%)")
    print("2. Critical Temperature Alert (> 40°C)")
    print("3. Multiple Simultaneous Alerts")
    print()
    print("📱 Expected: Telegram notifications in group 'Astrodev-IoT'")
    print("   Chat ID: -4691595195")
    print()
    
    tester = EndToEndTester()
    
    if not tester.connect():
        print("❌ Cannot connect to MQTT broker")
        return
    
    try:
        # Test 1: Critical Battery
        tester.test_critical_battery()
        
        # Test 2: Critical Temperature
        tester.test_critical_temperature()
        
        # Test 3: Multiple Alerts
        tester.test_multiple_alerts()
        
        print("\n" + "=" * 50)
        print("🎉 Testing completed!")
        print()
        print("📱 Check Telegram group for notifications:")
        print("   Group: Astrodev-IoT")
        print("   Chat ID: -4691595195")
        print()
        print("Expected notifications:")
        print("1. 🔋 Battery Critical (5%)")
        print("2. 🌡️ Temperature Critical (45.5°C)")
        print("3. 🔋 Battery Critical (8%)")
        print("4. 🌡️ Temperature Critical (42.5°C)")
        print("5. 💧 Humidity Critical (85.8%)")
        print("6. 🌪️ Pressure Critical (965.2 hPa)")
        print()
        print("🔍 If no alerts received:")
        print("1. Check mqtt-data-handler function logs in Supabase")
        print("2. Check telegram-notifications function logs in Supabase")
        print("3. Verify environment variables (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)")
        print("4. Test telegram-notifications function directly")
        
    except KeyboardInterrupt:
        print("\n🛑 Testing stopped by user")
    finally:
        tester.disconnect()
        print("🔌 Disconnected from MQTT")

if __name__ == "__main__":
    main()
