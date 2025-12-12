import paho.mqtt.client as mqtt
import json
import time
from datetime import datetime
import ssl
import argparse

# MQTT Configuration (same as reference)
MQTT_BROKER = "mqtt.astrodev.cloud"
MQTT_PORT = 443
MQTT_USERNAME = "astrodev"
MQTT_PASSWORD = "Astroboy26@"
MQTT_TRANSPORT = "websockets"

class TelegramNotificationTester:
    def __init__(self):
        self.client = mqtt.Client(transport=MQTT_TRANSPORT)
        self.client.on_connect = self.on_connect
        self.client.on_publish = self.on_publish
        self.client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
        self.client.tls_set(tls_version=ssl.PROTOCOL_TLS)

    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            print("✅ Connected to MQTT Broker")
        else:
            print(f"❌ Connection failed with code {rc}")

    def on_publish(self, client, userdata, mid):
        print(f"📤 Message published (mid: {mid})")

    def connect(self):
        try:
            self.client.connect(MQTT_BROKER, MQTT_PORT, 60)
            self.client.loop_start()
            time.sleep(2)  # Wait for connection
            return True
        except Exception as e:
            print(f"❌ Connection error: {e}")
            return False

    def disconnect(self):
        self.client.loop_stop()
        self.client.disconnect()

    def send_test_message(self, device_id, event_type, data=None):
        # Map event types to correct MQTT topics
        topic_map = {
            'sensor_update': f"iot/devices/{device_id}/data",
            'status_update': f"iot/devices/{device_id}/status",
            'test': f"iot/devices/{device_id}/commands"
        }
        topic = topic_map[event_type]
        
        payload = {
            "timestamp": datetime.now().isoformat()
        }

        if event_type == 'sensor_update' and data:
            payload.update(data)
        elif event_type == 'status_update' and data:
            payload.update({
                "battery": data.get("battery", 0),
                "wifi_rssi": -65,  # Default WiFi signal strength
                "uptime": 3600,    # Default uptime in seconds
                "free_heap": 100000 # Default free heap memory
            })


        try:
            result = self.client.publish(topic, json.dumps(payload))
            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                print(f"✅ Sent {event_type} event for device {device_id}")
            else:
                print(f"❌ Failed to publish message (rc: {result.rc})")
        except Exception as e:
            print(f"❌ Publish error: {e}")

def main():
    parser = argparse.ArgumentParser(description='Test Telegram notifications via MQTT')
    parser.add_argument('-d', '--device', required=True, help='Device ID to test')
    parser.add_argument('-t', '--temp', type=float, help='Temperature value to send')
    parser.add_argument('-b', '--battery', type=int, help='Battery percentage to send')
    parser.add_argument('-e', '--event', choices=['test', 'sensor_update', 'status_update'], 
                       default='test', help='Event type to send')

    args = parser.parse_args()

    tester = TelegramNotificationTester()
    
    if not tester.connect():
        return

    try:
        # Prepare data based on arguments
        data = {}
        if args.temp:
            data["temperature"] = args.temp
        if args.battery:
            data["battery"] = args.battery

        # Send the test message
        tester.send_test_message(args.device, args.event, data if data else None)

        print("\nℹ️  Check your Telegram for the notification")
        print("Press Ctrl+C to exit...")
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n🛑 Stopping tester...")
    finally:
        tester.disconnect()

if __name__ == "__main__":
    main()
