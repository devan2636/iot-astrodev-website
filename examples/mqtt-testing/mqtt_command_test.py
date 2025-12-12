#!/usr/bin/env python3
import paho.mqtt.client as mqtt
import time
import ssl
import json

# MQTT Configuration
broker_address = "mqtt.astrodev.cloud"
port = 443
transport_protocol = "websockets"
client_id = "command_tester_devan"
username = "astrodev"
password = "Astroboy26@"

# Test device ID
test_device_id = "esp32-weather-01"

# MQTT Topics
command_topic = f"iot/devices/{test_device_id}/commands"
response_topic = f"iot/devices/{test_device_id}/response"
data_topic = f"iot/devices/{test_device_id}/data"
status_topic = f"iot/devices/{test_device_id}/status"

# Available commands to test
commands_to_test = [
    "read_sensors",
    "status", 
    "led_on",
    "led_off",
    "calibrate",
    "restart",
    "reset_wifi",
    "deep_sleep",
    "factory_reset"
]

received_messages = []

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ Berhasil terhubung ke Broker MQTT (Command Tester)!")
        
        # Subscribe to response and data topics
        topics_to_subscribe = [
            (response_topic, 0),
            (data_topic, 0),
            (status_topic, 0),
            (f"iot/devices/{test_device_id}/+", 0)  # Wildcard for all device topics
        ]
        
        for topic, qos in topics_to_subscribe:
            client.subscribe(topic, qos)
            print(f"📡 Subscribed to: {topic}")
            
    else:
        print(f"❌ Gagal terhubung, kode balasan: {rc}")

def on_message(client, userdata, msg):
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    topic = msg.topic
    payload = msg.payload.decode('utf-8')
    
    print(f"\n📨 [{timestamp}] Message received:")
    print(f"   Topic: {topic}")
    print(f"   Payload: {payload}")
    
    # Try to parse JSON
    try:
        json_data = json.loads(payload)
        print(f"   Parsed JSON:")
        for key, value in json_data.items():
            print(f"     {key}: {value}")
    except json.JSONDecodeError:
        print(f"   Raw data (not JSON): {payload}")
    
    # Store message
    received_messages.append({
        'timestamp': timestamp,
        'topic': topic,
        'payload': payload
    })
    
    print("-" * 50)

def on_publish(client, userdata, mid):
    print(f"✅ Command published successfully (mid: {mid})")

def send_command(client, command):
    print(f"\n📤 Sending command: '{command}' to topic: {command_topic}")
    result = client.publish(command_topic, command)
    
    if result.rc == mqtt.MQTT_ERR_SUCCESS:
        print(f"✅ Command '{command}' sent successfully")
        return True
    else:
        print(f"❌ Failed to send command '{command}'. Error code: {result.rc}")
        return False

def main():
    print("🧪 MQTT Command Tester for ESP32 Weather Station")
    print("=" * 60)
    
    # Create MQTT client
    client = mqtt.Client(client_id=client_id, transport=transport_protocol)
    
    # Set credentials
    client.username_pw_set(username, password)
    
    # Configure TLS/SSL
    client.tls_set(tls_version=ssl.PROTOCOL_TLS)
    
    # Set callbacks
    client.on_connect = on_connect
    client.on_message = on_message
    client.on_publish = on_publish
    
    # Connect to broker
    print(f"🔄 Connecting to MQTT broker: {broker_address}:{port}")
    try:
        client.connect(broker_address, port)
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return
    
    # Start network loop
    client.loop_start()
    
    # Wait for connection
    time.sleep(3)
    
    print(f"\n🎯 Testing {len(commands_to_test)} commands...")
    print("=" * 60)
    
    try:
        # Test each command
        for i, command in enumerate(commands_to_test, 1):
            print(f"\n🔍 Test {i}/{len(commands_to_test)}: Testing command '{command}'")
            
            if send_command(client, command):
                print(f"⏳ Waiting for response (5 seconds)...")
                time.sleep(5)
            else:
                print(f"❌ Skipping command '{command}' due to send failure")
            
            # Special handling for restart command
            if command == "restart":
                print("⚠️  Device is restarting, waiting 15 seconds...")
                time.sleep(15)
            
            # Special handling for deep_sleep command
            elif command == "deep_sleep":
                print("😴 Device entering deep sleep, waiting 35 seconds...")
                time.sleep(35)
            
            # Special handling for factory_reset command
            elif command == "factory_reset":
                print("🔄 Device performing factory reset, waiting 20 seconds...")
                time.sleep(20)
        
        # Final listening period
        print(f"\n👂 Final listening period (30 seconds)...")
        time.sleep(30)
        
        # Test results
        print(f"\n📊 Test Results Summary:")
        print("=" * 60)
        print(f"Total commands sent: {len(commands_to_test)}")
        print(f"Total messages received: {len(received_messages)}")
        
        # Group messages by topic
        topic_counts = {}
        for msg in received_messages:
            topic = msg['topic']
            topic_counts[topic] = topic_counts.get(topic, 0) + 1
        
        print(f"\n📈 Messages received by topic:")
        for topic, count in topic_counts.items():
            print(f"   {topic}: {count} messages")
        
        # Show recent messages
        print(f"\n📝 All received messages:")
        for msg in received_messages:
            print(f"   [{msg['timestamp']}] {msg['topic']}: {msg['payload'][:80]}...")
        
    except KeyboardInterrupt:
        print("\n⏹️  Test interrupted by user")
    except Exception as e:
        print(f"\n❌ Test error: {e}")
    finally:
        client.loop_stop()
        client.disconnect()
        print("\n✅ Command testing completed!")

if __name__ == "__main__":
    main()
