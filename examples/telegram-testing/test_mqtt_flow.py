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

# Test device dengan alert conditions
test_device = {
    "id": "f2b0150e-9e05-4ec1-b95f-82126b16e158",
    "name": "Test Alert Device"
}

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ Connected to MQTT Broker")
    else:
        print(f"❌ Failed to connect. Return code: {rc}")

def on_publish(client, userdata, mid):
    print(f"📤 Message published (ID: {mid})")

def main():
    print("🧪 Testing MQTT → Telegram Flow")
    print("=" * 40)
    print("This will send test data that should trigger Telegram alerts")
    print()
    
    # Setup MQTT client
    client = mqtt.Client(transport=MQTT_TRANSPORT)
    client.on_connect = on_connect
    client.on_publish = on_publish
    client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
    client.tls_set(tls_version=ssl.PROTOCOL_TLS)
    
    try:
        # Connect to MQTT
        print(f"🔗 Connecting to {MQTT_BROKER}:{MQTT_PORT}")
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        client.loop_start()
        time.sleep(3)
        
        # Test 1: Critical Battery Status
        print("\n🔋 Test 1: Critical Battery Alert")
        status_topic = f"iot/devices/{test_device['id']}/status"
        critical_status = {
            "status": "online",
            "battery": 5,  # Critical < 10%
            "wifi_rssi": -75,
            "uptime": 3600,
            "free_heap": 123456,
            "timestamp": datetime.now().isoformat()
        }
        
        client.publish(status_topic, json.dumps(critical_status))
        print(f"   Sent critical battery status: {critical_status['battery']}%")
        print("   Expected: 🔋 Battery Critical alert in Telegram")
        time.sleep(10)
        
        # Test 2: Weak WiFi Signal
        print("\n📶 Test 2: Weak WiFi Signal Alert")
        weak_wifi_status = {
            "status": "online",
            "battery": 50,
            "wifi_rssi": -89,  # Weak < -80 dBm
            "uptime": 3600,
            "free_heap": 123456,
            "timestamp": datetime.now().isoformat()
        }
        
        client.publish(status_topic, json.dumps(weak_wifi_status))
        print(f"   Sent weak WiFi status: {weak_wifi_status['wifi_rssi']} dBm")
        print("   Expected: 📶 WiFi Signal Warning in Telegram")
        time.sleep(10)
        
        # Test 3: Critical Temperature
        print("\n🌡️ Test 3: Critical Temperature Alert")
        sensor_topic = f"iot/devices/{test_device['id']}/data"
        critical_temp = {
            "temperature": 45.5,  # Critical > 40°C
            "humidity": 60.2,
            "pressure": 1013.25,
            "timestamp": datetime.now().isoformat()
        }
        
        client.publish(sensor_topic, json.dumps(critical_temp))
        print(f"   Sent critical temperature: {critical_temp['temperature']}°C")
        print("   Expected: 🌡️ Temperature Critical alert in Telegram")
        time.sleep(10)
        
        # Test 4: Multiple Alerts
        print("\n⚠️ Test 4: Multiple Alerts")
        multiple_alerts = {
            "status": "online",
            "battery": 8,  # Critical
            "wifi_rssi": -85,  # Weak
            "uptime": 3600,
            "free_heap": 8000,  # Low memory
            "timestamp": datetime.now().isoformat()
        }
        
        client.publish(status_topic, json.dumps(multiple_alerts))
        print(f"   Sent multiple alert conditions:")
        print(f"     Battery: {multiple_alerts['battery']}% (Critical)")
        print(f"     WiFi: {multiple_alerts['wifi_rssi']} dBm (Weak)")
        print(f"     Memory: {multiple_alerts['free_heap']} bytes (Low)")
        print("   Expected: Multiple alerts in Telegram")
        time.sleep(10)
        
        print("\n" + "=" * 40)
        print("🎉 Test completed!")
        print()
        print("📱 Check Telegram group: Astrodev-IoT")
        print("   Chat ID: -4691595195")
        print()
        print("🔍 If no alerts received, check:")
        print("   1. mqtt-data-handler function updated")
        print("   2. Environment variables set")
        print("   3. Function logs in Supabase Dashboard")
        
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        client.loop_stop()
        client.disconnect()
        print("🔌 Disconnected from MQTT")

if __name__ == "__main__":
    main()
