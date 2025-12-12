// @deno-types="https://deno.land/x/supabase_js@v2.39.0/mod.ts"
/// <reference types="https://deno.land/x/supabase_js@v2.39.0/mod.ts" />
/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const { device_id, event, sensor_data } = await req.json();
    function formatDateToGMT7(date) {
      // Convert date to GMT+7 timezone and format as string
      const utc = date.getTime() + date.getTimezoneOffset() * 60000;
      const gmt7 = new Date(utc + 7 * 3600000);
      return gmt7.toLocaleString('id-ID', {
        hour12: false
      });
    }
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const chatIdsString = Deno.env.get('TELEGRAM_CHAT_ID');
    console.log('Checking Telegram credentials...');
    if (!botToken || !chatIdsString) {
      console.error('Telegram credentials not configured!');
      console.log('TELEGRAM_BOT_TOKEN:', !!botToken);
      console.log('TELEGRAM_CHAT_ID:', !!chatIdsString);
      throw new Error('Telegram credentials not configured');
    }
    console.log('Telegram credentials verified');
    // Support multiple chat IDs separated by comma
    const chatIds = chatIdsString.split(',').map((id)=>id.trim()).filter((id)=>id.length > 0);
    // Get device name first
    const { data: device, error: deviceError } = await supabaseClient.from('devices').select('name').eq('id', device_id).single();
    let deviceName = device_id;
    if (deviceError) {
      console.log('Device not found in database, using device_id as name:', device_id);
    } else {
      deviceName = device?.name || device_id;
    }
    const notifications = [];
    // Handle test events
    if (event === 'test') {
      notifications.push(`🧪 *Test Notification*

📱 *Device:* ${deviceName}
📝 *Message:* This is a test notification from IoT Monitoring System
🕐 *Time:* ${formatDateToGMT7(new Date())}

_IoT Monitoring System - AstroDev_`);
    } else if (event === 'sensor_update') {
      console.log('Processing sensor_update event with sensor_data:', sensor_data);
      if (sensor_data) {
        const { temperature, humidity, pressure, timestamp } = sensor_data ?? {};
        const timestampDate = timestamp ? new Date(timestamp) : new Date();
        // Check temperature
        if (temperature !== undefined && (temperature <= 5 || temperature >= 40)) {
          notifications.push(`🌡️ *Temperature Critical*

📱 *Device:* ${deviceName}
📝 *Message:* Temperature ${temperature}°C outside safe range (5-40°C)
🕐 *Time:* ${formatDateToGMT7(timestampDate)}

_IoT Monitoring System - AstroDev_`);
        }
        // Check humidity
        if (humidity !== undefined && (humidity <= 20 || humidity >= 80)) {
          notifications.push(`💧 *Humidity Critical*

📱 *Device:* ${deviceName}
📝 *Message:* Humidity ${humidity}% outside safe range (20-80%)
🕐 *Time:* ${formatDateToGMT7(timestampDate)}

_IoT Monitoring System - AstroDev_`);
        }
        // Check pressure
        if (pressure !== undefined && (pressure <= 970 || pressure >= 1040)) {
          notifications.push(`🌪️ *Pressure Critical*

📱 *Device:* ${deviceName}
📝 *Message:* Pressure ${pressure} hPa outside safe range (970-1040 hPa)
🕐 *Time:* ${formatDateToGMT7(timestampDate)}

_IoT Monitoring System - AstroDev_`);
        }
        console.log('Sensor notifications generated:', notifications.length);
      } else {
        // Get latest sensor readings from database
        const { data: sensorReadings, error: sensorError } = await supabaseClient.from('sensor_readings').select('*').eq('device_id', device_id).order('timestamp', {
          ascending: false
        }).limit(1);
        if (sensorError) {
          console.error('Error fetching sensor data:', sensorError);
          throw sensorError;
        }
        if (!sensorReadings || sensorReadings.length === 0) {
          notifications.push(`⚠️ No sensor data found for device: ${deviceName}`);
        } else {
          const sensorData = sensorReadings[0];
          const { temperature, humidity, pressure, timestamp } = sensorData;
          const timestampDate = timestamp ? new Date(timestamp) : new Date();
          // Check temperature
          if (temperature !== undefined && (temperature <= 5 || temperature >= 40)) {
            notifications.push(`🌡️ *Temperature Critical*

📱 *Device:* ${deviceName}
📝 *Message:* Temperature ${temperature}°C outside safe range (5-40°C)
🕐 *Time:* ${formatDateToGMT7(timestampDate)}

_IoT Monitoring System - AstroDev_`);
          }
          // Check humidity
          if (humidity !== undefined && (humidity <= 20 || humidity >= 80)) {
            notifications.push(`💧 *Humidity Critical*

📱 *Device:* ${deviceName}
📝 *Message:* Humidity ${humidity}% outside safe range (20-80%)
🕐 *Time:* ${formatDateToGMT7(timestampDate)}

_IoT Monitoring System - AstroDev_`);
          }
          // Check pressure
          if (pressure !== undefined && (pressure <= 970 || pressure >= 1040)) {
            notifications.push(`🌪️ *Pressure Critical*

📱 *Device:* ${deviceName}
📝 *Message:* Pressure ${pressure} hPa outside safe range (970-1040 hPa)
🕐 *Time:* ${formatDateToGMT7(timestampDate)}

_IoT Monitoring System - AstroDev_`);
          }
        }
      }
    } else if (event === 'status_update') {
      let deviceStatus = sensor_data;
      // If no sensor_data provided, get from database
      if (!deviceStatus || deviceStatus.battery === undefined) {
        const { data: deviceStatuses, error: statusError } = await supabaseClient.from('device_status').select('*').eq('device_id', device_id).order('timestamp', {
          ascending: false
        }).limit(1);
        if (statusError) {
          console.error('Error fetching device status:', statusError);
          throw statusError;
        }
        if (!deviceStatuses || deviceStatuses.length === 0) {
          notifications.push(`⚠️ No status data found for device: ${deviceName}`);
          return;
        }
        deviceStatus = deviceStatuses[0];
      }
      const timestampDate = deviceStatus?.timestamp ? new Date(deviceStatus.timestamp) : new Date();
      // Check battery level
      if (deviceStatus?.battery !== undefined && deviceStatus.battery <= 10) {
        notifications.push(`🔋 *Battery Critical*

📱 *Device:* ${deviceName}
📝 *Message:* Device battery level critically low: ${deviceStatus.battery}%
🕐 *Time:* ${formatDateToGMT7(timestampDate)}

_IoT Monitoring System - AstroDev_`);
      } else if (deviceStatus?.battery !== undefined && deviceStatus.battery < 20) {
        notifications.push(`🔋 *Battery Warning*

📱 *Device:* ${deviceName}
📝 *Message:* Device battery level low: ${deviceStatus.battery}%
🕐 *Time:* ${formatDateToGMT7(timestampDate)}

_IoT Monitoring System - AstroDev_`);
      }
      // Check WiFi signal
      if (deviceStatus?.wifi_rssi !== undefined && deviceStatus.wifi_rssi < -80) {
        notifications.push(`📶 *WiFi Signal Warning*

📱 *Device:* ${deviceName}
📝 *Message:* Weak WiFi signal: ${deviceStatus.wifi_rssi} dBm
🕐 *Time:* ${formatDateToGMT7(timestampDate)}

_IoT Monitoring System - AstroDev_`);
      }
      // Check memory
      if (deviceStatus?.free_heap !== undefined && deviceStatus.free_heap < 10240) {
        notifications.push(`💾 *Low Memory Warning*

📱 *Device:* ${deviceName}
📝 *Message:* Device memory is running low: ${Math.floor(deviceStatus.free_heap / 1024)} KB free
🕐 *Time:* ${formatDateToGMT7(timestampDate)}

_IoT Monitoring System - AstroDev_`);
      }
    }
    // Send notifications to Telegram
    const results = [];
    console.log(`Preparing to send ${notifications.length} notifications`);
    for (const notification of notifications){
      for (const chatId of chatIds){
        try {
          if (notification) {
            console.log('Sending notification:', notification.substring(0, 50) + '...');
          }
          const result = await sendTelegramMessage(botToken, chatId, notification);
          console.log('Notification sent successfully:', result);
          results.push(result);
        } catch (error) {
          console.error('Error sending Telegram message:', error);
          console.error('Failed notification content:', notification);
          results.push({
            error: error?.message,
            stack: error?.stack,
            notification
          });
        }
      }
    }
    return new Response(JSON.stringify({
      message: 'Notifications sent successfully',
      events_count: notifications.length,
      results
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Error sending notifications:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 400
    });
  }
});
async function sendTelegramMessage(botToken, chatId, message) {
  try {
    console.log('Constructing Telegram API URL...');
    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    console.log('Preparing request payload...');
    const payload = {
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown'
    };
    console.log('Sending request to Telegram API...');
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const error = await response.text();
      console.error('Telegram API error response:', error);
      throw new Error(`Telegram API error: ${error}`);
    }
    const result = await response.json();
    console.log('Telegram API successful response:', result);
    return result;
  } catch (error) {
    console.error('Error in sendTelegramMessage:', error);
    throw error;
  }
}
