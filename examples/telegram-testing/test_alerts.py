import json
import time
import paho.mqtt.client as mqtt
from datetime import datetime

# MQTT Configuration
MQTT_BROKER = "mqtt.example.com"
MQTT_PORT = 1883
MQTT_TOPIC = "device/status"

# Test Scenarios
test_scenarios = [
    {
        "device_id": "weather-station-01",
        "timestamp": datetime.now().isoformat(),
        "battery": 8,  # Critical battery
        "wifi_rssi": -85,  # Weak signal
        "sensor_data": {
            "temperature": 25,
            "humidity": 60,
            "pressure": 1013
        }
    },
    {
        "device_id": "sensor-node-02",
        "timestamp": datetime.now().isoformat(),
        "battery": 15,  # Warning battery
        "wifi_rssi": -75,
        "sensor_data": {
            "temperature": 45,  # Critical temperature
            "humidity": 85,  # Critical humidity
            "pressure": 1013
        }
    },
    {
        "device_id": "esp32-lora",
        "timestamp": datetime.now().isoformat(),
        "battery": 50,
        "wifi_rssi": -89,  # Weak signal
        "sensor_data": {
            "temperature": 35,  # Warning temperature
            "humidity": 75,  # Warning humidity
            "pressure": 965  # Critical pressure
        }
    }
]

def on_connect(client, userdata, flags, rc):
    print(f"Connected with result code {rc}")

def on_publish(client, userdata, mid):
    print(f"Message {mid} published")

def main():
    print("🧪 Testing Alert Scenarios")
    print("=" * 40)

    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_publish = on_publish

    try:
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        client.loop_start()

        for i, scenario in enumerate(test_scenarios, 1):
            print(f"\nScenario {i}:")
            print(f"Device: {scenario['device_id']}")
            print(f"Battery: {scenario['battery']}%")
            print(f"WiFi: {scenario['wifi_rssi']} dBm")
            if 'sensor_data' in scenario:
                print("Sensor Data:")
                for key, value in scenario['sensor_data'].items():
                    print(f"  {key}: {value}")
            
            # Publish to MQTT
            payload = json.dumps(scenario)
            client.publish(MQTT_TOPIC, payload)
            print("\nMessage published to MQTT")
            
            # Wait for processing
            time.sleep(5)

        print("\n" + "=" * 40)
        print("🎉 Test completed!")
        print("\nCheck Telegram group for notifications.")
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        client.loop_stop()
        client.disconnect()

if __name__ == "__main__":
    main()
