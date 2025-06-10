
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Wifi, Code, Database } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const ESP32Guide = () => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const apiUrl = "https://gdmvqskgtdpsktuhsnal.supabase.co/functions/v1/esp32-data";

  const esp32Code = `#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Server configuration
const char* serverURL = "${apiUrl}";

// Sensor pins
#define DHT_PIN 4
#define DHT_TYPE DHT22
DHT dht(DHT_PIN, DHT_TYPE);

// Device ID (ganti dengan ID device Anda dari database)
String deviceId = "YOUR_DEVICE_ID_FROM_DATABASE";

void setup() {
  Serial.begin(115200);
  dht.begin();
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println();
  Serial.print("Connected! IP address: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  // Read sensor data
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  float battery = getBatteryLevel(); // Implement this function
  
  // Check if readings are valid
  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("Failed to read from DHT sensor!");
    delay(2000);
    return;
  }
  
  // Send data to server
  sendSensorData(temperature, humidity, battery);
  
  // Wait 30 seconds before next reading
  delay(30000);
}

void sendSensorData(float temp, float hum, float bat) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverURL);
    http.addHeader("Content-Type", "application/json");
    
    // Create JSON payload
    StaticJsonDocument<200> doc;
    doc["device_id"] = deviceId;
    doc["temperature"] = temp;
    doc["humidity"] = hum;
    doc["battery"] = bat;
    
    String jsonString;
    serializeJson(doc, jsonString);
    
    // Send POST request
    int httpResponseCode = http.POST(jsonString);
    
    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.println("HTTP Response: " + String(httpResponseCode));
      Serial.println("Response: " + response);
    } else {
      Serial.println("Error sending data: " + String(httpResponseCode));
    }
    
    http.end();
  } else {
    Serial.println("WiFi not connected");
  }
}

float getBatteryLevel() {
  // Implement battery reading based on your setup
  // This is just an example
  int batteryValue = analogRead(A0);
  float voltage = (batteryValue * 3.3) / 4095.0;
  float percentage = ((voltage - 3.0) / (4.2 - 3.0)) * 100.0;
  return constrain(percentage, 0, 100);
}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(esp32Code);
    setCopied(true);
    toast({
      title: "Copied!",
      description: "ESP32 code copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">ESP32 Integration Guide</h1>
        <p className="text-gray-600">Panduan lengkap untuk menghubungkan ESP32 dengan sistem IoT monitoring</p>
      </div>

      {/* API Endpoint Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            API Endpoint Information
          </CardTitle>
          <CardDescription>Endpoint untuk mengirim data sensor dari ESP32</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">POST URL:</label>
            <div className="mt-1 p-3 bg-gray-100 rounded-md font-mono text-sm break-all">
              {apiUrl}
            </div>
          </div>
          
          <div>
            <label className="text-sm font-medium text-gray-700">Expected JSON Format:</label>
            <pre className="mt-1 p-3 bg-gray-100 rounded-md text-sm overflow-x-auto">
{`{
  "device_id": "uuid-from-database",
  "temperature": 25.5,
  "humidity": 60.2,
  "pressure": 1013.25,
  "battery": 85
}`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Requirements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="w-5 h-5" />
            Requirements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">Hardware:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• ESP32 Development Board</li>
                <li>• DHT22 Temperature & Humidity Sensor</li>
                <li>• BMP180/BMP280 Pressure Sensor (Optional)</li>
                <li>• Jumper wires & Breadboard</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Software:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Arduino IDE</li>
                <li>• ESP32 Board Package</li>
                <li>• DHT sensor library</li>
                <li>• ArduinoJson library</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ESP32 Code */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="w-5 h-5" />
            ESP32 Arduino Code
          </CardTitle>
          <CardDescription>Copy dan upload code ini ke ESP32 Anda</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Button
              onClick={copyToClipboard}
              className="absolute top-2 right-2 z-10"
              size="sm"
              variant="outline"
            >
              <Copy className="w-4 h-4 mr-1" />
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm max-h-96 overflow-y-auto">
              <code>{esp32Code}</code>
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Setup Steps */}
      <Card>
        <CardHeader>
          <CardTitle>Setup Steps</CardTitle>
          <CardDescription>Langkah-langkah untuk menghubungkan ESP32</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <Badge variant="default" className="mt-1">1</Badge>
              <div>
                <h4 className="font-medium">Register Device</h4>
                <p className="text-sm text-gray-600">Daftarkan device ESP32 Anda di halaman Devices dan catat Device ID yang dihasilkan.</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <Badge variant="default" className="mt-1">2</Badge>
              <div>
                <h4 className="font-medium">Install Libraries</h4>
                <p className="text-sm text-gray-600">Install library yang diperlukan di Arduino IDE: DHT sensor library, ArduinoJson.</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <Badge variant="default" className="mt-1">3</Badge>
              <div>
                <h4 className="font-medium">Configure Code</h4>
                <p className="text-sm text-gray-600">Update WiFi credentials dan Device ID di code Arduino.</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <Badge variant="default" className="mt-1">4</Badge>
              <div>
                <h4 className="font-medium">Wire Sensors</h4>
                <p className="text-sm text-gray-600">Hubungkan sensor DHT22 ke pin 4 ESP32 (atau sesuaikan dengan code).</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <Badge variant="default" className="mt-1">5</Badge>
              <div>
                <h4 className="font-medium">Upload & Test</h4>
                <p className="text-sm text-gray-600">Upload code ke ESP32 dan monitor serial untuk memastikan koneksi berhasil.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Troubleshooting */}
      <Card>
        <CardHeader>
          <CardTitle>Troubleshooting</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <h4 className="font-medium text-sm">WiFi Connection Issues:</h4>
              <p className="text-sm text-gray-600">Pastikan SSID dan password WiFi benar, dan ESP32 dalam jangkauan sinyal.</p>
            </div>
            <div>
              <h4 className="font-medium text-sm">Sensor Reading Errors:</h4>
              <p className="text-sm text-gray-600">Periksa koneksi kabel sensor dan pastikan library DHT terinstall dengan benar.</p>
            </div>
            <div>
              <h4 className="font-medium text-sm">API Connection Errors:</h4>
              <p className="text-sm text-gray-600">Verifikasi Device ID sudah terdaftar di database dan format JSON sesuai.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ESP32Guide;
