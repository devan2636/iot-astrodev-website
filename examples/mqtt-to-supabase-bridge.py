import paho.mqtt.client as mqtt
import json
import requests
import ssl
import time

# MQTT Configuration
MQTT_BROKER = "mqtt.astrodev.cloud"
MQTT_PORT = 443
MQTT_USERNAME = "astrodev"
MQTT_PASSWORD = "Astroboy26@"
MQTT_TRANSPORT = "websockets"

# Supabase Function URL
SUPABASE_FUNCTION_URL = "https://gdmvqskgtdpsktuhsnal.supabase.co/functions/v1/telegram-notifications"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkbXZxc2tndGRwc2t0dWhzbmFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc5NzUyMzcsImV4cCI6MjA2MzU1MTIzN30.Mf9L8X9Mu50FG075ubO6hFzEf0cvzccNZoGxjbLmsaA"

# Device ID mapping from test-dummy-all-sensor.py
DEVICE_ID_MAP = {
    "086e7e43-9a40-437e-8ffd-fc029aa86d9a": "AWLR",
    "2d6ea74e-3235-435e-8e4f-e6965f1ce2e1": "ESP32-Weather",
    "34168ffc-17fe-4a79-bec9-7b3386700cf9": "ESP32",
    "65cef40a-5e73-4602-8d46-e93e694db47f": "Weather Station 2",
    "ab74435f-1ff7-45b3-a2bf-67b8a8bcc87e": "ESP32-LoRa",
    "f2b0150e-9e05-4ec1-b95f-82126b16e158": "Weather Station"
}

# MQTT Topics to subscribe
TOPIC_SENSOR_DATA = "iot/devices/+/data"
TOPIC_DEVICE_STATUS = "iot/devices/+/status"

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ Connected to MQTT Broker")
        client.subscribe(TOPIC_SENSOR_DATA)
        client.subscribe(TOPIC_DEVICE_STATUS)
    else:
        print(f"❌ MQTT connection failed with code {rc}")

def on_message(client, userdata, msg):
    topic = msg.topic
    payload_str = msg.payload.decode('utf-8')
    print(f"📥 Message received on topic {topic}: {payload_str}")

    try:
        payload = json.loads(payload_str)
    except Exception as e:
        print(f"❌ Failed to parse JSON payload: {e}")
        return

    # Extract device_id from topic
    parts = topic.split('/')
    if len(parts) < 4:
        print("⚠️ Invalid topic format")
        return
    device_id = parts[2]

    # Determine event type based on topic
    if parts[3] == "data":
        event = "sensor_update"
        sensor_data = payload
    elif parts[3] == "status":
        event = "status_update"
        sensor_data = payload
    else:
        print("⚠️ Unknown topic suffix, ignoring message")
        return

    # Map device_id to name if available
    device_name = DEVICE_ID_MAP.get(device_id, device_id)

    # Prepare request payload
    request_payload = {
        "device_id": device_id,
        "event": event,
        "sensor_data": sensor_data
    }

    headers = {
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(SUPABASE_FUNCTION_URL, headers=headers, json=request_payload)
        if response.status_code == 200:
            print(f"✅ Notification sent for device {device_name} event {event}")
        else:
            print(f"❌ Failed to send notification: {response.status_code} {response.text}")
    except Exception as e:
        print(f"❌ Error sending notification: {e}")

def main():
    client = mqtt.Client(transport=MQTT_TRANSPORT)
    client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
    client.tls_set(tls_version=ssl.PROTOCOL_TLS)
    client.on_connect = on_connect
    client.on_message = on_message

    print(f"🔗 Connecting to MQTT Broker {MQTT_BROKER}:{MQTT_PORT}...")
    client.connect(MQTT_BROKER, MQTT_PORT, 60)
    client.loop_forever()

if __name__ == "__main__":
    main()
