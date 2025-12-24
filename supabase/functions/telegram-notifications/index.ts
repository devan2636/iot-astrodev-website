// @deno-types="https://deno.land/x/supabase_js@v2.39.0/mod.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

// Token Bot Hardware (@AstrodevIoT_bot)
const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN_DEVICE')!;

// Map payload keys to sensor types (sama seperti mqtt-data-handler)
const SENSOR_TYPE_MAP: Record<string, string> = {
  temperature: 'Temperature',
  humidity: 'Humidity',
  pressure: 'Pressure',
  battery: 'Battery',
  ketinggian_air: 'Ketinggian Air',
  curah_hujan: 'Curah Hujan',
  light: 'Light',
  o2: 'O2',
  co2: 'CO2',
  ph: 'pH',
  arah_angin: 'Arah Angin',
  kecepatan_angin: 'Kecepatan Angin'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { device_id, event, sensor_data } = await req.json();

    // Helper: Format Waktu
    function formatDateToGMT7(date: Date) {
      const utc = date.getTime() + date.getTimezoneOffset() * 60000;
      const gmt7 = new Date(utc + 7 * 3600000);
      return gmt7.toLocaleString('id-ID', { hour12: false });
    }

    // 1. Validasi Token
    if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN_DEVICE not configured!');

    // 2. Ambil Detail Device
    const { data: device, error: deviceError } = await supabaseClient
      .from('devices')
      .select('name')
      .eq('id', device_id)
      .single();

    let deviceName = device?.name || device_id;

    // 3. Ambil Subscriber (User yang scan QR)
    const { data: subscriptions, error: subError } = await supabaseClient
      .from('telegram_device_subscriptions')
      .select('chat_id')
      .eq('device_id', device_id);

    if (subError || !subscriptions || subscriptions.length === 0) {
      console.log(`No subscribers for ${deviceName}. Skipping.`);
      return new Response(JSON.stringify({ message: 'No subscribers found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    const chatIds = subscriptions.map(sub => sub.chat_id);
    const notifications: string[] = [];

    // ---------------------------------------------------------
    // LOGIC 1: ALERT SENSOR (Temperature, Humidity, etc)
    // ---------------------------------------------------------
    if (event === 'sensor_update' && sensor_data) {
      const timestampDate = sensor_data.timestamp ? new Date(sensor_data.timestamp) : new Date();
      const timeStr = formatDateToGMT7(timestampDate);

      console.log(`[DEBUG] Processing sensor_update for device ${device_id}`);
      console.log(`[DEBUG] Sensor data:`, sensor_data);

      // Ambil konfigurasi Min/Max dari tabel 'sensors'
      const { data: sensorConfigs } = await supabaseClient
        .from('sensors')
        .select('type, name, min_value, max_value, unit')
        .eq('device_id', device_id)
        .eq('is_active', true);

      console.log(`[DEBUG] Found ${sensorConfigs?.length || 0} sensor configs`);

      // Loop setiap key di data yang masuk (misal: temperature, humidity)
      for (const [key, value] of Object.entries(sensor_data)) {
        if (key === 'timestamp') continue; // Skip timestamp

        console.log(`[DEBUG] Processing key: ${key}, value: ${value}`);

        // Cari config sensor yang cocok dengan key ini
        // Gunakan SENSOR_TYPE_MAP untuk matching yang konsisten
        const mappedType = SENSOR_TYPE_MAP[key];
        const config = sensorConfigs?.find(s => {
          // Match by mapped type (case insensitive)
          if (mappedType && s.type?.toLowerCase() === mappedType.toLowerCase()) return true;
          // Fallback: match by name
          if (s.name && s.name.toLowerCase().includes(key.toLowerCase())) return true;
          // Fallback: match by type containing key
          if (s.type && s.type.toLowerCase().includes(key.toLowerCase())) return true;
          return false;
        });

        if (config) {
          console.log(`[DEBUG] Found matching sensor config:`, config);
        } else {
          console.log(`[DEBUG] No config found for key: ${key}`);
        }

        if (config && typeof value === 'number') {
          const min = config.min_value;
          const max = config.max_value;
          const unit = config.unit || '';

          console.log(`[DEBUG] Checking thresholds - Min: ${min}, Max: ${max}, Value: ${value}`);

          // Cek Batas Bawah
          if (min !== null && min !== undefined && value < min) {
            console.log(`[DEBUG] LOW threshold triggered for ${config.name}`);
            notifications.push(`📉 *LOW ${config.name.toUpperCase()} ALERT*

📱 *Device:* ${deviceName}
⚠️ *Value:* ${value}${unit} (Min: ${min}${unit})
🕐 *Time:* ${timeStr}

_Nilai sensor terlalu rendah._`);
          }

          // Cek Batas Atas
          if (max !== null && max !== undefined && value > max) {
            console.log(`[DEBUG] HIGH threshold triggered for ${config.name}`);
            notifications.push(`📈 *HIGH ${config.name.toUpperCase()} ALERT*

📱 *Device:* ${deviceName}
⚠️ *Value:* ${value}${unit} (Max: ${max}${unit})
🕐 *Time:* ${timeStr}

_Nilai sensor melebihi batas aman._`);
          }
        }
      }

      console.log(`[DEBUG] Total notifications generated: ${notifications.length}`);
    }

    // ---------------------------------------------------------
    // LOGIC 2: ALERT STATUS (Battery, WiFi, System)
    // ---------------------------------------------------------
    else if (event === 'status_update') {
      let deviceStatus = sensor_data;
      // Jika data kosong, ambil last status dari DB
      if (!deviceStatus || deviceStatus.battery === undefined) {
        const { data: latest } = await supabaseClient
          .from('device_status')
          .select('*')
          .eq('device_id', device_id)
          .order('timestamp', { ascending: false })
          .limit(1)
          .maybeSingle();
        deviceStatus = latest;
      }

      if (deviceStatus) {
        const timestampDate = deviceStatus.timestamp ? new Date(deviceStatus.timestamp) : new Date();
        const timeStr = formatDateToGMT7(timestampDate);

        // Baterai (< 20%)
        if (deviceStatus.battery !== undefined && deviceStatus.battery < 20) {
          notifications.push(`🪫 *LOW BATTERY*

📱 *Device:* ${deviceName}
🔋 *Level:* ${deviceStatus.battery}%
🕐 *Time:* ${timeStr}

_Harap segera charge perangkat._`);
        }

        // Sinyal (< -85 dBm)
        if (deviceStatus.wifi_rssi !== undefined && deviceStatus.wifi_rssi < -85) {
          notifications.push(`📶 *WEAK SIGNAL*

📱 *Device:* ${deviceName}
📶 *Signal:* ${deviceStatus.wifi_rssi} dBm
🕐 *Time:* ${timeStr}`);
        }
      }
    }

    // ---------------------------------------------------------
    // LOGIC 3: TEST EVENT
    // ---------------------------------------------------------
    else if (event === 'test') {
      notifications.push(`🧪 *Test Notification*

📱 *Device:* ${deviceName}
✅ Koneksi bot berhasil.
🕐 *Time:* ${formatDateToGMT7(new Date())}`);
    }

    // 4. KIRIM PESAN (Looping)
    const results = [];
    for (const notification of notifications) {
      for (const chatId of chatIds) {
        try {
          await sendTelegramMessage(botToken, chatId, notification);
          results.push({ chatId, status: 'sent' });
        } catch (error) {
          console.error(`Failed to send to ${chatId}:`, error);
          results.push({ chatId, status: 'failed', error: error.message });
        }
      }
    }

    return new Response(JSON.stringify({
      message: 'Processed',
      notifications: notifications.length,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Handler Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
});

async function sendTelegramMessage(token: string, chatId: number, message: string) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown'
    })
  });

  if (!res.ok) {
    throw new Error(`Telegram API Error: ${await res.text()}`);
  }
  return await res.json();
}