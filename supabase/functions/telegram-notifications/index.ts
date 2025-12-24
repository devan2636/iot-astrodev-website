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

// Bot tokens
// - Device bot (generic hardware alerts)
const botTokenDevice = Deno.env.get('TELEGRAM_BOT_TOKEN_DEVICE') ?? null;
// - AWLR bot (@PantauSungai_bot) for water level/rainfall alerts
const botTokenAwlr = Deno.env.get('TELEGRAM_BOT_AWLR_TOKEN') ?? null;

// Timezone controls (default UTC to match system-wide convention)
const TZ = Deno.env.get('TELEGRAM_TIMEZONE') ?? 'UTC';
const LOCALE = Deno.env.get('TELEGRAM_LOCALE') ?? 'id-ID';
const TZ_LABEL = Deno.env.get('TELEGRAM_TIMEZONE_LABEL') ?? 'UTC';

// Alert controls
const COOLDOWN_SECS = Number(Deno.env.get('TELEGRAM_ALERT_COOLDOWN_SECS') ?? '600'); // default 10 minutes
const HYSTERESIS = (Deno.env.get('TELEGRAM_ALERT_HYSTERESIS') ?? 'true').toLowerCase() === 'true';
// Batch multiple notifications into a single message (optional)
const BATCH_NOTIFICATIONS = (Deno.env.get('TELEGRAM_BATCH_NOTIFICATIONS') ?? 'false').toLowerCase() === 'true';

