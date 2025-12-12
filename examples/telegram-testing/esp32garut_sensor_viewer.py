import tkinter as tk
from tkinter import ttk
import paho.mqtt.client as mqtt
import json

DEVICE_ID = "716ede0d-9b73-4dff-bb25-74ccc62e6168"
MQTT_BROKER = "147.139.247.39"
MQTT_PORT = 1883
MQTT_USERNAME = None
MQTT_PASSWORD = None
MQTT_TRANSPORT = "tcp"

SENSOR_RANGES = {
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

class SensorViewer(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("ESP32 Garut Sensor Data Viewer")
        self.geometry("600x400")
        self.protocol("WM_DELETE_WINDOW", self.on_close)

        self.tree = ttk.Treeview(self, columns=("value", "timestamp", "status"), show="headings")
        self.tree.heading("value", text="Value")
        self.tree.heading("timestamp", text="Timestamp (UTC)")
        self.tree.heading("status", text="Status")
        self.tree.column("value", width=100, anchor="center")
        self.tree.column("timestamp", width=200, anchor="center")
        self.tree.column("status", width=100, anchor="center")
        self.tree.pack(fill=tk.BOTH, expand=True)

        self.sensors = list(SENSOR_RANGES.keys())
        for sensor in self.sensors:
            self.tree.insert("", "end", iid=sensor, values=("-", "-", "-"))

        self.client = mqtt.Client(transport=MQTT_TRANSPORT)
        if MQTT_USERNAME and MQTT_PASSWORD:
            self.client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_disconnect = self.on_disconnect

        self.client.connect(MQTT_BROKER, MQTT_PORT, 60)
        self.client.loop_start()

    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            topic = f"iot/devices/{DEVICE_ID}/data"
            client.subscribe(topic)
            print(f"Connected to MQTT broker, subscribed to {topic}")
        else:
            print(f"Failed to connect to MQTT broker, return code {rc}")

    def on_disconnect(self, client, userdata, rc):
        print("Disconnected from MQTT broker")

    def on_message(self, client, userdata, msg):
        try:
            data = json.loads(msg.payload.decode())
            timestamp = data.get("timestamp", "-")
            for sensor in self.sensors:
                value = data.get(sensor, None)
                if value is None:
                    status = "No data"
                    display_value = "-"
                else:
                    min_val, max_val = SENSOR_RANGES[sensor]
                    if value < min_val or value > max_val:
                        status = "Out of range"
                    else:
                        status = "OK"
                    display_value = str(value)
                self.tree.set(sensor, "value", display_value)
                self.tree.set(sensor, "timestamp", timestamp)
                self.tree.set(sensor, "status", status)
        except Exception as e:
            print(f"Error processing message: {e}")

    def on_close(self):
        self.client.loop_stop()
        self.client.disconnect()
        self.destroy()

if __name__ == "__main__":
    app = SensorViewer()
    app.mainloop()
