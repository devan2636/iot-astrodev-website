#!/usr/bin/env python3
"""
MQTT Testing Script for IoT Weather Station
Test MQTT broker connection, data reception, and command sending
"""

import paho.mqtt.client as mqtt
import json
import time
import threading
from datetime import datetime

# MQTT Configuration
MQTT_BROKER = "mqtt.astrodev.cloud"
MQTT_PORT = 1883
MQTT_USERNAME = "astrodev"
MQTT_PASSWORD = "Astroboy26@"

# Test device ID
TEST_DEVICE_ID = "esp32-weather-01"

# MQTT Topics
DATA_TOPIC = f"iot/devices/{TEST_DEVICE_ID}/data"
STATUS_TOPIC = f"iot/devices/{TEST_DEVICE_ID}/status"
COMMAND_TOPIC = f"iot/devices/{TEST_DEVICE_ID}/commands"

class MQTTTester:
    def __init__(self):
        self.client = mqtt.Client()
        self.client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_disconnect = self.on_disconnect
        
        self.received_messages = []
        self.connected = False
        
    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            print(f"✅ Connected to MQTT broker: {MQTT_BROKER}:{MQTT_PORT}")
            self.connected = True
            
            # Subscribe to all device topics
            topics = [
                (DATA_TOPIC, 0),
                (STATUS_TOPIC, 0),
                (f"iot/devices/{TEST_DEVICE_ID}/+", 0)  # Wildcard for all subtopics
            ]
            
            for topic, qos in topics:
                client.subscribe(topic, qos)
                print(f"📡 Subscribed to: {topic}")
                
        else:
            print(f"❌ Failed to connect to MQTT broker. Return code: {rc}")
            self.connected = False
    
    def on_message(self, client, userdata, msg):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        topic = msg.topic
        payload = msg.payload.decode('utf-8')
        
        print(f"\n📨 [{timestamp}] Message received:")
        print(f"   Topic: {topic}")
        print(f"   Payload: {payload}")
        
        # Try to parse JSON
        try:
            json_data = json.loads(payload)
            print(f"   Parsed JSON: {json.dumps(json_data, indent=2)}")
        except json.JSONDecodeError:
            print(f"   Raw data (not JSON): {payload}")
        
        # Store message for analysis
        self.received_messages.append({
            'timestamp': timestamp,
            'topic': topic,
            'payload': payload,
            'json_data': json_data if 'json_data' in locals() else None
        })
        
        print("-" * 50)
    
    def on_disconnect(self, client, userdata, rc):
        print(f"🔌 Disconnected from MQTT broker. Return code: {rc}")
        self.connected = False
    
    def connect(self):
        try:
            print(f"🔄 Connecting to MQTT broker: {MQTT_BROKER}:{MQTT_PORT}")
            print(f"   Username: {MQTT_USERNAME}")
            self.client.connect(MQTT_BROKER, MQTT_PORT, 60)
            self.client.loop_start()
            
            # Wait for connection
            timeout = 10
            while not self.connected and timeout > 0:
                time.sleep(1)
                timeout -= 1
                
            if not self.connected:
                print("❌ Connection timeout!")
                return False
                
            return True
        except Exception as e:
            print(f"❌ Connection error: {e}")
            return False
    
    def send_command(self, command):
        if not self.connected:
            print("❌ Not connected to MQTT broker")
            return False
            
        try:
            print(f"📤 Sending command: {command}")
            result = self.client.publish(COMMAND_TOPIC, command)
            
            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                print(f"✅ Command sent successfully to {COMMAND_TOPIC}")
                return True
            else:
                print(f"❌ Failed to send command. Error code: {result.rc}")
                return False
        except Exception as e:
            print(f"❌ Error sending command: {e}")
            return False
    
    def simulate_sensor_data(self):
        """Simulate sending sensor data (for testing purposes)"""
        if not self.connected:
            print("❌ Not connected to MQTT broker")
            return False
            
        test_data = {
            "temperature": 25.6,
            "humidity": 65.4,
            "pressure": 1013.25,
            "battery": 85
        }
        
        try:
            payload = json.dumps(test_data)
            print(f"📤 Simulating sensor data: {payload}")
            result = self.client.publish(DATA_TOPIC, payload)
            
            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                print(f"✅ Test data sent successfully to {DATA_TOPIC}")
                return True
            else:
                print(f"❌ Failed to send test data. Error code: {result.rc}")
                return False
        except Exception as e:
            print(f"❌ Error sending test data: {e}")
            return False
    
    def run_tests(self):
        print("🧪 Starting MQTT Tests...")
        print("=" * 60)
        
        # Test 1: Connection
        print("\n🔍 Test 1: MQTT Connection")
        if not self.connect():
            print("❌ Connection test failed!")
            return
        
        # Wait for initial messages
        print("\n⏳ Waiting for initial messages (10 seconds)...")
        time.sleep(10)
        
        # Test 2: Send Commands
        print("\n🔍 Test 2: Command Testing")
        commands = [
            "read_sensors",
            "status", 
            "restart",
            "led_on",
            "led_off",
            "calibrate",
            "reset_wifi",
            "deep_sleep",
            "wake_up",
            "factory_reset"
        ]
        
        for cmd in commands:
            print(f"\n📋 Testing command: {cmd}")
            self.send_command(cmd)
            time.sleep(2)  # Wait between commands
        
        # Test 3: Data Simulation
        print("\n🔍 Test 3: Data Simulation")
        self.simulate_sensor_data()
        
        # Test 4: Listen for responses
        print("\n🔍 Test 4: Listening for responses (30 seconds)...")
        time.sleep(30)
        
        # Test Results
        print("\n📊 Test Results Summary:")
        print("=" * 60)
        print(f"Total messages received: {len(self.received_messages)}")
        
        # Group messages by topic
        topic_counts = {}
        for msg in self.received_messages:
            topic = msg['topic']
            topic_counts[topic] = topic_counts.get(topic, 0) + 1
        
        print("\n📈 Messages by topic:")
        for topic, count in topic_counts.items():
            print(f"   {topic}: {count} messages")
        
        # Show recent messages
        print(f"\n📝 Recent messages (last 5):")
        for msg in self.received_messages[-5:]:
            print(f"   [{msg['timestamp']}] {msg['topic']}: {msg['payload'][:50]}...")
    
    def disconnect(self):
        if self.connected:
            self.client.loop_stop()
            self.client.disconnect()
            print("🔌 Disconnected from MQTT broker")

def main():
    print("🚀 MQTT Weather Station Tester")
    print("=" * 60)
    
    tester = MQTTTester()
    
    try:
        tester.run_tests()
    except KeyboardInterrupt:
        print("\n⏹️  Test interrupted by user")
    except Exception as e:
        print(f"\n❌ Test error: {e}")
    finally:
        tester.disconnect()
        print("\n✅ Testing completed!")

if __name__ == "__main__":
    main()
