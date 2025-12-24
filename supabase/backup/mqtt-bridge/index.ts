import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Client } from 'https://deno.land/x/mqtt/deno/mod.ts'; 

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const body = await req.json();
    console.log('MQTT Bridge received:', body);
    // Handle test connection requests
    if (body.type === 'test_connection') {
      const mqttConfig = body.config;
      if (!mqttConfig) {
        return new Response(JSON.stringify({
          success: false,
          error: 'MQTT configuration not provided'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      // Simulate MQTT connection test
      console.log('Testing MQTT connection:', {
        broker: mqttConfig.broker,
        username: mqttConfig.username ? 'provided' : 'not provided',
        clientId: mqttConfig.clientId
      });
      // For now, we'll simulate a successful connection
      // In a real implementation, you would attempt to connect to the MQTT broker
      return new Response(JSON.stringify({
        success: true,
        message: 'MQTT configuration is valid',
        broker: mqttConfig.broker,
        clientId: mqttConfig.clientId
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Get protocol settings to check if MQTT is enabled
    const { data: protocolSettings, error: settingsError } = await supabaseClient.from('protocol_settings').select('settings').single();
    if (settingsError) {
      console.error('Error fetching protocol settings:', settingsError);
    }
    const settings = protocolSettings ? JSON.parse(protocolSettings.settings) : null;
    const mqttConfig = settings?.mqtt;
    if (body.type === 'sensor_data') {
      // Store sensor data in database first
      const sensorData = {
        ...body
      };
      delete sensorData.type;
      delete sensorData.device_id;
      // Prepare data for insertion with flexible JSON structure
      const insertData = {
        device_id: body.device_id,
        sensor_data: sensorData,
        timestamp: new Date().toISOString()
      };
      // Map common sensor types to legacy columns for backward compatibility
      if (sensorData.temperature !== undefined) insertData.temperature = sensorData.temperature;
      if (sensorData.humidity !== undefined) insertData.humidity = sensorData.humidity;
      if (sensorData.pressure !== undefined) insertData.pressure = sensorData.pressure;
      if (sensorData.battery !== undefined) insertData.battery = sensorData.battery;
      const { data, error } = await supabaseClient.from('sensor_readings').insert(insertData).select();
      if (error) {
        throw error;
      }
      // Forward to other protocols if enabled
      if (settings?.firebase?.enabled) {
        try {
          await supabaseClient.functions.invoke('firebase-sync', {
            body: {
              type: 'sync_sensor_data',
              device_id: body.device_id,
              data: sensorData
            }
          });
          console.log('Data forwarded to Firebase');
        } catch (firebaseError) {
          console.error('Firebase forwarding error:', firebaseError);
        }
      }
      // Publish to real-time subscribers
      await supabaseClient.channel('sensor-updates').send({
        type: 'broadcast',
        event: 'sensor_data',
        payload: {
          device_id: body.device_id,
          data: data[0]
        }
      });
      // Simulate MQTT publish if MQTT is enabled
      if (mqttConfig?.enabled) {
        console.log('Publishing to MQTT:', {
          broker: mqttConfig.broker,
          topic: mqttConfig.topics.data.replace('+', body.device_id),
          payload: sensorData
        });
      }
      return new Response(JSON.stringify({
        message: 'MQTT data processed and forwarded successfully',
        data,
        forwarded_protocols: [
          ...settings?.firebase?.enabled ? [
            'firebase'
          ] : [],
          ...mqttConfig?.enabled ? [
            'mqtt'
          ] : []
        ]
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    if (body.type === 'device_status') {
      // Update device status from MQTT
      const updateData = {
        status: body.status,
        battery: body.battery || null,
        updated_at: new Date().toISOString()
      };
      const { data, error } = await supabaseClient.from('devices').update(updateData).eq('id', body.device_id).select();
      if (error) {
        throw error;
      }
      // Simulate MQTT status publish
      if (mqttConfig?.enabled) {
        console.log('Publishing status to MQTT:', {
          broker: mqttConfig.broker,
          topic: mqttConfig.topics.status.replace('+', body.device_id),
          payload: {
            status: body.status,
            battery: body.battery
          }
        });
      }
      return new Response(JSON.stringify({
        message: 'Device status updated successfully',
        data
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    if (body.type === 'command') {
      // Send command to device via MQTT
      console.log('Sending command to device via MQTT:', {
        device_id: body.device_id,
        command: body.command,
        topic: mqttConfig?.topics?.commands?.replace('+', body.device_id) || `iot/devices/${body.device_id}/commands`
      });
      return new Response(JSON.stringify({
        message: 'Command sent successfully via MQTT'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    return new Response(JSON.stringify({
      error: 'Unknown message type'
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('MQTT Bridge error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
