import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Map payload keys to sensor types used in `sensors` table
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

type SensorConfig = {
  id: string;
  name: string;
  type: string;
  calibration_a?: number | null;
  calibration_b?: number | null;
  threshold_low?: number | null;
  threshold_high?: number | null;
};

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const applyCalibration = (raw: number | null, sensor?: SensorConfig) => {
  if (raw === null) return { calibrated: null, a: 1, b: 0 };
  const a = sensor?.calibration_a ?? 1;
  const b = sensor?.calibration_b ?? 0;
  const calibrated = a * raw + b;
  return { calibrated, a, b };
};

const shouldTriggerLow = (value: number | null, sensor?: SensorConfig) => {
  if (value === null || sensor?.threshold_low === null || sensor?.threshold_low === undefined) return false;
  return value < sensor.threshold_low;
};

const shouldTriggerHigh = (value: number | null, sensor?: SensorConfig) => {
  if (value === null || sensor?.threshold_high === null || sensor?.threshold_high === undefined) return false;
  return value > sensor.threshold_high;
};

serve(async (req) => {
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

    // Preload sensor configs for this device (calibration & threshold)
    const { data: sensorConfigs } = await supabase
      .from('sensors')
      .select('id, name, type, calibration_a, calibration_b, threshold_low, threshold_high')
      .eq('device_id', deviceId);

    const findSensorForKey = (key: string): SensorConfig | undefined => {
      const mappedType = SENSOR_TYPE_MAP[key];
      return sensorConfigs?.find((s) => {
        if (mappedType && s.type?.toLowerCase() === mappedType.toLowerCase()) return true;
        if (s.name && s.name.toLowerCase() === key.toLowerCase()) return true;
        return false;
      });
    };

    // Check if message contains status fields regardless of topic
    const hasStatusFields = data.battery !== undefined || data.wifi_rssi !== undefined || data.free_heap !== undefined;

    if (messageType === 'data' || hasStatusFields) {
      
      // --- PERBAIKAN LOGIKA UTAMA DI SINI ---
      // Kita cek: Apakah ada data cuaca (Temp/Hum) ATAU data air (Ketinggian/Hujan)?
      const isWeatherData = data.temperature !== undefined || data.humidity !== undefined || data.pressure !== undefined;
      const isWaterData = data.ketinggian_air !== undefined || data.curah_hujan !== undefined;

      // Jika salah satu jenis data ada, proses!
      if (isWeatherData || isWaterData) {
        const measurementKeys = [
          'temperature',
          'humidity',
          'pressure',
          'battery',
          'ketinggian_air',
          'curah_hujan',
          'light',
          'o2',
          'co2',
          'ph',
          'arah_angin',
          'kecepatan_angin'
        ];

        const rawData: Record<string, number | null> = {};
        const calibratedData: Record<string, number | null> = {};

        // Hitung kalibrasi per measurement
        for (const key of measurementKeys) {
          const rawValue = toNumber(data[key]);
          rawData[key] = rawValue;
          const sensor = findSensorForKey(key);
          const { calibrated } = applyCalibration(rawValue, sensor);
          calibratedData[key] = calibrated;

          // Threshold check per sensor (gunakan nilai terkalibrasi)
          if (sensor && calibrated !== null && (shouldTriggerLow(calibrated, sensor) || shouldTriggerHigh(calibrated, sensor))) {
            try {
              await supabase.functions.invoke('check-sensor-threshold', {
                body: {
                  sensorId: sensor.id,
                  value: calibrated,
                  deviceId
                }
              });
            } catch (thresholdError) {
              console.error('Threshold check failed:', thresholdError);
            }
          }
        }

        const insertTimestamp = data.timestamp || new Date().toISOString();

        const { error } = await supabase.from('sensor_readings').insert({
          device_id: deviceId,
          // Simpan nilai terkalibrasi ke kolom legacy untuk kompatibilitas UI lama
          temperature: calibratedData.temperature ?? null,
          humidity: calibratedData.humidity ?? null,
          pressure: calibratedData.pressure ?? null,
          battery: calibratedData.battery ?? null,
          ketinggian_air: calibratedData.ketinggian_air ?? null,
          curah_hujan: calibratedData.curah_hujan ?? null,
          timestamp: insertTimestamp,
          // Simpan raw + calibrated untuk audit/trace
          sensor_data: {
            raw: rawData,
            calibrated: calibratedData,
            original: data
          }
        });

        if (error) {
          console.error('Error inserting sensor data:', error);
          throw error;
        }

        console.log('[SAVED, mqtt-data-handler] Sensor data saved for device:', deviceId);

        // Send sensor data notification to Telegram
        console.log('[DEBUG] Preparing telegram notification for sensor_update event');
        try {
          const supabaseUrl = Deno.env.get('SUPABASE_URL');
          const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
          
          if (!supabaseUrl || !supabaseKey) {
            console.error('[ERROR] Supabase credentials missing');
            throw new Error('Supabase configuration missing');
          }
          
          const url = `${supabaseUrl}/functions/v1/telegram-notifications`;
          
          const payloadUntukTelegram = {
            device_id: deviceId,
            event: 'sensor_update',
            sensor_data: {
              temperature: calibratedData.temperature,
              humidity: calibratedData.humidity,
              pressure: calibratedData.pressure,
              ketinggian_air: calibratedData.ketinggian_air,
              curah_hujan: calibratedData.curah_hujan,
              timestamp: insertTimestamp
            }
          };

          console.log(`[TELEGRAM] Invoking telegram-notifications function`);
          console.log(`[TELEGRAM] Payload:`, JSON.stringify(payloadUntukTelegram));

          const telegramResponse = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`
            },
            body: JSON.stringify(payloadUntukTelegram)
          });

          const responseText = await telegramResponse.text();
          console.log(`[TELEGRAM] Response Status: ${telegramResponse.status}`);
          console.log(`[TELEGRAM] Response Body:`, responseText);
          
          if (!telegramResponse.ok) {
            console.error(`[TELEGRAM_ERROR] Request failed with status ${telegramResponse.status}`);
          }
        } catch (error) {
          console.error('[TELEGRAM_FATAL]', error.message);
        }
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
          timestamp: timestamp,
          status_data: data
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

        // Send notification to Telegram (Status Update)
        console.log('[DEBUG] Preparing telegram notification for status_update event');
        try {
          const supabaseUrl = Deno.env.get('SUPABASE_URL');
          const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
          
          if (!supabaseUrl || !supabaseKey) {
            console.error('[ERROR] Supabase credentials missing');
            throw new Error('Supabase configuration missing');
          }
          
          const url = `${supabaseUrl}/functions/v1/telegram-notifications`;
          const payloadUntukTelegram = {
            device_id: deviceId,
            event: 'status_update',
            sensor_data: statusData 
          };
          
          console.log(`[TELEGRAM] Invoking telegram-notifications function`);
          console.log(`[TELEGRAM] Payload:`, JSON.stringify(payloadUntukTelegram));
          
          const telegramResponse = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`
            },
            body: JSON.stringify(payloadUntukTelegram)
          });

          const responseText = await telegramResponse.text();
          console.log(`[TELEGRAM] Response Status: ${telegramResponse.status}`);
          console.log(`[TELEGRAM] Response Body:`, responseText);

          if (!telegramResponse.ok) {
            console.error(`[TELEGRAM_ERROR] Request failed with status ${telegramResponse.status}`);
          }
        } catch (error) {
          console.error('[TELEGRAM_FATAL]', error.message);
        }
      }

    } else if (messageType === 'status') {
      // --- LOGIKA STATUS ONLY (Tidak Berubah) ---
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
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        
        if (!supabaseUrl || !supabaseKey) {
          console.error('[ERROR] Supabase credentials missing');
          throw new Error('Supabase configuration missing');
        }
        
        const url = `${supabaseUrl}/functions/v1/telegram-notifications`;
        const payloadUntukTelegram = {
          device_id: deviceId,
          event: 'status_update',
          sensor_data: statusData
        };
        
        console.log(`[TELEGRAM] Invoking telegram-notifications function`);
        console.log(`[TELEGRAM] Payload:`, JSON.stringify(payloadUntukTelegram));
        
        const telegramResponse = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify(payloadUntukTelegram)
        });

        const responseText = await telegramResponse.text();
        console.log(`[TELEGRAM] Response Status: ${telegramResponse.status}`);
        console.log(`[TELEGRAM] Response Body:`, responseText);

        if (!telegramResponse.ok) {
          console.error(`[TELEGRAM_ERROR] Request failed with status ${telegramResponse.status}`);
        }
      } catch (error) {
        console.error('[TELEGRAM_FATAL]', error.message);
      }
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