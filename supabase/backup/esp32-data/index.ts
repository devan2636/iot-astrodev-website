
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Check for API key authentication (optional for backward compatibility)
    const authHeader = req.headers.get('Authorization');
    const apiKey = authHeader?.replace('Bearer ', '');

    if (apiKey) {
      // Verify API key if provided
      const { data: keyData, error: keyError } = await supabaseClient
        .from('api_keys')
        .select('*')
        .eq('key_value', apiKey)
        .eq('is_active', true)
        .single();

      if (keyError || !keyData) {
        return new Response(
          JSON.stringify({ code: 401, message: 'Invalid API key' }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Check if API key is expired
      if (new Date(keyData.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ code: 401, message: 'API key expired' }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Check write permissions
      if (keyData.permissions === 'read') {
        return new Response(
          JSON.stringify({ code: 403, message: 'Insufficient permissions' }),
          { 
            status: 403, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // Parse request body with improved error handling
    let body;
    try {
      const contentType = req.headers.get('content-type') || '';
      console.log('Content-Type:', contentType);
      
      if (contentType.includes('application/json')) {
        // If content-type is JSON, try to parse directly
        const textBody = await req.text();
        console.log('Raw request body:', textBody);
        
        if (textBody.trim()) {
          body = JSON.parse(textBody);
        } else {
          body = {};
        }
      } else {
        // Try to parse as JSON anyway for backward compatibility
        const textBody = await req.text();
        console.log('Raw request body (non-JSON content-type):', textBody);
        
        if (textBody.trim()) {
          try {
            body = JSON.parse(textBody);
          } catch (jsonError) {
            // If JSON parsing fails, try to handle as form data or plain text
            console.log('Failed to parse as JSON, treating as plain text');
            body = { raw_data: textBody };
          }
        } else {
          body = {};
        }
      }
    } catch (parseError) {
      console.error('Request parsing error:', parseError);
      return new Response(
        JSON.stringify({ 
          code: 400, 
          message: 'Invalid request body format',
          details: parseError.message
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('ESP32 data received:', body);

    // Validate required fields
    if (!body.device_id) {
      return new Response(
        JSON.stringify({ code: 400, message: 'device_id is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Prepare sensor data JSON (exclude device_id and other non-sensor fields)
    const sensorData = { ...body };
    delete sensorData.device_id;

    // Prepare data for insertion with flexible JSON structure
    const insertData: any = {
      device_id: body.device_id,
      sensor_data: sensorData,
      timestamp: new Date().toISOString()
    };

    // Map common sensor types to legacy columns for backward compatibility
    if (sensorData.temperature !== undefined) insertData.temperature = sensorData.temperature;
    if (sensorData.humidity !== undefined) insertData.humidity = sensorData.humidity;
    if (sensorData.pressure !== undefined) insertData.pressure = sensorData.pressure;
    if (sensorData.battery !== undefined) insertData.battery = sensorData.battery;

    // Validate sensor data against registered sensors
    try {
      await supabaseClient.rpc('validate_sensor_data', {
        device_uuid: body.device_id,
        data: sensorData
      });
    } catch (validationError) {
      console.warn('Sensor validation warning:', validationError);
    }

    const { data, error } = await supabaseClient
      .from('sensor_readings')
      .insert(insertData)
      .select();

    if (error) {
      console.error('Database error:', error);
      return new Response(
        JSON.stringify({ code: 500, message: 'Database error', details: error.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Update device status to online and battery level
    const deviceUpdateData: any = { 
      status: 'online',
      updated_at: new Date().toISOString()
    };
    
    if (sensorData.battery !== undefined) {
      deviceUpdateData.battery = sensorData.battery;
    }

    await supabaseClient
      .from('devices')
      .update(deviceUpdateData)
      .eq('id', body.device_id);

    console.log('Data inserted successfully:', data);

    // Get protocol settings for forwarding
    const { data: protocolSettings } = await supabaseClient
      .from('protocol_settings')
      .select('settings')
      .single();

    const settings = protocolSettings ? JSON.parse(protocolSettings.settings) : null;

    // Forward to other protocols if enabled
    const forwardedProtocols = [];

    if (settings?.mqtt?.enabled) {
      try {
        await supabaseClient.functions.invoke('mqtt-bridge', {
          body: {
            type: 'sensor_data',
            device_id: body.device_id,
            ...sensorData
          }
        });
        forwardedProtocols.push('mqtt');
        console.log('Data forwarded to MQTT');
      } catch (mqttError) {
        console.error('MQTT forwarding error:', mqttError);
      }
    }

    if (settings?.firebase?.enabled) {
      try {
        await supabaseClient.functions.invoke('firebase-sync', {
          body: {
            type: 'sync_sensor_data',
            device_id: body.device_id,
            data: sensorData
          }
        });
        forwardedProtocols.push('firebase');
        console.log('Data forwarded to Firebase');
      } catch (firebaseError) {
        console.error('Firebase forwarding error:', firebaseError);
      }
    }

    return new Response(
      JSON.stringify({ 
        code: 200,
        message: 'Data received and processed successfully', 
        data: data[0],
        sensor_types: Object.keys(sensorData),
        forwarded_protocols: forwardedProtocols,
        authentication: apiKey ? 'authenticated' : 'unauthenticated'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('ESP32 data error:', error);
    return new Response(
      JSON.stringify({ 
        code: 500, 
        message: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})