// Status thresholds (configurable)
const STATUS_BATTERY_LOW_PERCENT = Number(Deno.env.get('TELEGRAM_STATUS_BATTERY_LOW_PERCENT') ?? '20');
const STATUS_WIFI_RSSI_WEAK_DBM = Number(Deno.env.get('TELEGRAM_STATUS_WIFI_RSSI_WEAK_DBM') ?? '-85');

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

    // Helper: Format waktu sesuai timezone yang dikonfigurasi
    function formatDateWithTZ(date: Date) {
      return date.toLocaleString(LOCALE, { hour12: false, timeZone: TZ });
    }

    // 1. Pilih bot token berdasarkan jenis event
    let useAwlrBot = false;
    
    // AWLR alerts: hanya untuk sensor_update dengan ketinggian_air/curah_hujan
    if (event === 'sensor_update' && sensor_data) {
      if (Object.prototype.hasOwnProperty.call(sensor_data, 'ketinggian_air') ||
          Object.prototype.hasOwnProperty.call(sensor_data, 'curah_hujan')) {
        useAwlrBot = true;
      }
    }
    
    // Status dan generic device alerts selalu pakai device token
    // (bahkan jika device punya AWLR sensors)

    const tokenToUse = useAwlrBot && botTokenAwlr ? botTokenAwlr : botTokenDevice;
    if (!tokenToUse) {
      throw new Error('No Telegram bot token configured (TELEGRAM_BOT_TOKEN_DEVICE or TELEGRAM_BOT_AWLR_TOKEN)');
    }

    // 2. Ambil Detail Device
    const { data: device, error: deviceError } = await supabaseClient
      .from('devices')
      .select('name, location, latitude, longitude, battery_low_threshold_percent, wifi_rssi_weak_threshold_dbm')
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
      const timeStr = `${formatDateWithTZ(timestampDate)} ${TZ_LABEL}`;

      console.log(`[DEBUG] Processing sensor_update for device ${device_id}`);
      console.log(`[DEBUG] Sensor data:`, sensor_data);

      // AWLR-specific: if payload includes water level or rainfall, send consolidated river status
      const hasWaterLevel = Object.prototype.hasOwnProperty.call(sensor_data, 'ketinggian_air');
      const hasRainfall = Object.prototype.hasOwnProperty.call(sensor_data, 'curah_hujan');
      if (hasWaterLevel || hasRainfall) {
        // Fetch thresholds from app_settings
        let waterLimits = { WASPADA: 20, BAHAYA: 40 } as any;
        let rainLimits = { RINGAN: 5, SEDANG: 10, LEBAT: 20 } as any;
        try {
          const { data: wl } = await supabaseClient
            .from('app_settings')
            .select('value')
            .eq('key', 'water_level_limits')
            .maybeSingle();
          if (wl?.value) waterLimits = wl.value as any;
        } catch (_) {}
        try {
          const { data: rl } = await supabaseClient
            .from('app_settings')
            .select('value')
            .eq('key', 'rainfall_limits')
            .maybeSingle();
          if (rl?.value) rainLimits = rl.value as any;
        } catch (_) {}

        const level = typeof sensor_data.ketinggian_air === 'number' ? sensor_data.ketinggian_air : null;
        const rain = typeof sensor_data.curah_hujan === 'number' ? sensor_data.curah_hujan : null;

        // Determine water status
        let waterStatus = 'AMAN';
        let waterEmoji = '✅';
        if (level !== null) {
          if (level >= waterLimits.BAHAYA) { waterStatus = 'BAHAYA'; waterEmoji = '🚨'; }
          else if (level >= waterLimits.WASPADA) { waterStatus = 'WASPADA'; waterEmoji = '⚠️'; }
        }

        // Determine rainfall status
        let rainStatus = 'Cerah';
        let rainEmoji = '☀️';
        if (rain !== null) {
          if (rain > rainLimits.LEBAT) { rainStatus = 'Sangat Lebat / Ekstrem'; rainEmoji = '🌧️'; }
          else if (rain >= rainLimits.LEBAT) { rainStatus = 'Lebat'; rainEmoji = '🌧️'; }
          else if (rain >= rainLimits.SEDANG) { rainStatus = 'Sedang'; rainEmoji = '🌦️'; }
          else if (rain >= rainLimits.RINGAN) { rainStatus = 'Ringan'; rainEmoji = '🌤️'; }
          else { rainStatus = 'Berawan / Cerah'; rainEmoji = '⛅'; }
        }

        // Combine status labels
        let statusCombined = waterStatus;
        if (rain !== null && rain >= rainLimits.SEDANG) {
          statusCombined = `HUJAN ${rainStatus.toUpperCase()} - ${waterStatus} ${waterStatus !== 'AMAN' ? 'BANJIR' : ''}`.trim();
        }

        // Header emoji based on severity
        let headerEmoji = '⛅';
        if (waterStatus === 'BAHAYA') headerEmoji = '🚨';
        else if (waterStatus === 'WASPADA') headerEmoji = '⚠️';

        const gmaps = (device?.latitude && device?.longitude)
          ? `https://www.google.com/maps/search/?api=1&query=${device.latitude},${device.longitude}`
          : null;
        const lokasi = device?.location ? `${device.location} (${deviceName})` : deviceName;

        const lines: string[] = [];
        lines.push(`${headerEmoji} PERINGATAN CUACA ${headerEmoji}`);
        lines.push('');
        lines.push(`Status: ${statusCombined}`);
        lines.push('');
        if (level !== null) lines.push(`🌊 Level Air: ${level} cm`);
        if (rain !== null) lines.push(`🌧 Hujan (1 jam): ${rain} mm`);
        lines.push(`${rainEmoji} ${rainStatus}`);
        lines.push('');
        lines.push(`📍 Lokasi: ${lokasi}`);
        lines.push(`🗺 Lihat Peta (${gmaps || '#'})`);
        lines.push('');
        lines.push(`🕒 Waktu: ${timeStr}`);

        notifications.push(lines.join('\n'));
        console.log(`[DEBUG] AWLR message generated. Total notifications: ${notifications.length}`);
      } else {
        // Generic per-sensor threshold alerts (existing behavior)
        // Ambil konfigurasi threshold dari tabel 'sensors'
        const { data: sensorConfigs } = await supabaseClient
          .from('sensors')
          .select('type, name, threshold_low, threshold_high, min_value, max_value, unit')
          .eq('device_id', device_id);

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
            // Support both new schema (threshold_low/high) and legacy (min_value/max_value)
            const low = (config as any).threshold_low ?? (config as any).min_value;
            const high = (config as any).threshold_high ?? (config as any).max_value;
            const unit = config.unit || '';

            // Jika tidak ada batas sama sekali, skip
            if (low === null && high === null && (config as any).min_value === null && (config as any).max_value === null) {
              console.log(`[DEBUG] No thresholds configured for ${config.name}, skipping.`);
            } else {
              console.log(`[DEBUG] Checking thresholds - Low: ${low}, High: ${high}, Value: ${value}`);

              // Tentukan state saat ini berdasarkan nilai
              let currentState: 'normal' | 'low' | 'high' = 'normal';
              if (low !== null && low !== undefined && value < low) currentState = 'low';
              else if (high !== null && high !== undefined && value > high) currentState = 'high';

              // Ambil state terakhir dari DB untuk cooldown & hysteresis
              const { data: lastStateRec } = await supabaseClient
                .from('telegram_alert_state')
                .select('last_state, last_alert_at, last_value')
                .eq('device_id', device_id)
                .eq('sensor_key', key)
                .maybeSingle();

              const prevState = (lastStateRec?.last_state as 'normal' | 'low' | 'high') ?? 'normal';
              const prevAlertAt = lastStateRec?.last_alert_at ? new Date(lastStateRec.last_alert_at) : null;

              const now = timestampDate; // gunakan waktu data masuk
              const withinCooldown = prevAlertAt
                ? ((now.getTime() - prevAlertAt.getTime()) / 1000) < COOLDOWN_SECS
                : false;

              let shouldSend = false;
              let message = '';

              if (HYSTERESIS) {
                // Kirim hanya saat crossing boundary, dan kirim recovery saat kembali normal
                if (currentState !== prevState) {
                  if (currentState === 'low') {
                    shouldSend = !withinCooldown;
                    if (shouldSend) {
                      console.log(`[DEBUG] LOW threshold crossed for ${config.name}`);
                      message = `📉 *LOW ${config.name.toUpperCase()} ALERT*\n\n📱 *Device:* ${deviceName}\n⚠️ *Value:* ${value}${unit} (Low: ${low}${unit})\n🕐 *Time:* ${timeStr}\n\n_Nilai sensor terlalu rendah._`;
                    }
                  } else if (currentState === 'high') {
                    shouldSend = !withinCooldown;
                    if (shouldSend) {
                      console.log(`[DEBUG] HIGH threshold crossed for ${config.name}`);
                      message = `📈 *HIGH ${config.name.toUpperCase()} ALERT*\n\n📱 *Device:* ${deviceName}\n⚠️ *Value:* ${value}${unit} (High: ${high}${unit})\n🕐 *Time:* ${timeStr}\n\n_Nilai sensor melebihi batas aman._`;
                    }
                  } else {
                    // Recovery ke normal
                    console.log(`[DEBUG] RECOVERY to normal for ${config.name}`);
                    message = `✅ *${config.name.toUpperCase()} BACK TO NORMAL*\n\n📱 *Device:* ${deviceName}\nℹ️ *Value:* ${value}${unit} (Low: ${low ?? '-'}${unit}, High: ${high ?? '-'}${unit})\n🕐 *Time:* ${timeStr}`;
                    shouldSend = true;
                  }
                }
              } else {
                // Tanpa hysteresis: kirim alert jika sedang low/high (cooldown berlaku)
                if (currentState === 'low' && !withinCooldown) {
                  shouldSend = true;
                  message = `📉 *LOW ${config.name.toUpperCase()} ALERT*\n\n📱 *Device:* ${deviceName}\n⚠️ *Value:* ${value}${unit} (Low: ${low}${unit})\n🕐 *Time:* ${timeStr}\n\n_Nilai sensor terlalu rendah._`;
                } else if (currentState === 'high' && !withinCooldown) {
                  shouldSend = true;
                  message = `📈 *HIGH ${config.name.toUpperCase()} ALERT*\n\n📱 *Device:* ${deviceName}\n⚠️ *Value:* ${value}${unit} (High: ${high}${unit})\n🕐 *Time:* ${timeStr}\n\n_Nilai sensor melebihi batas aman._`;
                }
              }

              // Kirim jika perlu
              if (shouldSend && message) {
                notifications.push(message);
              }

              // Upsert state terbaru
              const newAlertAt = (shouldSend && currentState !== 'normal') ? now.toISOString() : lastStateRec?.last_alert_at;
              await supabaseClient
                .from('telegram_alert_state')
                .upsert({
                  device_id,
                  sensor_key: key,
                  last_state: currentState,
                  last_value: value,
                  last_alert_at: newAlertAt
                });
            }
          }
        }

        console.log(`[DEBUG] Total notifications generated: ${notifications.length}`);
      }
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
        const timeStr = `${formatDateWithTZ(timestampDate)} ${TZ_LABEL}`;

        const batteryLowThreshold = (device?.battery_low_threshold_percent ?? STATUS_BATTERY_LOW_PERCENT);
        const wifiRssiWeakThreshold = (device?.wifi_rssi_weak_threshold_dbm ?? STATUS_WIFI_RSSI_WEAK_DBM);

        // Baterai (< threshold)
        if (deviceStatus.battery !== undefined && deviceStatus.battery < batteryLowThreshold) {
          notifications.push(`🪫 *LOW BATTERY*

📱 *Device:* ${deviceName}
      🔋 *Level:* ${deviceStatus.battery}% (Threshold: < ${batteryLowThreshold}%)
🕐 *Time:* ${timeStr}

_Harap segera charge perangkat._`);
        }

        // Sinyal (< threshold dBm)
        if (deviceStatus.wifi_rssi !== undefined && deviceStatus.wifi_rssi < wifiRssiWeakThreshold) {
          notifications.push(`📶 *WEAK SIGNAL*

📱 *Device:* ${deviceName}
      📶 *Signal:* ${deviceStatus.wifi_rssi} dBm (Threshold: < ${wifiRssiWeakThreshold} dBm)
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
    🕐 *Time:* ${formatDateWithTZ(new Date())} ${TZ_LABEL}`);
    }

    // 4. KIRIM PESAN (Batched vs individual)
    const messagesToSend = (() => {
      if (BATCH_NOTIFICATIONS && notifications.length > 1) {
        const header = `📢 Alerts (${notifications.length})\n\n📱 Device: ${deviceName}`;
        const divider = `\n\n────────\n\n`;
        const combined = header + divider + notifications.join(divider);
        return [combined];
      }
      return notifications;
    })();

    const results = [];
    for (const message of messagesToSend) {
      for (const chatId of chatIds) {
        try {
          await sendTelegramMessage(tokenToUse, chatId, message);
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