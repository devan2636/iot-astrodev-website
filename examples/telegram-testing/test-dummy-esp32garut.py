import paho.mqtt.client as mqtt
import json
import random
import time
from datetime import datetime, timezone

DEVICE_ID = "716ede0d-9b73-4dff-bb25-74ccc62e6168"

MQTT_BROKER = "147.139.247.39"
MQTT_PORT = 1883
MQTT_USERNAME = None
MQTT_PASSWORD = None
MQTT_TRANSPORT = "tcp"

SENSORS = {
    "temperature": (0, 100),
    "humidity": (0, 100),
    "pressure": (0, 1023),
    "co2": (0, 100),
    "o2": (0, 100),
    "light": (0, 100),
    "curah_hujan": (0, 100),
    "kecepatan_angin": (0, 10),
    "arah_angin": (0, 360),
    "ph": (0, 14),
}

class DeviceSimulator:
    def __init__(self, device_id):
        self.device_id = device_id
        self.client = mqtt.Client(transport=MQTT_TRANSPORT)
        self.client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
        self.client.on_connect = self.on_connect
        self.client.on_disconnect = self.on_disconnect
        self.client.on_publish = self.on_publish
        self.running = False

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
        try:
            print(f"🔗 Connecting to MQTT Broker at {MQTT_BROKER}:{MQTT_PORT}")
            self.client.connect(MQTT_BROKER, MQTT_PORT, 60)
            self.client.loop_start()
            time.sleep(2)
            return self.running
        except Exception as e:
            print(f"❌ Connection error: {e}")
            return False

    def disconnect(self):
        self.running = False
        self.client.loop_stop()
        self.client.disconnect()

    def generate_sensor_data(self, error_mode=False):
        data = {}
        for sensor, (min_val, max_val) in SENSORS.items():
            if error_mode and random.random() < 0.1:
                # 10% chance to generate out-of-range value for error simulation
                if sensor == "ph":
                    value = round(random.uniform(max_val + 1, max_val + 5), 1)
                elif sensor == "arah_angin":
                    value = random.randint(max_val + 1, max_val + 20)
                elif sensor == "kecepatan_angin":
                    value = round(random.uniform(max_val + 1, max_val + 5), 1)
                else:
                    value = random.randint(max_val + 1, max_val + 50)
            else:
                if sensor == "ph":
                    value = round(random.uniform(min_val, max_val), 1)
                elif sensor == "arah_angin":
                    value = random.randint(min_val, max_val)
                elif sensor == "kecepatan_angin":
                    value = round(random.uniform(min_val, max_val), 1)
                else:
                    value = random.randint(min_val, max_val)
            data[sensor] = value
        data["timestamp"] = datetime.now(timezone.utc).isoformat()
        return data

    def publish_sensor_data(self, data):
        topic = f"iot/devices/{self.device_id}/data"
        try:
            result = self.client.publish(topic, json.dumps(data))
            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                print(f"📊 Sensor data sent: {json.dumps(data)}")
            else:
                print("❌ Failed to publish sensor data")
        except Exception as e:
            print(f"❌ Error publishing sensor data: {e}")

    def run(self):
        if not self.connect():
            return
        try:
            while True:
                # Randomly decide to simulate error mode
                error_mode = random.random() < 0.1
                data = self.generate_sensor_data(error_mode=error_mode)
                self.publish_sensor_data(data)
                time.sleep(5)
        except KeyboardInterrupt:
            print("\n🛑 Simulation stopped by user")
        finally:
            self.disconnect()

def main():
    simulator = DeviceSimulator(DEVICE_ID)
    simulator.run()

if __name__ == "__main__":
    main()
