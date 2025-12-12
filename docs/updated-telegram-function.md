# Updated Telegram Function Code

Copy code berikut ke Supabase Dashboard untuk function `telegram-notifications`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// @ts-ignore
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
// @ts-ignore
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey)

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { device_id, event } = await req.json()
    
    // @ts-ignore
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
    // @ts-ignore
    const chatId = Deno.env.get('TELEGRAM_CHAT_ID')
    
    if (!botToken || !chatId) {
      throw new Error('Telegram credentials not configured')
    }

    // Generate notifications based on event type
    const notifications = await generateNotifications(device_id, event)
    
    // Send notifications to Telegram
    const results = []
    for (const notification of notifications) {
      const result = await sendTelegramMessage(botToken, chatId, notification)
      results.push(result)
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
  } catch (error: any) {
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

async function generateNotifications(device_id: string, event: string): Promise<string[]> {
  const notifications: string[] = []
  
  // Handle test events without database query
  if (event === 'test') {
    const testMessage = `🧪 *Test Notification*

📱 *Device:* ${device_id}
📝 *Message:* This is a test notification from IoT Monitoring System
🕐 *Time:* ${new Date().toLocaleString('id-ID')}

_IoT Monitoring System - AstroDev_`
    
    notifications.push(testMessage)
    return notifications
  }

  // For non-test events, get device status
  try {
    const { data: deviceStatus, error } = await supabaseClient
      .from('device_status')
      .select('*')
      .eq('device_id', device_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) throw error

    if (!deviceStatus) {
      notifications.push(`⚠️ No status data found for device: ${device_id}`)
      return notifications
    }

    // Check battery level
    if (deviceStatus.battery < 10) {
      notifications.push(`🔋 *Battery Critical*

📱 *Device:* ${device_id}
📝 *Message:* Device battery level critically low: ${deviceStatus.battery}%
🕐 *Time:* ${new Date(deviceStatus.timestamp).toLocaleString('id-ID')}

_IoT Monitoring System - AstroDev_`)
    } else if (deviceStatus.battery < 20) {
      notifications.push(`🔋 *Battery Warning*

📱 *Device:* ${device_id}
📝 *Message:* Device battery level low: ${deviceStatus.battery}%
🕐 *Time:* ${new Date(deviceStatus.timestamp).toLocaleString('id-ID')}

_IoT Monitoring System - AstroDev_`)
    }

    // Check WiFi signal
    if (deviceStatus.wifi_rssi < -80) {
      notifications.push(`📶 *WiFi Signal Warning*

📱 *Device:* ${device_id}
📝 *Message:* Weak WiFi signal: ${deviceStatus.wifi_rssi} dBm
🕐 *Time:* ${new Date(deviceStatus.timestamp).toLocaleString('id-ID')}

_IoT Monitoring System - AstroDev_`)
    }

    // Check sensor data if available
    if (deviceStatus.sensor_data) {
      const { temperature, humidity, pressure } = deviceStatus.sensor_data

      if (temperature !== undefined) {
        if (temperature <= 5 || temperature >= 40) {
          notifications.push(`🌡️ *Temperature Critical*

📱 *Device:* ${device_id}
📝 *Message:* Temperature ${temperature}°C outside safe range
🕐 *Time:* ${new Date(deviceStatus.timestamp).toLocaleString('id-ID')}

_IoT Monitoring System - AstroDev_`)
        }
      }

      if (humidity !== undefined) {
        if (humidity <= 20 || humidity >= 80) {
          notifications.push(`💧 *Humidity Critical*

📱 *Device:* ${device_id}
📝 *Message:* Humidity ${humidity}% outside safe range
🕐 *Time:* ${new Date(deviceStatus.timestamp).toLocaleString('id-ID')}

_IoT Monitoring System - AstroDev_`)
        }
      }

      if (pressure !== undefined) {
        if (pressure <= 970 || pressure >= 1040) {
          notifications.push(`🌪️ *Pressure Critical*

📱 *Device:* ${device_id}
📝 *Message:* Pressure ${pressure} hPa outside safe range
🕐 *Time:* ${new Date(deviceStatus.timestamp).toLocaleString('id-ID')}

_IoT Monitoring System - AstroDev_`)
        }
      }
    }

  } catch (error: any) {
    console.error('Error generating notifications:', error)
    notifications.push(`❌ Error processing device status: ${error.message}`)
  }

  return notifications
}

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

## Langkah Update:

1. **Buka Supabase Dashboard**
2. **Klik Functions → telegram-notifications**
3. **Replace semua code dengan code di atas**
4. **Klik Deploy Function**
5. **Test dengan payload:**
   ```json
   {
     "device_id": "test-device-01",
     "event": "test"
   }
   ```

## Perbaikan yang Dilakukan:

1. ✅ Menambah handling untuk event "test"
2. ✅ Mengatasi error UUID dengan tidak query database untuk test
3. ✅ Menambah type annotations untuk TypeScript
4. ✅ Menambah @ts-ignore untuk Deno environment variables
5. ✅ Improved error handling

Setelah update, function akan bisa handle test event tanpa error UUID.
