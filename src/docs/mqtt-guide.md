# MQTT Integration Guide

## Broker Configuration

```
Host: mqtt.astrodev.cloud
Port: 1883 (MQTT) / 8883 (MQTTS)
Username: astrodev
Password: Astroboy26@
```

## Topic Structure

```
iot/devices/{device_id}/data      - Sensor data
iot/devices/{device_id}/status    - Device status
```

## Data Format

```json
{
  "temperature": 25.6,    // Celsius
  "humidity": 65.4,       // %
  "pressure": 1013.25,    // hPa
  "battery": 85          // %
}
```

## Status Format

```json
{
  "status": "online",    // "online" or "offline"
  "battery": 85         // Battery level in %
}
```

## Example ESP32 Code

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// WiFi Configuration
const char* ssid = "YourWiFiSSID";
const char* password = "YourWiFiPassword";

// MQTT Configuration
const char* mqtt_server = "mqtt.astrodev.cloud";
const int mqtt_port = 1883;
const char* mqtt_user = "astrodev";
const char* mqtt_password = "Astroboy26@";

// Device ID (unique per device)
const char* device_id = "esp32-001";

// MQTT Topics
String data_topic = String("iot/devices/") + device_id + "/data";
String status_topic = String("iot/devices/") + device_id + "/status";

WiFiClient espClient;
PubSubClient client(espClient);

void setup() {
  Serial.begin(115200);
  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  // Read sensors and publish every 5 seconds
  static unsigned long lastMsg = 0;
  if (millis() - lastMsg > 5000) {
    lastMsg = millis();
    publishData();
  }
}

void setup_wifi() {
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }
}

void reconnect() {
  while (!client.connected()) {
    if (client.connect(device_id, mqtt_user, mqtt_password)) {
      // Publish online status
      StaticJsonDocument<200> status;
      status["status"] = "online";
      status["battery"] = 100;
      
      char statusBuffer[200];
      serializeJson(status, statusBuffer);
      client.publish(status_topic.c_str(), statusBuffer, true);
    } else {
      delay(5000);
    }
  }
}

void publishData() {
  // Create data JSON
  StaticJsonDocument<200> doc;
  doc["temperature"] = 25.6;  // Replace with actual sensor reading
  doc["humidity"] = 65.4;     // Replace with actual sensor reading
  doc["pressure"] = 1013.25;  // Replace with actual sensor reading
  doc["battery"] = 85;        // Replace with actual battery level
  
  char buffer[200];
  serializeJson(doc, buffer);
  
  // Publish to MQTT
  client.publish(data_topic.c_str(), buffer);
}
