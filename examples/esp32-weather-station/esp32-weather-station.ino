#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <Wire.h>
#include <Adafruit_BMP280.h>

// WiFi Configuration
const char* ssid = "YourWiFiSSID";
const char* password = "YourWiFiPassword";

// MQTT Configuration
const char* mqtt_server = "mqtt.astrodev.cloud";
const int mqtt_port = 1883;
const char* mqtt_user = "astrodev";
const char* mqtt_password = "Astroboy26@";

// Unique device ID (should be configured per device)
const char* device_id = "esp32-weather-01";

// MQTT Topics
String data_topic = String("iot/devices/") + device_id + "/data";
String status_topic = String("iot/devices/") + device_id + "/status";
String command_topic = String("iot/devices/") + device_id + "/commands";
String response_topic = String("iot/devices/") + device_id + "/response";

// Sensor pins
#define DHTPIN 4
#define DHTTYPE DHT22
#define LED_PIN 2
#define BATTERY_PIN 34  // ADC pin for battery monitoring

DHT dht(DHTPIN, DHTTYPE);
Adafruit_BMP280 bmp;

WiFiClient espClient;
PubSubClient client(espClient);
unsigned long lastMsg = 0;
const int msgInterval = 5000; // Send data every 5 seconds

void setup_wifi() {
  delay(10);
  Serial.println("Connecting to WiFi...");
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("WiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
}

void publishCommandResponse(const char* message) {
  StaticJsonDocument<200> doc;
  doc["message"] = message;
  doc["timestamp"] = millis();
  
  char buffer[200];
  serializeJson(doc, buffer);
  client.publish(response_topic.c_str(), buffer);
}

void calibrateSensors() {
  Serial.println("Calibrating sensors...");
  
  // Reset DHT sensor
  dht.begin();
  
  // Reset and reconfigure BMP280
  if (bmp.begin(0x76)) {
    bmp.setSampling(Adafruit_BMP280::MODE_NORMAL,
                    Adafruit_BMP280::SAMPLING_X2,
                    Adafruit_BMP280::SAMPLING_X16,
                    Adafruit_BMP280::FILTER_X16,
                    Adafruit_BMP280::STANDBY_MS_500);
  }
  
  // Blink LED to indicate calibration
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(100);
    digitalWrite(LED_PIN, LOW);
    delay(100);
  }
}

void factoryReset() {
  // Clear WiFi settings
  WiFi.disconnect(true);
  
  // Clear any stored preferences here
  // preferences.clear();
  
  // Blink LED rapidly to indicate reset
  for (int i = 0; i < 10; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(50);
    digitalWrite(LED_PIN, LOW);
    delay(50);
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  
  Serial.println("Command received: " + message);
  
  if (message == "read_sensors") {
    publishSensorData();
  } else if (message == "restart") {
    publishCommandResponse("Restarting device...");
    delay(1000);
    ESP.restart();
  } else if (message == "status") {
    publishStatus();
  } else if (message == "led_on") {
    digitalWrite(LED_PIN, HIGH);
    publishCommandResponse("LED turned ON");
  } else if (message == "led_off") {
    digitalWrite(LED_PIN, LOW);
    publishCommandResponse("LED turned OFF");
  } else if (message == "calibrate") {
    calibrateSensors();
    publishCommandResponse("Sensors calibrated");
  } else if (message == "reset_wifi") {
    publishCommandResponse("Resetting WiFi...");
    WiFi.disconnect();
    delay(1000);
    ESP.restart();
  } else if (message == "deep_sleep") {
    publishCommandResponse("Entering deep sleep for 30 seconds...");
    delay(1000);
    esp_sleep_enable_timer_wakeup(30 * 1000000); // 30 seconds
    esp_deep_sleep_start();
  } else if (message == "factory_reset") {
    publishCommandResponse("Performing factory reset...");
    factoryReset();
    delay(1000);
    ESP.restart();
  }
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    
    if (client.connect(device_id, mqtt_user, mqtt_password)) {
      Serial.println("connected");
      
      // Subscribe to command topic
      client.subscribe(command_topic.c_str());
      
      // Publish online status
      publishStatus();
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" retrying in 5 seconds");
      delay(5000);
    }
  }
}

void publishStatus() {
  StaticJsonDocument<200> status;
  status["status"] = "online";
  status["battery"] = readBatteryLevel();
  status["wifi_rssi"] = WiFi.RSSI();
  status["uptime"] = millis() / 1000;
  status["free_heap"] = ESP.getFreeHeap();
  
  char statusBuffer[200];
  serializeJson(status, statusBuffer);
  client.publish(status_topic.c_str(), statusBuffer, true);
}

int readBatteryLevel() {
  // Read battery voltage from ADC
  int rawValue = analogRead(BATTERY_PIN);
  float voltage = (rawValue / 4095.0) * 3.3 * 2; // Voltage divider
  
  // Convert to percentage (3.3V = 0%, 4.2V = 100%)
  int percentage = map(voltage * 100, 330, 420, 0, 100);
  return constrain(percentage, 0, 100);
}

void publishSensorData() {
  // Read sensor data
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  float pressure = bmp.readPressure() / 100.0F; // Convert Pa to hPa
  
  // Create JSON document
  StaticJsonDocument<200> doc;
  doc["temperature"] = isnan(temperature) ? NULL : temperature;
  doc["humidity"] = isnan(humidity) ? NULL : humidity;
  doc["pressure"] = pressure;
  doc["battery"] = readBatteryLevel();
  
  // Serialize JSON to string
  char buffer[200];
  serializeJson(doc, buffer);
  
  // Publish to MQTT
  client.publish(data_topic.c_str(), buffer);
  Serial.println("Published: " + String(buffer));
  
  // Blink LED to indicate data sent
  digitalWrite(LED_PIN, HIGH);
  delay(100);
  digitalWrite(LED_PIN, LOW);
}

void setup() {
  Serial.begin(115200);
  
  // Initialize pins
  pinMode(LED_PIN, OUTPUT);
  pinMode(BATTERY_PIN, INPUT);
  
  // Initialize sensors
  dht.begin();
  if (!bmp.begin(0x76)) {
    Serial.println("Could not find BMP280 sensor!");
  }
  
  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(mqttCallback);
  
  // Initial LED blink to indicate boot
  digitalWrite(LED_PIN, HIGH);
  delay(1000);
  digitalWrite(LED_PIN, LOW);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  unsigned long now = millis();
  if (now - lastMsg > msgInterval) {
    lastMsg = now;
    publishSensorData();
  }
}
