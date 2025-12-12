import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const { topic, payload } = await req.json();
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Received MQTT message:', {
      topic,
      payload
    });
    // Parse topic to extract device ID
    // Expected format: iot/devices/{device_id}/data or iot/devices/{device_id}/status
    const topicParts = topic.split('/');
    if (topicParts.length !== 4 || topicParts[0] !== 'iot' || topicParts[1] !== 'devices') {
      throw new Error('Invalid topic format');
    }
    const deviceId = topicParts[2];
    const messageType = topicParts[3];
    // Parse payload
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
    // Check if message contains status fields regardless of topic
    const hasStatusFields = data.battery !== undefined || data.wifi_rssi !== undefined || data.free_heap !== undefined;
    if (messageType === 'data' || hasStatusFields) {
      // Process sensor data if present
      if (data.temperature !== undefined || data.humidity !== undefined || data.pressure !== undefined) {
        const { error } = await supabase.from('sensor_readings').insert({
          device_id: deviceId,
          temperature: data.temperature,
          humidity: data.humidity,
          pressure: data.pressure,
          timestamp: data.timestamp || new Date().toISOString()
        });
        if (error) {
          console.error('Error inserting sensor data:', error);
          throw error;
        }
        console.log('[SAVED, mqtt-data-handler] Sensor data saved for device:', deviceId);
        // Send sensor data notification to Telegram
        console.log('[DEBUG] Mempersiapkan panggilan ke telegram-notification untuk event: sensor_update');
        try {
            const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-notification`;
            const payloadUntukTelegram = {
                device_id: deviceId,
                event: 'sensor_update',
                sensor_data: {
                    temperature: data.temperature,
                    humidity: data.humidity,
                    pressure: data.pressure
                }
            };

            console.log(`[DEBUG] Memanggil URL: ${url}`);
            console.log(`[DEBUG] Mengirim Body: ${JSON.stringify(payloadUntukTelegram)}`);

            const telegramResponse = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
                },
                body: JSON.stringify(payloadUntukTelegram)
            });

            console.log(`[DEBUG] Panggilan fetch selesai. Status Respons: ${telegramResponse.status}`);
            if (!telegramResponse.ok) {
                const errorText = await telegramResponse.text();
                console.error(`[ERROR] Respons dari telegram-notification tidak OK (${telegramResponse.status}):`, errorText);
            } else {
                console.log('[SUCCESS] Panggilan ke telegram-notification berhasil diproses.');
            }
        } catch (error) {
            console.error('[FATAL] Gagal total saat mencoba memanggil telegram-notification:', error);
        }

        // BATAS LOGIKA
      }
      // Process status data if present (even in 'data' topic)
      if (hasStatusFields) {
        const timestamp = data.timestamp || new Date().toISOString();
        const statusData = {
          device_id: deviceId,
          status: data.status || 'online',
          battery: data.battery,
          wifi_rssi: data.wifi_rssi,
          uptime: data.uptime,
          free_heap: data.free_heap,
          ota_update: data.ota_update || null,
          timestamp: timestamp
        };
        const { error: statusError } = await supabase.from('device_status').insert(statusData);
        if (statusError) {
          console.error('Error inserting device status:', statusError);
          throw statusError;
        }
        // Update device record
        const { error: deviceError } = await supabase.from('devices').update({
          status: statusData.status,
          battery: statusData.battery,
          updated_at: timestamp
        }).eq('id', deviceId);
        if (deviceError) {
          console.error('Error updating device:', deviceError);
          throw deviceError;
        }
        // Broadcast status update via realtime
        await supabase.channel('device-status').send({
          type: 'broadcast',
          event: 'device-status-update',
          payload: statusData
        });
        console.log('[SAVED, mqtt-data-handler] Device status saved for device:', deviceId);
        // Send notification to Telegram

        console.log('[DEBUG] Mempersiapkan panggilan ke telegram-notification untuk event: status_update');
        try {
            const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-notification`;
            const payloadUntukTelegram = {
                device_id: deviceId,
                event: 'status_update',
                sensor_data: statusData // Kita gunakan variabel statusData yang sudah Anda buat
            };

            console.log(`[DEBUG] Memanggil URL: ${url}`);
            console.log(`[DEBUG] Mengirim Body: ${JSON.stringify(payloadUntukTelegram)}`);

            const telegramResponse = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
                },
                body: JSON.stringify(payloadUntukTelegram)
            });

            console.log(`[DEBUG] Panggilan fetch selesai. Status Respons: ${telegramResponse.status}`);
            if (!telegramResponse.ok) {
                const errorText = await telegramResponse.text();
                console.error(`[ERROR] Respons dari telegram-notification tidak OK (${telegramResponse.status}):`, errorText);
            } else {
                console.log('[SUCCESS] Panggilan ke telegram-notification berhasil diproses.');
            }
        } catch (error) {
            console.error('[FATAL] Gagal total saat mencoba memanggil telegram-notification:', error);
        }
      
        //BATAS BAWAH LOGIKA
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
        timestamp: timestamp
      };
      const { error: statusError } = await supabase.from('device_status').insert(statusData);
      if (statusError) {
        console.error('Error inserting device status:', statusError);
        throw statusError;
      }
      // Check if device exists, if not create it
      const { data: existingDevice } = await supabase.from('devices').select('id').eq('id', deviceId).single();
      if (!existingDevice) {
        // Create new device
        const { error: createError } = await supabase.from('devices').insert({
          id: deviceId,
          name: `Device ${deviceId}`,
          description: 'Auto-created device',
          type: 'sensor',
          location: 'Unknown',
          status: data.status,
          battery: data.battery,
          mac: '',
          serial: deviceId,
          created_at: timestamp,
          updated_at: timestamp
        });
        if (createError) {
          console.error('Error creating device:', createError);
          throw createError;
        }
        console.log('[CREATED] New device created:', deviceId);
      } else {
        // Update existing device
        const { error: deviceError } = await supabase.from('devices').update({
          status: data.status,
          battery: data.battery,
          updated_at: timestamp
        }).eq('id', deviceId);
        if (deviceError) {
          console.error('Error updating device:', deviceError);
          throw deviceError;
        }
      }
      // Broadcast status update via realtime
      await supabase.channel('device-status').send({
        type: 'broadcast',
        event: 'device-status-update',
        payload: statusData
      });
      console.log('[SAVED, mqtt-data-handler] Device status saved for device:', deviceId);
      // Send notification to Telegram
      console.log('[DEBUG] Mempersiapkan panggilan ke telegram-notification untuk event: status_update');
      try {
          const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-notification`;
          const payloadUntukTelegram = {
              device_id: deviceId,
              event: 'status_update',
              sensor_data: statusData // Kita gunakan variabel statusData yang sudah Anda buat
          };

          console.log(`[DEBUG] Memanggil URL: ${url}`);
          console.log(`[DEBUG] Mengirim Body: ${JSON.stringify(payloadUntukTelegram)}`);

          const telegramResponse = await fetch(url, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
              },
              body: JSON.stringify(payloadUntukTelegram)
          });

          console.log(`[DEBUG] Panggilan fetch selesai. Status Respons: ${telegramResponse.status}`);
          if (!telegramResponse.ok) {
              const errorText = await telegramResponse.text();
              console.error(`[ERROR] Respons dari telegram-notification tidak OK (${telegramResponse.status}):`, errorText);
          } else {
              console.log('[SUCCESS] Panggilan ke telegram-notification berhasil diproses.');
          }
      } catch (error) {
          console.error('[FATAL] Gagal total saat mencoba memanggil telegram-notification:', error);
      }

      //BATAS BAWAH LOGIKA
    }
    return new Response(JSON.stringify({
      success: true,
      message: 'Data processed successfully'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Error processing MQTT message:', error);
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
