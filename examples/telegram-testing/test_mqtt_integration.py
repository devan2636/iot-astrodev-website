import json
import time
import requests
from datetime import datetime
import uuid

# Supabase Configuration
SUPABASE_URL = "https://gdmvqskgtdpsktuhsnal.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkbXZxc2tndGRwc2t0dWhzbmFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ5NzE5NzQsImV4cCI6MjA1MDU0Nzk3NH0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8"

# Test Scenarios with different alert types
test_scenarios = [
    {
        "name": "Critical Battery Alert",
        "device_id": str(uuid.uuid4()),
        "device_name": "Weather Station Alpha",
        "battery": 8,  # Critical
        "wifi_rssi": -75,
        "memory_free": 15000,
        "sensor_data": {
            "temperature": 25.5,
            "humidity": 60.2,
            "pressure": 1013.25
        }
    },
    {
        "name": "Multiple Critical Alerts",
        "device_id": str(uuid.uuid4()),
        "device_name": "Sensor Node Beta",
        "battery": 15,  # Warning
        "wifi_rssi": -85,  # Weak signal
        "memory_free": 8000,  # Low memory
        "sensor_data": {
            "temperature": 45.8,  # Critical high
            "humidity": 85.5,  # Critical high
            "pressure": 965.2  # Critical low
        }
    },
    {
        "name": "Environmental Warnings",
        "device_id": str(uuid.uuid4()),
        "device_name": "ESP32 Gamma",
        "battery": 35,
        "wifi_rssi": -82,  # Weak signal
        "memory_free": 12000,
        "sensor_data": {
            "temperature": 5.2,  # Critical low
            "humidity": 25.8,  # Warning low
            "pressure": 1035.7  # Warning high
        }
    }
]

def send_device_status(scenario):
    """Send device status to Supabase and trigger Telegram notification"""
    
    # Prepare device status data
    device_status = {
        "device_id": scenario["device_id"],
        "device_name": scenario["device_name"],
        "battery": scenario["battery"],
        "wifi_rssi": scenario["wifi_rssi"],
        "memory_free": scenario["memory_free"],
        "sensor_data": scenario["sensor_data"],
        "timestamp": datetime.now().isoformat(),
        "status": "online"
    }
    
    print(f"\n📤 Sending: {scenario['name']}")
    print(f"   Device: {scenario['device_name']}")
    print(f"   Battery: {scenario['battery']}%")
    print(f"   WiFi: {scenario['wifi_rssi']} dBm")
    print(f"   Temperature: {scenario['sensor_data']['temperature']}°C")
    print(f"   Humidity: {scenario['sensor_data']['humidity']}%")
    
    # Insert device status to Supabase
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Content-Type": "application/json"
    }
    
    try:
        # Insert to device_status table
        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/device_status",
            headers=headers,
            json=device_status
        )
        
        if response.status_code == 201:
            print("   ✅ Device status saved to database")
            
            # Trigger Telegram notification
            telegram_response = requests.post(
                f"{SUPABASE_URL}/functions/v1/telegram-notifications",
                headers=headers,
                json={
                    "device_id": scenario["device_id"],
                    "event": "status_update"
                }
            )
            
            if telegram_response.status_code == 200:
                result = telegram_response.json()
                print(f"   ✅ Telegram notifications sent: {result['events_count']} alerts")
                return True
            else:
                print(f"   ❌ Telegram notification failed: {telegram_response.status_code}")
                print(f"      Error: {telegram_response.text}")
                return False
                
        else:
            print(f"   ❌ Database insert failed: {response.status_code}")
            print(f"      Error: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False

def test_direct_function_call():
    """Test direct function call with various scenarios"""
    
    print("\n🧪 Testing Direct Function Calls")
    print("=" * 50)
    
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Content-Type": "application/json"
    }
    
    # Test scenarios for direct function calls
    direct_tests = [
        {
            "name": "Test Event",
            "payload": {"device_id": "test-device-direct", "event": "test"}
        },
        {
            "name": "Status Update Event", 
            "payload": {"device_id": str(uuid.uuid4()), "event": "status_update"}
        }
    ]
    
    for test in direct_tests:
        print(f"\n📞 Testing: {test['name']}")
        
        try:
            response = requests.post(
                f"{SUPABASE_URL}/functions/v1/telegram-notifications",
                headers=headers,
                json=test["payload"]
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"   ✅ Success: {result['message']}")
                print(f"   📊 Events sent: {result['events_count']}")
            else:
                print(f"   ❌ Failed: {response.status_code}")
                print(f"      Error: {response.text}")
                
        except Exception as e:
            print(f"   ❌ Error: {e}")
        
        time.sleep(2)

def main():
    print("🚀 MQTT Integration & Alert Testing")
    print("=" * 50)
    print("Testing end-to-end flow: Data → Database → Telegram")
    
    # Test direct function calls first
    test_direct_function_call()
    
    # Test full integration scenarios
    print("\n🔄 Testing Full Integration Scenarios")
    print("=" * 50)
    
    success_count = 0
    total_tests = len(test_scenarios)
    
    for i, scenario in enumerate(test_scenarios, 1):
        print(f"\n[{i}/{total_tests}] {scenario['name']}")
        
        if send_device_status(scenario):
            success_count += 1
        
        # Wait between tests
        if i < total_tests:
            print("   ⏳ Waiting 10 seconds before next test...")
            time.sleep(10)
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 Test Summary")
    print(f"✅ Successful: {success_count}/{total_tests}")
    print(f"❌ Failed: {total_tests - success_count}/{total_tests}")
    
    if success_count == total_tests:
        print("\n🎉 All tests passed!")
    else:
        print(f"\n⚠️  {total_tests - success_count} tests failed")
    
    print("\n📱 Check Telegram group for notifications:")
    print("   Group: Astrodev-IoT")
    print("   Chat ID: -4691595195")
    
    print("\n🔍 Expected notifications:")
    for scenario in test_scenarios:
        print(f"   • {scenario['name']}")
        alerts = []
        if scenario['battery'] < 10:
            alerts.append("Battery Critical")
        elif scenario['battery'] < 20:
            alerts.append("Battery Warning")
        if scenario['wifi_rssi'] < -80:
            alerts.append("WiFi Weak Signal")
        if scenario['sensor_data']['temperature'] <= 5 or scenario['sensor_data']['temperature'] >= 40:
            alerts.append("Temperature Critical")
        if scenario['sensor_data']['humidity'] <= 20 or scenario['sensor_data']['humidity'] >= 80:
            alerts.append("Humidity Critical")
        if scenario['sensor_data']['pressure'] <= 970 or scenario['sensor_data']['pressure'] >= 1040:
            alerts.append("Pressure Critical")
        
        if alerts:
            print(f"     Alerts: {', '.join(alerts)}")
        else:
            print("     No alerts expected")

if __name__ == "__main__":
    main()
