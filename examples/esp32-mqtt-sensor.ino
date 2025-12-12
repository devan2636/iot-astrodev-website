
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// WiFi credentials - replace with your network credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// MQTT Broker settings
const char* mqtt_server = "147.139.247.39";
const int mqtt_port = 1883;
const char* mqtt_topic_data = "iot/devices/716ede0d-9b73-4dff-bb25-74ccc62e6168/data";
const char* mqtt_topic_status = "iot/devices/716ede0d-9b73-4dff-bb25-74ccc62e6168/status";

WiFiClient espClient;
PubSubClient client(espClient);

unsigned long lastMsgData = 0;
unsigned long lastMsgStatus = 0;
const long intervalData = 5000; // 5 seconds
const long intervalStatus = 30000; // 30 seconds

// Function to generate random float between min and max
float randomFloat(float minVal, float maxVal) {
  return minVal + ((float)random() / (float)RAND_MAX) * (maxVal - minVal);
}

// Function to generate random int between min and max
int randomInt(int minVal, int maxVal) {
  return random(minVal, maxVal + 1);
}

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  int retry_count = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    retry_count++;
    if (retry_count > 60) { // timeout after 30 seconds
      Serial.println("Failed to connect to WiFi");
      return;
    }
  }

  Serial.println("");
  Serial.println("WiFi connected");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}

void reconnect() {
  // Loop until we're reconnected
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    // Attempt to connect
    if (client.connect("ESP32Client")) {
      Serial.println("connected");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      // Wait 5 seconds before retrying
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
  randomSeed(analogRead(0));
}

void publishStatus() {
  StaticJsonDocument<256> statusDoc;

  statusDoc["status"] = "online";
  statusDoc["battery"] = 75; // Placeholder battery level, replace with actual reading if available
  statusDoc["wifi_rssi"] = WiFi.RSSI();
  statusDoc["uptime"] = millis() / 1000;
  statusDoc["free_heap"] = ESP.getFreeHeap();
  statusDoc["ota_update"] = "up_to_date"; // Placeholder OTA status

  char statusBuffer[256];
  size_t statusLen = serializeJson(statusDoc, statusBuffer);

  Serial.print("Publishing status: ");
  Serial.println(statusBuffer);

  if (client.publish(mqtt_topic_status, statusBuffer, statusLen)) {
    Serial.println("Status published successfully");
  } else {
    Serial.println("Status publish failed");
  }
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  unsigned long now = millis();

  if (now - lastMsgData > intervalData) {
    lastMsgData = now;

    // Create JSON object for sensor data
    StaticJsonDocument<256> dataDoc;

    dataDoc["temperature"] = randomInt(0, 100);
    dataDoc["humidity"] = randomInt(0, 100);
    dataDoc["pressure"] = randomInt(0, 1023);
    dataDoc["co2"] = randomInt(0, 100);
    dataDoc["o2"] = randomInt(0, 100);
    dataDoc["light"] = randomInt(0, 100);
    dataDoc["curah_hujan"] = randomInt(0, 100);
    dataDoc["kecepatan_angin"] = randomFloat(0, 10);
    dataDoc["arah_angin"] = randomInt(0, 360);
    dataDoc["ph"] = randomFloat(0, 14);
    // Add timestamp in ISO 8601 format (approximate)
    char timestamp[25];
    snprintf(timestamp, sizeof(timestamp), "%lu", now);
    dataDoc["timestamp"] = timestamp;

    char dataBuffer[256];
    size_t dataLen = serializeJson(dataDoc, dataBuffer);

    Serial.print("Publishing data: ");
    Serial.println(dataBuffer);

    if (client.publish(mqtt_topic_data, dataBuffer, dataLen)) {
      Serial.println("Data published successfully");
    } else {
      Serial.println("Data publish failed");
    }
  }

  if (now - lastMsgStatus > intervalStatus) {
    lastMsgStatus = now;
    publishStatus();
  }
}
