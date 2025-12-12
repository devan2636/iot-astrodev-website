# Update MQTT Data Handler - Manual Deployment

## Code untuk mqtt-data-handler Function

Copy code berikut ke Supabase Dashboard untuk function `mqtt-data-handler`:

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
    // @ts-ignore
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    // @ts-ignore
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
      // Insert sensor data
      const { error } = await supabase
        .from('sensor_readings')
        .insert({
          device_id: deviceId,
          temperature: data.temperature,
          humidity: data.humidity,
          pressure: data.pressure,
          timestamp: data.timestamp || new Date().toISOString(),
        })

      if (error) {
        console.error('Error inserting sensor data:', error)
        throw error
      }

      console.log('[SAVED] Data saved to database for device:', deviceId)
      
      // Check for sensor alerts and send Telegram notification
      try {
        // @ts-ignore
        const telegramResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-notifications`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // @ts-ignore
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
            },
            body: JSON.stringify({
              device_id: deviceId,
              event: 'sensor_update',
              sensor_data: data
            })
          }
        );

        if (!telegramResponse.ok) {
          const errorText = await telegramResponse.text();
          console.error('Error sending Telegram notification for sensor data:', errorText);
        } else {
          console.log('[SENT] Telegram notification sent for sensor data:', deviceId);
        }
      } catch (error) {
        console.error('Error calling Telegram notifications function for sensor:', error);
      }
      
    } else if (messageType === 'status') {
      // Insert device status data
      const timestamp = data.timestamp || new Date().toISOString();
      const statusData = {
        device_id: deviceId,
        status: data.status,
        battery: data.battery,
        wifi_rssi: data.wifi_rssi,
        uptime: data.uptime,
        free_heap: data.free_heap,
        ota_update: data.ota_update || null,
        timestamp: timestamp,
      };

      const { error: statusError } = await supabase
        .from('device_status')
        .insert(statusData);

      if (statusError) {
        console.error('Error inserting device status:', statusError)
        throw statusError
      }

      // Update devices table with latest status
      const { error: deviceError } = await supabase
        .from('devices')
        .update({
          status: data.status,
          battery: data.battery,
          updated_at: timestamp
        })
        .eq('id', deviceId);

      if (deviceError) {
        console.error('Error updating device:', deviceError)
        throw deviceError
      }

      // Broadcast status update via realtime
      await supabase
        .channel('device-status')
        .send({
          type: 'broadcast',
          event: 'device-status-update',
          payload: statusData
        });

      console.log('[SAVED] Device status saved for device:', deviceId)

      // Send notification to Telegram
      try {
        // @ts-ignore
        const telegramResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-notifications`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // @ts-ignore
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
            },
            body: JSON.stringify({
              device_id: deviceId,
              event: 'status_update'
            })
          }
        );

        if (!telegramResponse.ok) {
          const errorText = await telegramResponse.text();
          console.error('Error sending Telegram notification:', errorText);
        } else {
          console.log('[SENT] Telegram notification sent for device:', deviceId);
        }
      } catch (error) {
        console.error('Error calling Telegram notifications function:', error);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Data processed successfully' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error: any) {
    console.error('Error processing MQTT message:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
```

## Langkah Update:

### 1. Buka Supabase Dashboard
- Login ke https://supabase.com/dashboard
- Pilih project Anda

### 2. Edit Function
- Klik "Functions" di sidebar
- Cari function `mqtt-data-handler`
- Klik untuk edit

### 3. Replace Code
- Hapus semua code yang ada
- Copy-paste code di atas
- Klik "Deploy Function"

### 4. Verify Environment Variables
Pastikan environment variables sudah di-set:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `SUPABASE_URL` (otomatis)
- `SUPABASE_ANON_KEY` (otomatis)
- `SUPABASE_SERVICE_ROLE_KEY` (otomatis)

## Perbaikan yang Dilakukan:

1. ✅ **Menambah Telegram integration untuk sensor data**
   - Sekarang sensor data juga trigger notifikasi
   - Event type: `sensor_update`

2. ✅ **Improved error handling**
   - Better error logging
   - Type annotations untuk TypeScript

3. ✅ **Dual notification triggers**
   - Status updates → Telegram notifications
   - Sensor data → Telegram notifications (untuk alert thresholds)

## Testing Setelah Update:

1. **Jalankan MQTT simulator:**
   ```bash
   cd examples/device-status-dummy
   python mqtt_device_status.py
   ```

2. **Monitor Logs:**
   - Di Supabase Dashboard → Functions → mqtt-data-handler → Logs
   - Cari pesan: `[SENT] Telegram notification sent`

3. **Check Telegram:**
   - Group: Astrodev-IoT
   - Chat ID: -4691595195
   - Harus menerima notifikasi untuk alerts

## Expected Flow:

```
Device → MQTT → mqtt-data-handler → Database → telegram-notifications → Telegram
```

Setelah update ini, setiap data MQTT yang masuk akan:
1. Disimpan ke database
2. Dianalisis untuk alert conditions
3. Mengirim notifikasi Telegram jika ada alert
