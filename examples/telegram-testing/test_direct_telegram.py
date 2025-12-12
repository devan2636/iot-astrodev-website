import requests
import json
import argparse

# Supabase configuration
SUPABASE_URL = "https://gdmvqskgtdpsktuhsnal.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkbXZxc2tndGRwc2t0dWhzbmFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc5NzUyMzcsImV4cCI6MjA2MzU1MTIzN30.Mf9L8X9Mu50FG075ubO6hFzEf0cvzccNZoGxjbLmsaA"
device_id = "65cef40a-5e73-4602-8d46-e93e694db47f"
def create_test_device(supabase_url: str, supabase_key: str, device_id: str):
    """Create a test device if it doesn't exist"""
    try:
        response = requests.post(
            f"{supabase_url}/rest/v1/devices",
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {supabase_key}',
                'apikey': supabase_key
            },
            json={
                'id': device_id,
                'name': f'Test Device {device_id[-4:]}',
                'description': 'Test device for telegram notifications',
                'type': 'sensor',
                'location': 'Test Lab',
                'status': 'online',
                'battery': 100,
                'mac': '00:11:22:33:44:55',
                'serial': device_id,
                'created_at': '2024-03-14T02:40:00Z',
                'updated_at': '2024-03-14T02:40:00Z'
            }
        )
        if response.status_code == 409:
            print(f"   ℹ️ Device {device_id} already exists")
        elif response.status_code == 201:
            print(f"   ✅ Device {device_id} created")
        else:
            print(f"   ❌ Error creating device: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"   ❌ Error: {e}")

def generate_sensor_data(device_id, temp=None, humidity=None, pressure=None):
    """Generate realistic sensor data with optional overrides"""
    from datetime import datetime, timedelta
    import random
    
    timestamp = (datetime.utcnow() - timedelta(minutes=random.randint(0, 60))).isoformat() + 'Z'
    
    return {
        'device_id': device_id,
        'temperature': temp if temp is not None else round(random.uniform(10, 30), 1),
        'humidity': humidity if humidity is not None else round(random.uniform(30, 70), 1),
        'pressure': pressure if pressure is not None else round(random.uniform(980, 1020), 1),
        'timestamp': timestamp
    }

def test_telegram_function(device_id=None):
    """Test telegram-notifications function directly with comprehensive sensor data"""

    print("🧪 Testing telegram-notifications function directly")
    print("=" * 50)
    
    url = f"{SUPABASE_URL}/functions/v1/telegram-notifications"
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {SUPABASE_ANON_KEY}'
    }
    
    # Create test devices first
    device_id_1 = device_id or "00000000-0000-4000-a000-000000000001"
    device_id_2 = "00000000-0000-4000-a000-000000000002"
    
    print("\nCreating test devices...")
    create_test_device(SUPABASE_URL, SUPABASE_ANON_KEY, device_id_1)
    create_test_device(SUPABASE_URL, SUPABASE_ANON_KEY, device_id_2)

    # Create test device status
    print("\nCreating test device status...")
    try:
        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/device_status",
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {SUPABASE_ANON_KEY}',
                'apikey': SUPABASE_ANON_KEY
            },
            json={
                'device_id': device_id_2,
                'status': 'online',
                'battery': 5,
                'wifi_rssi': -85,
                'uptime': 3600,
                'free_heap': 8192,
                'timestamp': '2024-03-14T02:40:00Z'
            }
        )
        if response.status_code == 201:
            print("   ✅ Device status created")
        else:
            print(f"   ❌ Error creating device status: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"   ❌ Error: {e}")

    # Create test sensor readings with various scenarios
    test_cases = [
        ("Normal readings", generate_sensor_data(device_id_2)),
        ("High temperature", generate_sensor_data(device_id_2, temp=42.0)),
        ("Low humidity", generate_sensor_data(device_id_2, humidity=15.0)),
        ("Critical pressure", generate_sensor_data(device_id_2, pressure=950.0)),
        ("Multiple alerts", generate_sensor_data(device_id_2, temp=43.0, humidity=85.0))
    ]

    for case_name, sensor_data in test_cases:
        print(f"\nCreating test sensor reading: {case_name}...")
        try:
            response = requests.post(
                f"{SUPABASE_URL}/rest/v1/sensor_readings",
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {SUPABASE_ANON_KEY}',
                    'apikey': SUPABASE_ANON_KEY
                },
                json=sensor_data
            )

            if response.status_code == 201:
                print("   ✅ Sensor reading created")
            else:
                print(f"   ❌ Error creating sensor reading: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"   ❌ Error: {e}")


    # Test 1: Test notification
    print("\n1. Testing basic test notification...")
    payload = {
        "device_id": device_id_1,
        "event": "test"
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text}")
        
        if response.status_code == 200:
            print("   ✅ Test notification sent successfully!")
        else:
            print("   ❌ Test notification failed")
            
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 2: Critical status notification
    print("\n2. Testing critical status notification...")
    payload = {
        "device_id": device_id_2,
        "event": "status_update",
        "sensor_data": {
            "status": "online",
            "battery": 5,
            "wifi_rssi": -85,
            "uptime": 3600,
            "free_heap": 8192,
            "timestamp": "2024-03-14T02:40:00Z"
        }
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text}")
        
        if response.status_code == 200:
            print("   ✅ Status notification sent successfully!")
        else:
            print("   ❌ Status notification failed")
            
    except Exception as e:
        print(f"   ❌ Error: {e}")

    # Test 3: Sensor data notifications from database
    print("\n3. Testing sensor data notifications from database...")
    for case_name, sensor_data in test_cases:
        print(f"\nTesting notification for: {case_name}")
        payload = {
            "device_id": device_id_2,
            "event": "sensor_update"
        }

        try:
            response = requests.post(url, headers=headers, json=payload, timeout=30)
            print(f"   Status: {response.status_code}")
            print(f"   Response: {response.text}")
            
            if response.status_code == 200:
                print("   ✅ Sensor notification sent successfully!")
            else:
                print("   ❌ Sensor notification failed")
                
        except Exception as e:
            print(f"   ❌ Error: {e}")

    
    print("\n" + "=" * 50)
    print("📱 Check Telegram group 'Astrodev-IoT' for notifications")
    print("   Expected: 3 notifications (test + status + sensor alerts)")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--device-id', help='Custom device ID to test with')
    args = parser.parse_args()
    
    test_telegram_function(device_id=args.device_id)
