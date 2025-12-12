import requests
import json
import os
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    raise ValueError("Please set SUPABASE_URL and SUPABASE_ANON_KEY in .env file")

MQTT_DATA_HANDLER_URL = f"{SUPABASE_URL}/functions/v1/mqtt-data-handler"

def test_device_status_save():
    """Test saving device status directly to Supabase function"""
    
    # Test data
    test_data = {
        "topic": "iot/devices/ab74435f-1ff7-45b3-a2bf-67b8a8bcc87e/status",
        "payload": {
            "status": "online",
            "battery": 75,
            "wifi_rssi": -65,
            "uptime": 12345,
            "free_heap": 98765,
            "ota_update": "up_to_date",
            "timestamp": datetime.now().isoformat()
        }
    }
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}"
    }
    
    try:
        print("🧪 Testing device status save...")
        print(f"📡 URL: {MQTT_DATA_HANDLER_URL}")
        print(f"📦 Data: {json.dumps(test_data, indent=2)}")
        
        response = requests.post(
            MQTT_DATA_HANDLER_URL,
            headers=headers,
            json=test_data,
            timeout=30
        )
        
        print(f"📊 Response Status: {response.status_code}")
        print(f"📄 Response Body: {response.text}")
        
        if response.status_code == 200:
            print("✅ Device status saved successfully!")
        else:
            print(f"❌ Failed to save device status: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error testing device status save: {e}")

def test_sensor_data_save():
    """Test saving sensor data directly to Supabase function"""
    
    # Test data
    test_data = {
        "topic": "iot/devices/ab74435f-1ff7-45b3-a2bf-67b8a8bcc87e/data",
        "payload": {
            "temperature": 25.5,
            "humidity": 65.0,
            "pressure": 1013.2,
            "timestamp": datetime.now().isoformat()
        }
    }
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}"
    }
    
    try:
        print("🧪 Testing sensor data save...")
        print(f"📡 URL: {MQTT_DATA_HANDLER_URL}")
        print(f"📦 Data: {json.dumps(test_data, indent=2)}")
        
        response = requests.post(
            MQTT_DATA_HANDLER_URL,
            headers=headers,
            json=test_data,
            timeout=30
        )
        
        print(f"📊 Response Status: {response.status_code}")
        print(f"📄 Response Body: {response.text}")
        
        if response.status_code == 200:
            print("✅ Sensor data saved successfully!")
        else:
            print(f"❌ Failed to save sensor data: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error testing sensor data save: {e}")

if __name__ == "__main__":
    print("🚀 Testing MQTT Data Handler Function")
    print("=" * 50)
    
    print("\n📝 Make sure you have created .env file from .env.example")
    print(f"   Current SUPABASE_URL: {SUPABASE_URL}")
    
    choice = input("\nChoose test:\n1. Test device status save\n2. Test sensor data save\n3. Test both\nEnter choice (1-3): ")
    
    if choice == "1":
        test_device_status_save()
    elif choice == "2":
        test_sensor_data_save()
    elif choice == "3":
        test_device_status_save()
        print("\n" + "="*50 + "\n")
        test_sensor_data_save()
    else:
        print("Invalid choice!")
