# Manual Deployment Guide - Telegram Integration

## Overview
Panduan ini menjelaskan cara manual deploy Telegram integration ke Supabase setelah semua file sudah dipersiapkan.

## Files yang Perlu Di-update di Supabase

### 1. telegram-notifications Function

**Location:** `supabase/functions/telegram-notifications/index.ts`

**Action:** Copy paste code berikut ke Supabase Dashboard → Edge Functions → telegram-notifications:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { device_id, event, sensor_data } = await req.json()
    
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
    const chatId = Deno.env.get('TELEGRAM_CHAT_ID')
    
    if (!botToken || !chatId) {
      throw new Error('Telegram credentials not configured')
    }

    // Get device name first
    const { data: device, error: deviceError } = await supabaseClient
      .from('devices')
      .select('name')
      .eq('id', device_id)
      .single()

    if (deviceError) {
      console.error('Error fetching device:', deviceError)
      throw deviceError
    }

    const deviceName = device?.name || device_id
    const notifications = []

    // Handle test events
    if (event === 'test') {
      notifications.push(`🧪 *Test Notification*

📱 *Device:* ${deviceName}
📝 *Message:* This is a test notification from IoT Monitoring System
🕐 *Time:* ${new Date().toLocaleString('id-ID')}

_IoT Monitoring System - AstroDev_`)
    }
    // Handle sensor data updates
    else if (event === 'sensor_update' && sensor_data) {
      const { temperature, humidity, pressure } = sensor_data

      if (temperature !== undefined) {
        if (temperature <= 5 || temperature >= 40) {
          notifications.push(`🌡️ *Temperature Critical*

📱 *Device:* ${deviceName}
📝 *Message:* Temperature ${temperature}°C outside safe range (5-40°C)
🕐 *Time:* ${new Date().toLocaleString('id-ID')}

_IoT Monitoring System - AstroDev_`)
        }
      }

      if (humidity !== undefined) {
        if (humidity <= 20 || humidity >= 80) {
          notifications.push(`💧 *Humidity Critical*

📱 *Device:* ${deviceName}
📝 *Message:* Humidity ${humidity}% outside safe range (20-80%)
🕐 *Time:* ${new Date().toLocaleString('id-ID')}

_IoT Monitoring System - AstroDev_`)
        }
      }

      if (pressure !== undefined) {
        if (pressure <= 970 || pressure >= 1040) {
          notifications.push(`🌪️ *Pressure Critical*

📱 *Device:* ${deviceName}
📝 *Message:* Pressure ${pressure} hPa outside safe range (970-1040 hPa)
🕐 *Time:* ${new Date().toLocaleString('id-ID')}

_IoT Monitoring System - AstroDev_`)
        }
      }
    }
    // Handle status updates
    else if (event === 'status_update') {
      const { data: deviceStatus, error: statusError } = await supabaseClient
        .from('device_status')
        .select('*')
        .eq('device_id', device_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (statusError) {
        console.error('Error fetching device status:', statusError)
        throw statusError
      }

      if (!deviceStatus) {
        notifications.push(`⚠️ No status data found for device: ${deviceName}`)
      } else {
        // Check battery level
        if (deviceStatus.battery < 10) {
          notifications.push(`🔋 *Battery Critical*

📱 *Device:* ${deviceName}
📝 *Message:* Device battery level critically low: ${deviceStatus.battery}%
🕐 *Time:* ${new Date(deviceStatus.timestamp).toLocaleString('id-ID')}

_IoT Monitoring System - AstroDev_`)
        } else if (deviceStatus.battery < 20) {
          notifications.push(`🔋 *Battery Warning*

📱 *Device:* ${deviceName}
📝 *Message:* Device battery level low: ${deviceStatus.battery}%
🕐 *Time:* ${new Date(deviceStatus.timestamp).toLocaleString('id-ID')}

_IoT Monitoring System - AstroDev_`)
        }

        // Check WiFi signal
        if (deviceStatus.wifi_rssi < -80) {
          notifications.push(`📶 *WiFi Signal Warning*

📱 *Device:* ${deviceName}
📝 *Message:* Weak WiFi signal: ${deviceStatus.wifi_rssi} dBm
🕐 *Time:* ${new Date(deviceStatus.timestamp).toLocaleString('id-ID')}

_IoT Monitoring System - AstroDev_`)
        }

        // Check memory
        if (deviceStatus.free_heap && deviceStatus.free_heap < 10240) { // < 10KB
          notifications.push(`💾 *Low Memory Warning*

📱 *Device:* ${deviceName}
📝 *Message:* Device memory is running low: ${Math.floor(deviceStatus.free_heap / 1024)} KB free
🕐 *Time:* ${new Date(deviceStatus.timestamp).toLocaleString('id-ID')}

_IoT Monitoring System - AstroDev_`)
        }
      }
    }

    // Send notifications to Telegram
    const results = []
    for (const notification of notifications) {
      try {
        const result = await sendTelegramMessage(botToken, chatId, notification)
        results.push(result)
      } catch (error) {
        console.error('Error sending Telegram message:', error)
        results.push({ error: error.message })
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Notifications sent successfully',
        events_count: notifications.length,
        results 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error sending notifications:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

async function sendTelegramMessage(botToken: string, chatId: string, message: string) {
  const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`
  
  const response = await fetch(telegramUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown'
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Telegram API error: ${error}`)
  }

  return await response.json()
}
```

### 2. mqtt-data-handler Function

**Location:** `supabase/functions/mqtt-data-handler/index.ts`

**Action:** Update existing mqtt-data-handler dengan code berikut:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { topic, payload } = await req.json()
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('Received MQTT message:', { topic, payload })

    // Parse topic to extract device ID
    // Expected format: iot/devices/{device_id}/data or iot/devices/{device_id}/status
    const topicParts = topic.split('/')
    if (topicParts.length !== 4 || topicParts[0] !== 'iot' || topicParts[1] !== 'devices') {
      throw new Error('Invalid topic format')
    }

    const deviceId = topicParts[2]
    const messageType = topicParts[3]

    // Parse payload
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload

    if (messageType === 'data') {
