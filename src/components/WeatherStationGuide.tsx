import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Download, Wifi, Thermometer, Droplets, Gauge, Cloud, Zap, Database } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const WeatherStationGuide = () => {
  const [copiedSection, setCopiedSection] = useState('');
  const { toast } = useToast();

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
}

// Utility function to get MAC address
String getMacAddress() {
  uint8_t mac[6];
  WiFi.macAddress(mac);
  String macStr = "";
  for (int i = 0; i < 6; i++) {
    if (i > 0) macStr += ":";
    if (mac[i] < 16) macStr += "0";
    macStr += String(mac[i], HEX);
  }
  macStr.toUpperCase();
  return macStr;
}

// Function to print system info
void printSystemInfo() {
  Serial.println("=== Weather Station Info ===");
  Serial.println("Device ID: " + DEVICE_ID);
  Serial.println("MAC Address: " + getMacAddress());
  Serial.println("IP Address: " + WiFi.localIP().toString());
  Serial.println("Signal Strength: " + String(WiFi.RSSI()) + " dBm");
  Serial.printf("Free Heap: %d bytes\\n", ESP.getFreeHeap());
  Serial.println("============================");
}`;

  const mqttCode = `#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <Wire.h>
#include <Adafruit_BMP280.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// MQTT Configuration
const char* mqtt_server = "broker.hivemq.com"; // Public MQTT broker
const int mqtt_port = 1883;
const char* mqtt_client_id = "WeatherStation_001";
const char* mqtt_username = ""; // Optional
const char* mqtt_password = ""; // Optional

// MQTT Topics
const char* topic_temperature = "weather/temperature";
const char* topic_humidity = "weather/humidity";
const char* topic_pressure = "weather/pressure";
const char* topic_battery = "weather/battery";
const char* topic_status = "weather/status";

// Device Configuration
const String DEVICE_ID = "YOUR_DEVICE_UUID";

// Sensor configuration
#define DHT_PIN 4
#define DHT_TYPE DHT22
#define BATTERY_PIN A0
#define LED_PIN 2

// Objects
DHT dht(DHT_PIN, DHT_TYPE);
Adafruit_BMP280 bmp;
WiFiClient espClient;
PubSubClient client(espClient);

// Timing variables
unsigned long lastMqttPublish = 0;
const unsigned long MQTT_INTERVAL = 30000; // Publish every 30 seconds

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
    
    if (client.connect(mqtt_client_id, mqtt_username, mqtt_password)) {
      Serial.println("MQTT connected!");
      
      // Subscribe to command topics
      client.subscribe("weather/command");
      
      // Publish status
      client.publish(topic_status, "online");
      
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
  if (String(topic) == "weather/command") {
    if (message == "read_sensors") {
      publishSensorData();
    } else if (message == "restart") {
      ESP.restart();
    }
  }
}

void publishSensorData() {
  // Read sensors
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  float pressure = bmp.readPressure() / 100.0F;
  int battery = readBatteryLevel();
  
  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("Failed to read sensors!");
    return;
  }
  
  // Create JSON payload
  StaticJsonDocument<200> doc;
  doc["device_id"] = DEVICE_ID;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  doc["pressure"] = pressure;
  doc["battery"] = battery;
  doc["timestamp"] = WiFi.getTime();
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  // Publish individual topics
  client.publish(topic_temperature, String(temperature).c_str());
  client.publish(topic_humidity, String(humidity).c_str());
  client.publish(topic_pressure, String(pressure).c_str());
  client.publish(topic_battery, String(battery).c_str());
  
  // Publish combined JSON data
  client.publish("weather/data", jsonString.c_str());
  
  Serial.println("MQTT Data published: " + jsonString);
}

