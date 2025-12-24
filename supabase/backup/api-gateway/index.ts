
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

    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // Extract API key from Authorization header
    const authHeader = req.headers.get('Authorization');
    const apiKey = authHeader?.replace('Bearer ', '');

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key required' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verify API key
    const { data: keyData, error: keyError } = await supabaseClient
      .from('api_keys')
      .select('*')
      .eq('key_value', apiKey)
      .eq('is_active', true)
      .single();

    if (keyError || !keyData) {
      return new Response(
        JSON.stringify({ error: 'Invalid API key' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if API key is expired
    if (new Date(keyData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'API key expired' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Route requests based on path and method
    if (path === '/api-gateway/devices' && method === 'GET') {
      // Get devices list
      const { data, error } = await supabaseClient
        .from('devices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return new Response(
        JSON.stringify({ data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (path === '/api-gateway/sensors' && method === 'GET') {
      // Get sensors data
      const { data, error } = await supabaseClient
        .from('sensors')
        .select(`
          *,
          devices(name, location)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return new Response(
        JSON.stringify({ data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (path === '/api-gateway/sensor-data' && method === 'POST') {
      // Check write permissions
      if (keyData.permissions === 'read') {
        return new Response(
          JSON.stringify({ error: 'Insufficient permissions' }),
          { 
            status: 403, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Send sensor readings with flexible JSON structure
      const body = await req.json();
      
      // Validate required fields
      if (!body.device_id) {
        return new Response(
          JSON.stringify({ error: 'device_id is required' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Prepare sensor data JSON
      const sensorData = { ...body };
      delete sensorData.device_id; // Remove device_id from sensor data

      // Prepare data for insertion
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

      const { data, error } = await supabaseClient
        .from('sensor_readings')
        .insert(insertData)
        .select();

      if (error) {
        throw error;
      }

      return new Response(
        JSON.stringify({ 
          message: 'Data received successfully', 
          data,
          sensor_types: Object.keys(sensorData)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (path.startsWith('/api-gateway/sensor-data/') && method === 'GET') {
      // Get device readings
      const deviceId = path.split('/')[3];
      const limit = url.searchParams.get('limit') || '100';
      const hours = url.searchParams.get('hours') || '24';
      const sensorType = url.searchParams.get('sensor_type');

      const hoursAgo = new Date();
      hoursAgo.setHours(hoursAgo.getHours() - parseInt(hours));

      let query = supabaseClient
        .from('sensor_readings')
        .select('*')
        .eq('device_id', deviceId)
        .gte('timestamp', hoursAgo.toISOString())
        .order('timestamp', { ascending: false })
        .limit(parseInt(limit));

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      // Filter by sensor type if specified
      let filteredData = data;
      if (sensorType) {
        filteredData = data.filter(reading => {
          // Check both sensor_data JSON and legacy columns
          const jsonValue = reading.sensor_data?.[sensorType];
          const legacyValue = reading[sensorType];
          return jsonValue !== undefined || legacyValue !== undefined;
        });
      }

      return new Response(
        JSON.stringify({ 
          data: filteredData,
          sensor_type: sensorType,
          total_records: filteredData.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route not found
    return new Response(
      JSON.stringify({ error: 'Route not found' }),
      { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('API Gateway error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})
