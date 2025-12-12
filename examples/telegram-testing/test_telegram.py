#!/usr/bin/env python3
"""
Test script for Telegram Bot integration
"""

import requests
import json
import time
from datetime import datetime

# Configuration
BOT_TOKEN = "8132058716:AAF6wQGdPJBi46emnzCn74RYOwtmFaPxStI"
SUPABASE_URL = "https://gdmvqskgtdpsktuhsnal.supabase.co"  # Replace with your Supabase URL
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkbXZxc2tndGRwc2t0dWhzbmFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc5NzUyMzcsImV4cCI6MjA2MzU1MTIzN30.Mf9L8X9Mu50FG075ubO6hFzEf0cvzccNZoGxjbLmsaA"  # Replace with your anon key

def get_bot_info():
    """Get bot information"""
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/getMe"
    response = requests.get(url)
    return response.json()

def get_updates():
    """Get recent updates to find chat ID"""
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/getUpdates"
    response = requests.get(url)
    return response.json()

def send_test_message(chat_id, message):
    """Send a test message directly via Telegram API"""
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "Markdown"
    }
    response = requests.post(url, json=payload)
    return response.json()

def test_supabase_function(device_id="test-device"):
    """Test Supabase Telegram function"""
    url = f"{SUPABASE_URL}/functions/v1/telegram-notifications"
    headers = {
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "device_id": device_id,
        "event": "test"
    }
    response = requests.post(url, headers=headers, json=payload)
    return response

def simulate_device_alerts():
    """Simulate various device alerts for testing"""
    alerts = [
        {
            "device_id": "weather-station-01",
            "battery": 8,  # Critical battery
            "wifi_rssi": -85,  # Weak signal
            "free_heap": 8192,  # Low memory
            "status": "online",
            "timestamp": datetime.now().isoformat()
        },
        {
            "device_id": "sensor-node-02", 
            "battery": 15,  # Low battery warning
            "wifi_rssi": -75,  # Good signal
            "free_heap": 32768,  # Good memory
            "status": "online",
            "sensor_data": {
                "temperature": 45,  # Critical temperature
                "humidity": 85,     # Critical humidity
                "pressure": 965     # Critical pressure
            },
            "timestamp": datetime.now().isoformat()
        }
    ]
    
    return alerts

def main():
    print("🤖 Telegram Bot Integration Test")
    print("=" * 40)
    
    # Test 1: Get bot info
    print("\n1. Testing bot connection...")
    bot_info = get_bot_info()
    if bot_info.get("ok"):
        print(f"✅ Bot connected: {bot_info['result']['first_name']}")
        print(f"   Username: @{bot_info['result']['username']}")
    else:
        print("❌ Failed to connect to bot")
        return
    
    # Test 2: Get updates to find chat ID
    print("\n2. Getting recent updates...")
    updates = get_updates()
    if updates.get("ok") and updates.get("result"):
        print("✅ Recent chats found:")
        for update in updates["result"][-3:]:  # Show last 3 updates
            if "message" in update:
                chat = update["message"]["chat"]
                print(f"   Chat ID: {chat['id']} - {chat.get('first_name', 'Group')}")
    else:
        print("⚠️  No recent updates found. Send a message to the bot first!")
    
    # Test 3: Send direct test message
    chat_ids_input = input("\n3. Enter Chat ID(s) to test (comma-separated, or press Enter to skip): ").strip()
    if chat_ids_input:
        chat_ids = [cid.strip() for cid in chat_ids_input.split(",") if cid.strip()]
        test_message = f"""
🧪 *Test Message*

📱 *Device:* Test Device
📝 *Message:* This is a test notification from IoT Monitoring System
🕐 *Time:* {datetime.now().strftime('%d/%m/%Y, %H:%M')}

_IoT Monitoring System - AstroDev_
        """.strip()
        
        for chat_id in chat_ids:
            result = send_test_message(chat_id, test_message)
            if result.get("ok"):
                print(f"✅ Test message sent successfully to chat ID {chat_id}!")
            else:
                print(f"❌ Failed to send message to chat ID {chat_id}: {result}")
    
    # Test 4: Test Supabase function (if configured)
    if SUPABASE_URL != "YOUR_SUPABASE_URL":
        print("\n4. Testing Supabase function...")
        try:
            response = test_supabase_function()
            if response.status_code == 200:
                print("✅ Supabase function test successful!")
                print(f"   Response: {response.json()}")
            else:
                print(f"❌ Supabase function test failed: {response.status_code}")
                print(f"   Error: {response.text}")
        except Exception as e:
            print(f"❌ Error testing Supabase function: {e}")
    else:
        print("\n4. Skipping Supabase function test (not configured)")
    
    # Test 5: Show sample alert scenarios
    print("\n5. Sample alert scenarios:")
    alerts = simulate_device_alerts()
    for i, alert in enumerate(alerts, 1):
        print(f"\n   Scenario {i}:")
        print(f"   Device: {alert['device_id']}")
        print(f"   Battery: {alert['battery']}% ({'Critical' if alert['battery'] < 10 else 'Warning' if alert['battery'] < 20 else 'OK'})")
        print(f"   WiFi: {alert['wifi_rssi']} dBm ({'Weak' if alert['wifi_rssi'] < -80 else 'Good'})")
        if 'sensor_data' in alert:
            print(f"   Temperature: {alert['sensor_data']['temperature']}°C ({'Critical' if alert['sensor_data']['temperature'] > 40 else 'OK'})")
            print(f"   Humidity: {alert['sensor_data']['humidity']}% ({'Critical' if alert['sensor_data']['humidity'] > 80 else 'OK'})")
    
    print("\n" + "=" * 40)
    print("🎉 Test completed!")
    print("\nNext steps:")
    print("1. Set TELEGRAM_CHAT_ID environment variable in Supabase (comma-separated for multiple IDs)")
    print("2. Deploy telegram-notifications function")
    print("3. Test with real device data")

if __name__ == "__main__":
    main()