int readBatteryLevel() {
  int rawValue = analogRead(BATTERY_PIN);
  float voltage = (rawValue / 4095.0) * 3.3 * 2;
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

// 2. MQTT BRIDGE API
// URL: https://gdmvqskgtdpsktuhsnal.supabase.co/functions/v1/mqtt-bridge
// Method: POST

void sendToMQTTBridge() {
  HTTPClient http;
  http.begin("https://gdmvqskgtdpsktuhsnal.supabase.co/functions/v1/mqtt-bridge");
  http.addHeader("Content-Type", "application/json");
  
  StaticJsonDocument<200> doc;
  doc["type"] = "sensor_data";
  doc["device_id"] = DEVICE_ID;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  doc["pressure"] = pressure;
  doc["battery"] = battery;
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  int httpResponseCode = http.POST(jsonString);
  http.end();
}

// 3. FIREBASE SYNC API
// URL: https://gdmvqskgtdpsktuhsnal.supabase.co/functions/v1/firebase-sync
// Method: POST

void syncToFirebase() {
  HTTPClient http;
  http.begin("https://gdmvqskgtdpsktuhsnal.supabase.co/functions/v1/firebase-sync");
  http.addHeader("Content-Type", "application/json");
  
  StaticJsonDocument<200> doc;
  doc["type"] = "sync_sensor_data";
  doc["device_id"] = DEVICE_ID;
  doc["limit"] = 100;
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  int httpResponseCode = http.POST(jsonString);
  http.end();
}

// 4. WEATHER PREDICTION API
// URL: https://gdmvqskgtdpsktuhsnal.supabase.co/functions/v1/weather-prediction
// Method: POST

void getWeatherPrediction() {
  HTTPClient http;
  http.begin("https://gdmvqskgtdpsktuhsnal.supabase.co/functions/v1/weather-prediction");
  http.addHeader("Content-Type", "application/json");
  
  StaticJsonDocument<100> doc;
  doc["device_id"] = DEVICE_ID;
  doc["hours_ahead"] = 2; // Predict 2 hours ahead
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  int httpResponseCode = http.POST(jsonString);
  if (httpResponseCode == 200) {
    String response = http.getString();
    Serial.println("Weather Prediction: " + response);
  }
  
  http.end();
}

// JavaScript/Web API Usage Examples:

// Fetch latest sensor data
async function getLatestData(deviceId) {
  const response = await fetch(\`https://gdmvqskgtdpsktuhsnal.supabase.co/functions/v1/api-gateway\`, {
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
}

// Send command to device
async function sendCommand(deviceId, command) {
  const response = await fetch(\`https://gdmvqskgtdpsktuhsnal.supabase.co/functions/v1/mqtt-bridge\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'command',
      device_id: deviceId,
      command: command
    })
  });
  
  const result = await response.json();
  console.log('Command sent:', result);
}`;

  const serverApiCode = `// ===============================================
// SERVER/MOBILE APP API ACCESS EXAMPLES
// ===============================================

// 1. GET DEVICE LIST (API Gateway)
// URL: GET https://gdmvqskgtdpsktuhsnal.supabase.co/functions/v1/api-gateway/devices
// Headers: Authorization: Bearer YOUR_API_KEY

// Example: Node.js/Express Server
const express = require('express');
const axios = require('axios');

const API_BASE = 'https://gdmvqskgtdpsktuhsnal.supabase.co/functions/v1/api-gateway';
const API_KEY = 'YOUR_API_KEY_HERE'; // Generate from API Key Manager

// Get all registered devices
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

// 2. GET SPECIFIC DEVICE SENSOR DATA
// URL: GET https://gdmvqskgtdpsktuhsnal.supabase.co/functions/v1/api-gateway/sensor-data/{device_id}?limit=100&hours=24

app.get('/api/devices/:deviceId/data', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { limit = 100, hours = 24 } = req.query;
    
    const response = await axios.get(\`\${API_BASE}/sensor-data/\${deviceId}\`, {
      headers: {
        'Authorization': \`Bearer \${API_KEY}\`,
        'Content-Type': 'application/json'
      },
      params: { limit, hours }
    });
    
    res.json({
      success: true,
      device_id: deviceId,
      data: response.data.data,
      total_records: response.data.data.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.response?.data?.error || 'Failed to fetch sensor data'
    });
  }
});

// 3. GET ACTIVE SENSORS
// URL: GET https://gdmvqskgtdpsktuhsnal.supabase.co/functions/v1/api-gateway/sensors

app.get('/api/sensors', async (req, res) => {
  try {
    const response = await axios.get(\`\${API_BASE}/sensors\`, {
      headers: {
        'Authorization': \`Bearer \${API_KEY}\`,
        'Content-Type': 'application/json'
      }
    });
    
    res.json({
      success: true,
      sensors: response.data.data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.response?.data?.error || 'Failed to fetch sensors'
    });
  }
});

// 4. FLUTTER/DART MOBILE APP EXAMPLE
/*
// Add to pubspec.yaml:
dependencies:
  http: ^0.13.5
  
// Dart code for Flutter mobile app:
import 'dart:convert';
import 'package:http/http.dart' as http;

class WeatherApiService {
  static const String baseUrl = 'https://gdmvqskgtdpsktuhsnal.supabase.co/functions/v1/api-gateway';
  static const String apiKey = 'YOUR_API_KEY_HERE';
  
  static Map<String, String> get headers => {
    'Authorization': 'Bearer \$apiKey',
    'Content-Type': 'application/json',
  };
  
  // Get all devices
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
  
  // Get device sensor data
  static Future<List<dynamic>> getDeviceData(String deviceId, {int limit = 100, int hours = 24}) async {
    final response = await http.get(
      Uri.parse('\$baseUrl/sensor-data/\$deviceId?limit=\$limit&hours=\$hours'),
      headers: headers,
    );
    
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return data['data'];
    } else {
      throw Exception('Failed to load device data');
    }
  }
  
  // Get latest reading for a device
  static Future<Map<String, dynamic>?> getLatestReading(String deviceId) async {
    final data = await getDeviceData(deviceId, limit: 1);
    return data.isNotEmpty ? data.first : null;
  }
}

// Usage in Flutter Widget:
class WeatherDashboard extends StatefulWidget {
  @override
  _WeatherDashboardState createState() => _WeatherDashboardState();
}

class _WeatherDashboardState extends State<WeatherDashboard> {
  List<dynamic> devices = [];
  Map<String, dynamic>? selectedDeviceData;
  
  @override
  void initState() {
    super.initState();
    loadDevices();
  }
  
  Future<void> loadDevices() async {
    try {
      final deviceList = await WeatherApiService.getDevices();
      setState(() {
        devices = deviceList;
      });
    } catch (e) {
      print('Error loading devices: \$e');
    }
  }
  
  Future<void> loadDeviceData(String deviceId) async {
    try {
      final data = await WeatherApiService.getLatestReading(deviceId);
      setState(() {
        selectedDeviceData = data;
      });
    } catch (e) {
      print('Error loading device data: \$e');
    }
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Weather Stations')),
      body: Column(
        children: [
          // Device list
          Expanded(
            flex: 1,
            child: ListView.builder(
              itemCount: devices.length,
              itemBuilder: (context, index) {
                final device = devices[index];
                return ListTile(
                  title: Text(device['name']),
                  subtitle: Text(device['location']),
                  trailing: Icon(
                    device['status'] == 'online' ? Icons.circle : Icons.circle_outlined,
                    color: device['status'] == 'online' ? Colors.green : Colors.red,
                  ),
                  onTap: () => loadDeviceData(device['id']),
                );
              },
            ),
          ),
          // Selected device data
          if (selectedDeviceData != null)
            Expanded(
              flex: 1,
              child: Card(
                margin: EdgeInsets.all(16),
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: Column(
                    children: [
                      Text('Latest Reading', style: Theme.of(context).textTheme.headlineSmall),
                      SizedBox(height: 16),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          Column(
                            children: [
                              Icon(Icons.thermostat, size: 40),
                              Text('\${selectedDeviceData!['temperature']}°C'),
                              Text('Temperature'),
                            ],
                          ),
                          Column(
                            children: [
                              Icon(Icons.water_drop, size: 40),
                              Text('\${selectedDeviceData!['humidity']}%'),
                              Text('Humidity'),
                            ],
                          ),
                          Column(
                            children: [
                              Icon(Icons.speed, size: 40),
                              Text('\${selectedDeviceData!['pressure']} hPa'),
                              Text('Pressure'),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
*/

// 5. PYTHON BACKEND EXAMPLE
/*
# pip install requests

import requests
import json
from datetime import datetime

class WeatherStationAPI:
    def __init__(self, api_key):
        self.base_url = "https://gdmvqskgtdpsktuhsnal.supabase.co/functions/v1/api-gateway"
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    
    def get_devices(self):
        """Get all registered devices"""
        response = requests.get(f"{self.base_url}/devices", headers=self.headers)
        if response.status_code == 200:
            return response.json()["data"]
        else:
            raise Exception(f"API Error: {response.status_code} - {response.text}")
    
    def get_device_data(self, device_id, limit=100, hours=24):
        """Get sensor data for specific device"""
        params = {"limit": limit, "hours": hours}
        response = requests.get(
            f"{self.base_url}/sensor-data/{device_id}", 
            headers=self.headers, 
            params=params
        )
        if response.status_code == 200:
            return response.json()["data"]
        else:
            raise Exception(f"API Error: {response.status_code} - {response.text}")
    
    def get_sensors(self):
        """Get all active sensors"""
        response = requests.get(f"{self.base_url}/sensors", headers=self.headers)
        if response.status_code == 200:
            return response.json()["data"]
        else:
            raise Exception(f"API Error: {response.status_code} - {response.text}")

# Usage example:
if __name__ == "__main__":
    api = WeatherStationAPI("YOUR_API_KEY_HERE")
    
    # Get all devices
    devices = api.get_devices()
    print(f"Found {len(devices)} devices:")
    
    for device in devices:
        print(f"- {device['name']} ({device['location']}) - Status: {device['status']}")
        
        # Get latest data for each device
        try:
            data = api.get_device_data(device['id'], limit=1)
            if data:
                latest = data[0]
                print(f"  Latest reading: {latest['temperature']}°C, {latest['humidity']}%, {latest['pressure']}hPa")
                print(f"  Timestamp: {latest['timestamp']}")
        except Exception as e:
            print(f"  Error getting data: {e}")
        print()
*/

// 6. API RESPONSE FORMATS

/*
// GET /devices response:
{
  "data": [
    {
      "id": "uuid",
      "name": "Weather Station 1",
      "location": "Jakarta Selatan",
      "type": "outdoor",
      "status": "online",
      "battery": 85,
      "latitude": -6.2,
      "longitude": 106.8,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T12:00:00Z"
    }
  ]
}

// GET /sensor-data/{device_id} response:
{
  "data": [
    {
      "id": "uuid",
      "device_id": "uuid",
      "temperature": 25.5,
      "humidity": 60.2,
      "pressure": 1013.25,
      "battery": 85,
      "timestamp": "2024-01-01T12:00:00Z"
    }
  ]
}

// GET /sensors response:
{
  "data": [
    {
      "id": "uuid",
      "device_id": "uuid",
      "name": "Temperature Sensor",
      "type": "temperature",
      "unit": "°C",
      "is_active": true,
      "devices": {
        "name": "Weather Station 1",
        "location": "Jakarta Selatan"
      }
    }
  ]
}
*/

// ERROR HANDLING EXAMPLES
/*
// Common error responses:
{
  "error": "API key required"           // 401 - Missing API key
}
{
  "error": "Invalid API key"           // 401 - Wrong API key
}
{
  "error": "API key expired"           // 401 - Expired API key
}
{
  "error": "Insufficient permissions"  // 403 - Read-only key trying to write
}
{
  "error": "Route not found"          // 404 - Invalid endpoint
}
{
  "error": "Internal server error"    // 500 - Server error
}
*/`;

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
3.3V         | Voltage Divider | 10kΩ to Battery+
GND          | Voltage Divider | 10kΩ to Battery-

Notes:
- Use 10kΩ pull-up resistor for DHT22 DATA pin
- BMP280 uses I2C communication (SDA/SCL)
- LED resistor value: 220Ω - 1kΩ
- Battery voltage divider: 2x 10kΩ resistors
- Ensure all GND connections are common`;

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
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-4 h-4 text-blue-600" />
                <span className="font-medium">HTTP API</span>
              </div>
              <p className="text-sm text-gray-600">Direct connection ke Supabase database</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-green-600" />
                <span className="font-medium">MQTT</span>
              </div>
              <p className="text-sm text-gray-600">Real-time messaging protocol</p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Cloud className="w-4 h-4 text-orange-600" />
                <span className="font-medium">Firebase</span>
              </div>
              <p className="text-sm text-gray-600">Google cloud database sync</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Wifi className="w-4 h-4 text-purple-600" />
                <span className="font-medium">Multi-Protocol</span>
              </div>
              <p className="text-sm text-gray-600">Support berbagai protokol komunikasi</p>
            </div>
          </div>

          <Tabs defaultValue="http" className="w-full">
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="http">HTTP API</TabsTrigger>
              <TabsTrigger value="mqtt">MQTT</TabsTrigger>
              <TabsTrigger value="firebase">Firebase</TabsTrigger>
              <TabsTrigger value="api-usage">API Usage</TabsTrigger>
              <TabsTrigger value="server-api">Server/Mobile</TabsTrigger>
              <TabsTrigger value="wiring">Wiring</TabsTrigger>
              <TabsTrigger value="setup">Setup</TabsTrigger>
            </TabsList>

            <TabsContent value="http" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">HTTP API - Direct Connection</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(esp32MainCode, 'HTTP API code')}
                  className="flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  {copiedSection === 'HTTP API code' ? 'Copied!' : 'Copy Code'}
                </Button>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg mb-4">
                <h4 className="font-medium text-blue-900 mb-2">Keunggulan HTTP API:</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Koneksi langsung ke database Supabase</li>
                  <li>• Simple dan mudah diimplementasi</li>
                  <li>• Built-in authentication dan security</li>
                  <li>• Real-time updates via webhooks</li>
                </ul>
              </div>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm max-h-96 overflow-y-auto">
                <code>{esp32MainCode}</code>
              </pre>
            </TabsContent>

            <TabsContent value="mqtt" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">MQTT Protocol Integration</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(mqttCode, 'MQTT code')}
                  className="flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  {copiedSection === 'MQTT code' ? 'Copied!' : 'Copy Code'}
                </Button>
              </div>
              <div className="p-4 bg-green-50 rounded-lg mb-4">
                <h4 className="font-medium text-green-900 mb-2">Keunggulan MQTT:</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Low bandwidth dan battery efficient</li>
                  <li>• Publish/Subscribe model</li>
                  <li>• Bi-directional communication</li>
                  <li>• Quality of Service (QoS) levels</li>
                  <li>• Perfect untuk IoT devices</li>
                </ul>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg mb-4">
                <h4 className="font-medium text-yellow-900 mb-2">MQTT Topics Structure:</h4>
                <div className="text-sm text-yellow-700 space-y-1">
                  <p><code>weather/temperature</code> - Temperature readings</p>
                  <p><code>weather/humidity</code> - Humidity readings</p>
                  <p><code>weather/pressure</code> - Pressure readings</p>
                  <p><code>weather/data</code> - Combined JSON data</p>
                  <p><code>weather/command</code> - Device commands</p>
                </div>
              </div>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm max-h-96 overflow-y-auto">
                <code>{mqttCode}</code>
              </pre>
            </TabsContent>

            <TabsContent value="firebase" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Firebase Realtime Database</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(firebaseCode, 'Firebase code')}
                  className="flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  {copiedSection === 'Firebase code' ? 'Copied!' : 'Copy Code'}
                </Button>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg mb-4">
                <h4 className="font-medium text-orange-900 mb-2">Keunggulan Firebase:</h4>
                <ul className="text-sm text-orange-700 space-y-1">
                  <li>• Real-time synchronization</li>
                  <li>• Offline data persistence</li>
                  <li>• Google Cloud integration</li>
                  <li>• Mobile app development support</li>
                  <li>• Built-in analytics dan monitoring</li>
                </ul>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg mb-4">
                <h4 className="font-medium text-blue-900 mb-2">Firebase Data Structure:</h4>
                <pre className="text-sm text-blue-700">
{`/devices
  /{device_id}
    /latest
      temperature: 25.5
      humidity: 60.2
      pressure: 1013.25
      battery: 85
      timestamp: 1640995200
    /sensor_data
      /{timestamp}
        temperature: 25.5
        humidity: 60.2
        ...
    /status
      last_seen: 1640995200
      battery: 85
      status: "online"`}
                </pre>
              </div>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm max-h-96 overflow-y-auto">
                <code>{firebaseCode}</code>
              </pre>
            </TabsContent>

            <TabsContent value="api-usage" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">API Usage & Integration</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(apiUsageCode, 'API usage')}
                  className="flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  {copiedSection === 'API usage' ? 'Copied!' : 'Copy Code'}
                </Button>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg mb-4">
                <h4 className="font-medium text-purple-900 mb-2">Available APIs:</h4>
                <ul className="text-sm text-purple-700 space-y-1">
                  <li>• <strong>ESP32 Data API</strong> - Direct sensor data upload</li>
                  <li>• <strong>MQTT Bridge API</strong> - MQTT protocol bridge</li>
                  <li>• <strong>Firebase Sync API</strong> - Firebase synchronization</li>
                  <li>• <strong>Weather Prediction API</strong> - AI-powered predictions</li>
                  <li>• <strong>API Gateway</strong> - Unified API access</li>
                </ul>
              </div>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm max-h-96 overflow-y-auto">
                <code>{apiUsageCode}</code>
              </pre>
            </TabsContent>

            <TabsContent value="server-api" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Server & Mobile App API Access</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(serverApiCode, 'Server API examples')}
                  className="flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  {copiedSection === 'Server API examples' ? 'Copied!' : 'Copy Code'}
                </Button>
              </div>
              <div className="p-4 bg-indigo-50 rounded-lg mb-4">
                <h4 className="font-medium text-indigo-900 mb-2">API Gateway Endpoints untuk Server/Mobile App:</h4>
                <ul className="text-sm text-indigo-700 space-y-2">
                  <li>• <code>GET /api-gateway/devices</code> - List semua device terdaftar</li>
                  <li>• <code>GET /api-gateway/sensor-data/{`{device_id}`}</code> - Data sensor spesifik device</li>
                  <li>• <code>GET /api-gateway/sensors</code> - List semua sensor aktif</li>
                  <li>• <code>POST /api-gateway/sensor-data</code> - Kirim data sensor (write permission)</li>
                </ul>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <h5 className="font-medium text-blue-900 mb-1">Node.js/Express</h5>
                  <p className="text-xs text-blue-700">Server backend dengan axios untuk HTTP requests</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <h5 className="font-medium text-green-900 mb-1">Flutter/Dart</h5>
                  <p className="text-xs text-green-700">Mobile app dengan http package</p>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg">
                  <h5 className="font-medium text-orange-900 mb-1">Python</h5>
                  <p className="text-xs text-orange-700">Backend dengan requests library</p>
                </div>
              </div>
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
                <h4 className="font-medium text-yellow-800 mb-2">Authentication Required:</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Generate API Key dari <strong>API Key Manager</strong> di dashboard</li>
                  <li>• Gunakan header: <code>Authorization: Bearer YOUR_API_KEY</code></li>
                  <li>• Set permissions: <code>read</code> atau <code>write</code></li>
                  <li>• API Key bisa di-expire untuk security</li>
                </ul>
              </div>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm max-h-96 overflow-y-auto">
                <code>{serverApiCode}</code>
              </pre>
            </TabsContent>

            <TabsContent value="wiring" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Wiring Diagram</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(wiringDiagram, 'Wiring diagram')}
                  className="flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  {copiedSection === 'Wiring diagram' ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                <code>{wiringDiagram}</code>
              </pre>
            </TabsContent>

            <TabsContent value="setup" className="space-y-4">
              <h3 className="text-lg font-semibold">Configuration Steps</h3>
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">1. Library Installation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm"><strong>HTTP API:</strong> WiFi, HTTPClient, ArduinoJson, DHT, Adafruit_BMP280</p>
                      <p className="text-sm"><strong>MQTT:</strong> PubSubClient (additional)</p>
                      <p className="text-sm"><strong>Firebase:</strong> FirebaseESP32 (additional)</p>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">2. Protocol Selection</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="p-3 bg-blue-50 rounded">
                        <p className="text-sm font-medium">HTTP API - Recommended untuk:</p>
                        <p className="text-xs text-gray-600">Simple deployment, direct database access, built-in security</p>
                      </div>
                      <div className="p-3 bg-green-50 rounded">
                        <p className="text-sm font-medium">MQTT - Recommended untuk:</p>
                        <p className="text-xs text-gray-600">Low power applications, real-time communication, multiple subscribers</p>
                      </div>
                      <div className="p-3 bg-orange-50 rounded">
                        <p className="text-sm font-medium">Firebase - Recommended untuk:</p>
                        <p className="text-xs text-gray-600">Mobile app integration, offline capability, Google ecosystem</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">3. Configuration Parameters</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <p><strong>WiFi:</strong> Update SSID dan password</p>
                      <p><strong>Device ID:</strong> Get dari dashboard setelah register device</p>
                      <p><strong>MQTT Broker:</strong> Configure broker address dan credentials</p>
                      <p><strong>Firebase:</strong> Setup project ID dan database secret</p>
                      <p><strong>API Keys:</strong> Generate dari API Key Manager (jika diperlukan)</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-3">Protocol Comparison</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Feature</th>
                    <th className="text-left p-2">HTTP API</th>
                    <th className="text-left p-2">MQTT</th>
                    <th className="text-left p-2">Firebase</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-2 font-medium">Setup Complexity</td>
                    <td className="p-2">Simple</td>
                    <td className="p-2">Medium</td>
                    <td className="p-2">Medium</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-medium">Real-time</td>
                    <td className="p-2">Via Webhooks</td>
                    <td className="p-2">Native</td>
                    <td className="p-2">Native</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-medium">Offline Support</td>
                    <td className="p-2">No</td>
                    <td className="p-2">Limited</td>
                    <td className="p-2">Yes</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-medium">Battery Efficiency</td>
                    <td className="p-2">Good</td>
                    <td className="p-2">Excellent</td>
                    <td className="p-2">Good</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-medium">Scalability</td>
                    <td className="p-2">High</td>
                    <td className="p-2">Very High</td>
                    <td className="p-2">High</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-medium text-yellow-800 mb-2">Important Notes:</h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• Pilih protokol sesuai dengan kebutuhan aplikasi Anda</li>
              <li>• HTTP API paling mudah untuk pemula</li>
              <li>• MQTT ideal untuk aplikasi IoT skala besar</li>
              <li>• Firebase bagus untuk mobile app integration</li>
              <li>• Server/Mobile app dapat mengakses semua data via API Gateway</li>
              <li>• Gunakan API Key Manager untuk generate credentials yang aman</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WeatherStationGuide;
