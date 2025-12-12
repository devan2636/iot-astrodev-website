import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Download, Wifi, Thermometer, Droplets, Gauge, Cloud, Zap, Database } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const WeatherStationGuide = () => {
  const [copiedSection, setCopiedSection] = useState('');
  const [activeTab, setActiveTab] = useState('http');
  const [showCode, setShowCode] = useState(false);
  const { toast } = useToast();

  const handleTabSelect = (tab: string) => {
    if (activeTab === tab) {
      setShowCode(!showCode);
    } else {
      setActiveTab(tab);
      setShowCode(true);
    }
  };

  const copyToClipboard = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    toast({
      title: "Copied!",
      description: `${section} code copied to clipboard`,
    });
    setTimeout(() => setCopiedSection(''), 2000);
  };

  const esp32MainCode = `#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <Wire.h>
#include <Adafruit_BMP280.h>
#include <ESP32Time.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Server configuration
const char* serverURL = "https://gdmvqskgtdpsktuhsnal.supabase.co/functions/v1/esp32-data";
const char* apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkbXZxc2tndGRwc2t0dWhzbmFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc5NzUyMzcsImV4cCI6MjA2MzU1MTIzN30.Mf9L8X9Mu50FG075ubO6hFzEf0cvzccNZoGxjbLmsaA";

// Device Configuration
const String DEVICE_ID = "YOUR_DEVICE_UUID"; // Get this from dashboard after registering device

// Sensor pins and configuration
#define DHT_PIN 4
#define DHT_TYPE DHT22
#define BATTERY_PIN A0
#define LED_PIN 2

// Sensor objects
DHT dht(DHT_PIN, DHT_TYPE);
Adafruit_BMP280 bmp;
ESP32Time rtc;

// Timing variables
unsigned long lastSensorRead = 0;
unsigned long lastDataSend = 0;
const unsigned long SENSOR_INTERVAL = 5000;  // Read sensors every 5 seconds
const unsigned long SEND_INTERVAL = 30000;   // Send data every 30 seconds

// Data storage
struct SensorData {
  float temperature;
  float humidity;
  float pressure;
  int battery;
  bool valid;
};

SensorData currentData;

void setup() {
  Serial.begin(115200);
  
  // Initialize pins
  pinMode(LED_PIN, OUTPUT);
  pinMode(BATTERY_PIN, INPUT);
  
  // Initialize sensors
  Serial.println("Initializing Weather Station...");
  
  dht.begin();
  
  if (!bmp.begin(0x76)) {
    Serial.println("Could not find BMP280 sensor, check wiring!");
    while (1);
  }
  
  // Configure BMP280
  bmp.setSampling(Adafruit_BMP280::MODE_NORMAL,
                  Adafruit_BMP280::SAMPLING_X2,
                  Adafruit_BMP280::SAMPLING_X16,
                  Adafruit_BMP280::FILTER_X16,
                  Adafruit_BMP280::STANDBY_MS_500);
  
  // Connect to WiFi
  connectToWiFi();
  
  // Initialize time
  rtc.setTime(0, 0, 0, 1, 1, 2024);
  
  Serial.println("Weather Station initialized successfully!");
  digitalWrite(LED_PIN, HIGH);
  delay(1000);
  digitalWrite(LED_PIN, LOW);
}

void loop() {
  unsigned long currentMillis = millis();
  
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected, reconnecting...");
    connectToWiFi();
  }
  
  // Read sensors periodically
  if (currentMillis - lastSensorRead >= SENSOR_INTERVAL) {
    readSensors();
    lastSensorRead = currentMillis;
  }
  
  // Send data periodically
  if (currentMillis - lastDataSend >= SEND_INTERVAL) {
    if (currentData.valid) {
      sendDataToServer();
    }
    lastDataSend = currentMillis;
  }
  
  // Brief delay
  delay(100);
}

void connectToWiFi() {
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("WiFi connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    Serial.print("Signal strength: ");
    Serial.println(WiFi.RSSI());
  } else {
    Serial.println();
    Serial.println("Failed to connect to WiFi!");
  }
}

void readSensors() {
  Serial.println("Reading sensors...");
  
  // Read DHT22 (Temperature & Humidity)
  float temp = dht.readTemperature();
  float hum = dht.readHumidity();
  
  // Read BMP280 (Pressure)
  float press = bmp.readPressure() / 100.0F; // Convert to hPa
  
  // Read battery voltage
  int batteryLevel = readBatteryLevel();
  
  // Validate readings
  if (isnan(temp) || isnan(hum)) {
    Serial.println("Failed to read from DHT sensor!");
    currentData.valid = false;
    return;
  }
  
  if (isnan(press)) {
    Serial.println("Failed to read from BMP280 sensor!");
    currentData.valid = false;
    return;
  }
  
  // Store data
  currentData.temperature = temp;
  currentData.humidity = hum;
  currentData.pressure = press;
  currentData.battery = batteryLevel;
  currentData.valid = true;
  
  // Print readings
  Serial.println("--- Sensor Readings ---");
  Serial.printf("Temperature: %.2f°C\\n", temp);
  Serial.printf("Humidity: %.2f%%\\n", hum);
  Serial.printf("Pressure: %.2f hPa\\n", press);
  Serial.printf("Battery: %d%%\\n", batteryLevel);
  Serial.println("----------------------");
  
  // Blink LED to indicate successful reading
  digitalWrite(LED_PIN, HIGH);
  delay(100);
  digitalWrite(LED_PIN, LOW);
}

int readBatteryLevel() {
  // Read battery voltage (adjust according to your voltage divider)
  int rawValue = analogRead(BATTERY_PIN);
  float voltage = (rawValue / 4095.0) * 3.3 * 2; // Assuming voltage divider
  
  // Convert voltage to percentage (3.0V = 0%, 4.2V = 100%)
  int percentage = map(voltage * 100, 300, 420, 0, 100);
  percentage = constrain(percentage, 0, 100);
  
  return percentage;
}

void sendDataToServer() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected, cannot send data");
    return;
  }
  
  HTTPClient http;
  http.begin(serverURL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", apiKey);
  
  // Create JSON payload
  StaticJsonDocument<200> doc;
  doc["device_id"] = DEVICE_ID;
  doc["temperature"] = currentData.temperature;
  doc["humidity"] = currentData.humidity;
  doc["pressure"] = currentData.pressure;
  doc["battery"] = currentData.battery;
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  Serial.println("Sending data to server...");
  Serial.println("Payload: " + jsonString);
  
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.printf("HTTP Response: %d\\n", httpResponseCode);
    Serial.println("Response: " + response);
    
    if (httpResponseCode == 200) {
      Serial.println("Data sent successfully!");
      // Blink LED twice for success
      for (int i = 0; i < 2; i++) {
        digitalWrite(LED_PIN, HIGH);
        delay(200);
        digitalWrite(LED_PIN, LOW);
        delay(200);
      }
    } else {
      Serial.println("Server error!");
    }
  } else {
    Serial.printf("HTTP Error: %d\\n", httpResponseCode);
    Serial.println("Failed to send data!");
  }
  
  http.end();
}`;

  const mqttCode = `#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Wire.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// MQTT Configuration
const char* mqtt_server = "mqtt.astrodev.cloud";
const int mqtt_port = 1883;
const char* mqtt_username = "astrodev";
const char* mqtt_password = "Astroboy26@";

// Unique device ID (should be configured per device)
const char* device_id = "esp32-weather-01";

// MQTT Topics
String data_topic = String("iot/devices/") + device_id + "/data";
String status_topic = String("iot/devices/") + device_id + "/status";
String command_topic = String("iot/devices/") + device_id + "/commands";

// Pin Configuration
#define BATTERY_PIN A0
#define LED_PIN 2

// Objects for connected sensors
WiFiClient espClient;
PubSubClient client(espClient);

// Timing variables
unsigned long lastMqttPublish = 0;
const unsigned long MQTT_INTERVAL = 5000; // Publish every 5 seconds

void setup() {
  Serial.begin(115200);
  
  // Initialize pins
  pinMode(LED_PIN, OUTPUT);
  pinMode(BATTERY_PIN, INPUT);
  
  // Connect to WiFi
  connectToWiFi();
  
  // Setup MQTT
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(mqttCallback);
  
  Serial.println("Weather Station with MQTT initialized!");
}

void loop() {
  // Maintain MQTT connection
  if (!client.connected()) {
    reconnectMQTT();
  }
  client.loop();
  
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    connectToWiFi();
  }
  
  // Publish sensor data via MQTT
  unsigned long currentMillis = millis();
  if (currentMillis - lastMqttPublish >= MQTT_INTERVAL) {
    publishSensorData();
    lastMqttPublish = currentMillis;
  }
  
  delay(100);
}

void connectToWiFi() {
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println();
  Serial.println("WiFi connected!");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}

void reconnectMQTT() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    
    if (client.connect(device_id, mqtt_username, mqtt_password)) {
      Serial.println("MQTT connected!");
      
      // Subscribe to command topic
      client.subscribe(command_topic.c_str());
      
      // Publish online status
      StaticJsonDocument<200> status;
      status["status"] = "online";
      status["battery"] = readBatteryLevel();
      
      char statusBuffer[200];
      serializeJson(status, statusBuffer);
      client.publish(status_topic.c_str(), statusBuffer, true);
      
    } else {
      Serial.print("MQTT connection failed, rc=");
      Serial.print(client.state());
      Serial.println(" retrying in 5 seconds");
      delay(5000);
    }
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  
  Serial.println("MQTT Message received: " + String(topic) + " - " + message);
  
  // Handle commands
  if (String(topic) == command_topic) {
    if (message == "read_sensors") {
      publishSensorData();
    } else if (message == "restart") {
      ESP.restart();
    } else if (message == "status") {
      publishStatus();
    }
  }
}

void publishSensorData() {
  // Create JSON payload
  StaticJsonDocument<512> doc;
  JsonObject sensors = doc.createNestedObject("sensors");
  
  // Add sensor readings
  sensors["temperature"] = 25.0; // Replace with actual sensor reading
  sensors["humidity"] = 65.0; // Replace with actual sensor reading
  sensors["pressure"] = 1013.25; // Replace with actual sensor reading
  sensors["battery"] = readBatteryLevel();
  
  // Add metadata
  JsonObject metadata = doc.createNestedObject("metadata");
  metadata["device_id"] = device_id;
  metadata["timestamp"] = millis() / 1000;
  metadata["firmware_version"] = "1.2.0";
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  // Publish to MQTT data topic
  client.publish(data_topic.c_str(), jsonString.c_str());
  
  Serial.println("MQTT Data published: " + jsonString);
  
  // Blink LED to indicate data sent
  digitalWrite(LED_PIN, HIGH);
  delay(100);
  digitalWrite(LED_PIN, LOW);
}

void publishStatus() {
  StaticJsonDocument<512> status;
  JsonObject data = status.createNestedObject("status");
  data["state"] = "online";
  data["battery"] = readBatteryLevel();
  data["wifi_signal"] = WiFi.RSSI();
  data["uptime"] = millis() / 1000;
  data["free_heap"] = ESP.getFreeHeap();
  data["firmware_version"] = "1.2.0";
  
  char statusBuffer[512];
  serializeJson(status, statusBuffer);
  client.publish(status_topic.c_str(), statusBuffer, true);
}

int readBatteryLevel() {
  int rawValue = analogRead(BATTERY_PIN);
  float voltage = (rawValue / 4095.0) * 3.3 * 2; // Assuming voltage divider
  int percentage = map(voltage * 100, 300, 420, 0, 100);
  return constrain(percentage, 0, 100);
}`;

  const firebaseCode = `#include <WiFi.h>
#include <FirebaseESP32.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <Wire.h>
#include <Adafruit_BMP280.h>
#include <time.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Firebase configuration
#define FIREBASE_HOST "YOUR_PROJECT.firebaseio.com"
#define FIREBASE_AUTH "YOUR_DATABASE_SECRET"

// Device Configuration
const String DEVICE_ID = "YOUR_DEVICE_UUID";

// Sensor configuration
#define DHT_PIN 4
#define DHT_TYPE DHT22
#define BATTERY_PIN A0

// Objects
DHT dht(DHT_PIN, DHT_TYPE);
Adafruit_BMP280 bmp;
FirebaseData firebaseData;
FirebaseConfig config;
FirebaseAuth auth;

// Timing variables
unsigned long lastFirebaseSync = 0;
const unsigned long FIREBASE_INTERVAL = 60000; // Sync every minute

void setup() {
  Serial.begin(115200);
  
  // Initialize sensors
  dht.begin();
  if (!bmp.begin(0x76)) {
    Serial.println("Could not find BMP280 sensor!");
    while (1);
  }
  
  // Connect to WiFi
  connectToWiFi();
  
  // Configure time
  configTime(0, 0, "pool.ntp.org");
  
  // Setup Firebase
  config.host = FIREBASE_HOST;
  config.signer.tokens.legacy_token = FIREBASE_AUTH;
  
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  
  Serial.println("Weather Station with Firebase initialized!");
}

void loop() {
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    connectToWiFi();
  }
  
  // Sync with Firebase
  unsigned long currentMillis = millis();
  if (currentMillis - lastFirebaseSync >= FIREBASE_INTERVAL) {
    syncWithFirebase();
    lastFirebaseSync = currentMillis;
  }
  
  delay(1000);
}

void connectToWiFi() {
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println();
  Serial.println("WiFi connected!");
}

void syncWithFirebase() {
  // Read sensors
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  float pressure = bmp.readPressure() / 100.0F;
  int battery = readBatteryLevel();
  
  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("Failed to read sensors!");
    return;
  }
  
  // Get current timestamp
  time_t now = time(nullptr);
  
  // Create data paths
  String basePath = "/devices/" + DEVICE_ID;
  String dataPath = basePath + "/sensor_data/" + String(now);
  String statusPath = basePath + "/status";
  
  // Upload sensor data
  FirebaseJson json;
  json.set("temperature", temperature);
  json.set("humidity", humidity);
  json.set("pressure", pressure);
  json.set("battery", battery);
  json.set("timestamp", now);
  
  if (Firebase.setJSON(firebaseData, dataPath, json)) {
    Serial.println("Data uploaded to Firebase successfully");
  } else {
    Serial.println("Failed to upload data: " + firebaseData.errorReason());
  }
  
  // Update device status
  FirebaseJson statusJson;
  statusJson.set("last_seen", now);
  statusJson.set("battery", battery);
  statusJson.set("status", "online");
  statusJson.set("wifi_signal", WiFi.RSSI());
  
  Firebase.setJSON(firebaseData, statusPath, statusJson);
  
  // Update latest readings for quick access
  String latestPath = basePath + "/latest";
  Firebase.setJSON(firebaseData, latestPath, json);
  
  Serial.printf("Firebase sync completed at %ld\\n", now);
}

int readBatteryLevel() {
  int rawValue = analogRead(BATTERY_PIN);
  float voltage = (rawValue / 4095.0) * 3.3 * 2;
  int percentage = map(voltage * 100, 300, 420, 0, 100);
  return constrain(percentage, 0, 100);
}`;

  const apiUsageCode = `// API Usage Examples for Weather Station Data

// 1. DIRECT HTTP POST (Default method)
// URL: https://gdmvqskgtdpsktuhsnal.supabase.co/functions/v1/esp32-data
// Method: POST
// Headers: Content-Type: application/json

// Example ESP32 code for direct API:
void sendToAPI() {
  HTTPClient http;
  http.begin("https://gdmvqskgtdpsktuhsnal.supabase.co/functions/v1/esp32-data");
  http.addHeader("Content-Type", "application/json");
  
  StaticJsonDocument<200> doc;
  doc["device_id"] = DEVICE_ID;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  doc["pressure"] = pressure;
  doc["battery"] = battery;
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  int httpResponseCode = http.POST(jsonString);
  String response = http.getString();
  
  Serial.println("API Response: " + String(httpResponseCode));
  Serial.println("Response body: " + response);
  
  http.end();
}

// JavaScript/Web API Usage Examples:
async function getLatestData(deviceId) {
  const response = await fetch('https://gdmvqskgtdpsktuhsnal.supabase.co/functions/v1/api-gateway', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_API_KEY'
    },
    body: JSON.stringify({
      action: 'get_sensor_data',
      device_id: deviceId,
      limit: 10
    })
  });
  
  const data = await response.json();
  console.log('Latest sensor data:', data);
}`;

  const serverApiCode = `// Server API Examples
const express = require('express');
const axios = require('axios');

const API_BASE = 'https://gdmvqskgtdpsktuhsnal.supabase.co/functions/v1/api-gateway';
const API_KEY = 'YOUR_API_KEY_HERE';

app.get('/api/devices', async (req, res) => {
  try {
    const response = await axios.get(\`\${API_BASE}/devices\`, {
      headers: {
        'Authorization': \`Bearer \${API_KEY}\`,
        'Content-Type': 'application/json'
      }
    });
    
    res.json({
      success: true,
      devices: response.data.data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.response?.data?.error || 'Failed to fetch devices'
    });
  }
});

// Flutter/Dart Mobile App Example
class WeatherApiService {
  static const String baseUrl = 'https://gdmvqskgtdpsktuhsnal.supabase.co/functions/v1/api-gateway';
  static const String apiKey = 'YOUR_API_KEY_HERE';
  
  static Map<String, String> get headers => {
    'Authorization': 'Bearer \$apiKey',
    'Content-Type': 'application/json',
  };
  
  static Future<List<dynamic>> getDevices() async {
    final response = await http.get(
      Uri.parse('\$baseUrl/devices'),
      headers: headers,
    );
    
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return data['data'];
    } else {
      throw Exception('Failed to load devices');
    }
  }
}`;

  const wiringDiagram = `// Wiring Diagram for Weather Station
// =====================================

ESP32 Pin    | Component        | Connection
-------------|------------------|------------------
3.3V         | DHT22           | VCC (Pin 1)
GPIO 4       | DHT22           | DATA (Pin 2)
GND          | DHT22           | GND (Pin 4)
-------------|------------------|------------------
3.3V         | BMP280          | VCC
GPIO 21      | BMP280          | SDA
GPIO 22      | BMP280          | SCL
GND          | BMP280          | GND
-------------|------------------|------------------
GPIO 2       | LED             | Anode (+ longer leg)
GND          | LED (via 220Ω)  | Cathode (- shorter leg)
-------------|------------------|------------------
GPIO 36 (A0) | Battery Monitor | Voltage Divider Output

Notes:
- Use 10kΩ pull-up resistor for DHT22 DATA pin
- BMP280 uses I2C communication (SDA/SCL)
- LED resistor value: 220Ω - 1kΩ
- Battery voltage divider: 2x 10kΩ resistors
- Ensure all GND connections are common`;

  const librariesCode = `// Required libraries to install in Arduino IDE:
// 1. ESP32 Board Package
// 2. DHT sensor library by Adafruit
// 3. Adafruit BMP280 Library
// 4. ArduinoJson by Benoit Blanchon
// 5. ESP32Time by fbiego

/*
Installation Instructions:
1. Open Arduino IDE
2. Go to Tools > Board > Boards Manager
3. Search for "ESP32" and install "ESP32 by Espressif Systems"
4. Go to Tools > Manage Libraries
5. Search and install these libraries:
   - "DHT sensor library" by Adafruit
   - "Adafruit BMP280 Library" by Adafruit
   - "ArduinoJson" by Benoit Blanchon
   - "ESP32Time" by fbiego
6. Select your ESP32 board from Tools > Board menu
7. Set the correct COM port in Tools > Port
*/`;

  const configurationSteps = `Configuration Steps:
1. Install Arduino IDE and required libraries
2. Get Device UUID from dashboard (register new device first)
3. Update WiFi credentials in code
4. Update DEVICE_ID with your UUID
5. Wire sensors according to diagram
6. Upload code to ESP32
7. Monitor Serial output for debugging
8. Check dashboard for incoming data`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Thermometer className="w-5 h-5" />
            Weather Station - Complete Integration Guide
          </CardTitle>
          <CardDescription>
            Program lengkap ESP32 untuk Weather Station dengan berbagai protokol komunikasi: HTTP API, MQTT, dan Firebase
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <button 
              onClick={() => handleTabSelect('http')}
              className="p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-4 h-4 text-blue-600" />
                <span className="font-medium">HTTP API</span>
              </div>
              <p className="text-sm text-gray-600">Direct connection ke Supabase database</p>
              <div className="mt-2 text-xs text-blue-600">Click untuk lihat kode</div>
            </button>
            
            <button 
              onClick={() => handleTabSelect('mqtt')}
              className="p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-green-600" />
                <span className="font-medium">MQTT</span>
              </div>
              <p className="text-sm text-gray-600">Real-time messaging protocol</p>
              <div className="mt-2 text-xs text-green-600">Click untuk lihat kode</div>
            </button>
            
            <button 
              onClick={() => handleTabSelect('firebase')}
              className="p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 mb-2">
                <Cloud className="w-4 h-4 text-orange-600" />
                <span className="font-medium">Firebase</span>
              </div>
              <p className="text-sm text-gray-600">Google cloud database sync</p>
              <div className="mt-2 text-xs text-orange-600">Click untuk lihat kode</div>
            </button>
            
            <button 
              onClick={() => handleTabSelect('api-usage')}
              className="p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 mb-2">
                <Wifi className="w-4 h-4 text-purple-600" />
                <span className="font-medium">Multi-Protocol</span>
              </div>
              <p className="text-sm text-gray-600">Support berbagai protokol komunikasi</p>
              <div className="mt-2 text-xs text-purple-600">Click untuk lihat kode</div>
            </button>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="http">HTTP API</TabsTrigger>
              <TabsTrigger value="mqtt">MQTT</TabsTrigger>
              <TabsTrigger value="firebase">Firebase</TabsTrigger>
              <TabsTrigger value="api-usage">API Usage</TabsTrigger>
              <TabsTrigger value="server-api">Server/Mobile</TabsTrigger>
              <TabsTrigger value="wiring">Wiring</TabsTrigger>
              <TabsTrigger value="setup">Setup</TabsTrigger>
            </TabsList>

            <TabsContent value="http">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">HTTP API - Direct Connection</h3>
                {showCode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(esp32MainCode, 'HTTP API code')}
                    className="flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    {copiedSection === 'HTTP API code' ? 'Copied!' : 'Copy Code'}
                  </Button>
                )}
              </div>
              {showCode && (
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{esp32MainCode}</code>
                </pre>
              )}
            </TabsContent>

            <TabsContent value="mqtt">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">MQTT Protocol Integration</h3>
                {showCode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(mqttCode, 'MQTT code')}
                    className="flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    {copiedSection === 'MQTT code' ? 'Copied!' : 'Copy Code'}
                  </Button>
                )}
              </div>
              {showCode && (
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{mqttCode}</code>
                </pre>
              )}
            </TabsContent>

            <TabsContent value="firebase">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Firebase Integration</h3>
                {showCode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(firebaseCode, 'Firebase code')}
                    className="flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    {copiedSection === 'Firebase code' ? 'Copied!' : 'Copy Code'}
                  </Button>
                )}
              </div>
              {showCode && (
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{firebaseCode}</code>
                </pre>
              )}
            </TabsContent>

            <TabsContent value="api-usage">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">API Usage Examples</h3>
                {showCode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(apiUsageCode, 'API usage')}
                    className="flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    {copiedSection === 'API usage' ? 'Copied!' : 'Copy Code'}
                  </Button>
                )}
              </div>
              {showCode && (
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{apiUsageCode}</code>
                </pre>
              )}
            </TabsContent>

            <TabsContent value="server-api">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Server Integration</h3>
                {showCode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(serverApiCode, 'Server API')}
                    className="flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    {copiedSection === 'Server API' ? 'Copied!' : 'Copy Code'}
                  </Button>
                )}
              </div>
              {showCode && (
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{serverApiCode}</code>
                </pre>
              )}
            </TabsContent>

            <TabsContent value="wiring">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Wiring Diagram</h3>
                {showCode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(wiringDiagram, 'Wiring diagram')}
                    className="flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    {copiedSection === 'Wiring diagram' ? 'Copied!' : 'Copy'}
                  </Button>
                )}
              </div>
              {showCode && (
                <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{wiringDiagram}</code>
                </pre>
              )}
            </TabsContent>

            <TabsContent value="setup">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Setup Instructions</h3>
                {showCode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(librariesCode, 'Libraries')}
                    className="flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    {copiedSection === 'Libraries' ? 'Copied!' : 'Copy'}
                  </Button>
                )}
              </div>
              {showCode && (
                <div className="space-y-4">
                  <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                    <code>{librariesCode}</code>
                  </pre>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <pre className="text-sm text-blue-900">
                      <code>{configurationSteps}</code>
                    </pre>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default WeatherStationGuide;
