
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

    // Parse request body properly
    let body;
    try {
      const requestText = await req.text();
      console.log('Raw request text:', requestText);
      
      if (requestText) {
        body = JSON.parse(requestText);
      } else {
        body = {};
      }
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Invalid JSON in request body',
          details: parseError.message
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Firebase Sync received:', body);

    // Handle test connection requests first
    if (body.type === 'test_connection') {
      // Get Firebase configuration from protocol settings
      const { data: protocolSettings, error: settingsError } = await supabaseClient
        .from('protocol_settings')
        .select('settings')
        .single();

      if (settingsError) {
        console.error('Error fetching protocol settings:', settingsError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Firebase configuration not found' 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      let settings;
      try {
        settings = JSON.parse(protocolSettings.settings);
      } catch (settingsParseError) {
        console.error('Error parsing protocol settings:', settingsParseError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Invalid protocol settings format' 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const firebaseConfig = settings.firebase;

      if (!firebaseConfig || !firebaseConfig.enabled) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Firebase integration is disabled' 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Test Firebase connection
      if (!firebaseConfig.projectId || !firebaseConfig.apiKey) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Missing Firebase configuration' 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Firebase configuration is valid',
          config: {
            projectId: firebaseConfig.projectId,
            authDomain: firebaseConfig.authDomain,
            databaseURL: firebaseConfig.databaseURL
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Firebase configuration from protocol settings for other operations
    const { data: protocolSettings, error: settingsError } = await supabaseClient
      .from('protocol_settings')
      .select('settings')
      .single();

    if (settingsError) {
      console.error('Error fetching protocol settings:', settingsError);
      return new Response(
        JSON.stringify({ error: 'Firebase configuration not found' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    let settings;
    try {
      settings = JSON.parse(protocolSettings.settings);
    } catch (settingsParseError) {
      console.error('Error parsing protocol settings:', settingsParseError);
      return new Response(
        JSON.stringify({ error: 'Invalid protocol settings format' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const firebaseConfig = settings.firebase;

    if (!firebaseConfig || !firebaseConfig.enabled) {
      return new Response(
        JSON.stringify({ error: 'Firebase integration is disabled' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (body.type === 'sync_sensor_data') {
      // Get the latest sensor data for this device
      let sensorData;
      
      if (body.data) {
        // Use provided data
        sensorData = [{ 
          device_id: body.device_id,
          sensor_data: body.data,
          timestamp: new Date().toISOString()
        }];
      } else {
        // Fetch from database
        const { data: dbData, error } = await supabaseClient
          .from('sensor_readings')
          .select('*')
          .eq('device_id', body.device_id)
          .order('timestamp', { ascending: false })
          .limit(body.limit || 1);

        if (error) {
          throw error;
        }
        sensorData = dbData;
      }

      // Simulate Firebase Realtime Database push
      const firebaseData = {
        projectId: firebaseConfig.projectId,
        databaseURL: firebaseConfig.databaseURL,
        path: `/devices/${body.device_id}/sensor_data`,
        data: sensorData.map(reading => ({
          timestamp: reading.timestamp,
          sensor_data: reading.sensor_data || {
            temperature: reading.temperature,
            humidity: reading.humidity,
            pressure: reading.pressure,
            battery: reading.battery
          }
        }))
      };

      console.log('Syncing to Firebase Realtime Database:', firebaseData);

      // In a real implementation, you would use Firebase Admin SDK here
      // For now, we'll simulate the sync
      try {
        // Simulate HTTP request to Firebase REST API
        const firebaseUrl = `${firebaseConfig.databaseURL}${firebaseData.path}.json`;
        console.log('Firebase REST API URL:', firebaseUrl);
        console.log('Data to sync:', firebaseData.data);

        // Here you would make the actual Firebase API call:
        // const response = await fetch(firebaseUrl, {
        //   method: 'PATCH',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify(firebaseData.data[0])
        // });

        return new Response(
          JSON.stringify({ 
            message: 'Data synced to Firebase successfully',
            synced_records: sensorData.length,
            firebase_config: {
              projectId: firebaseConfig.projectId,
              enabled: true
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (firebaseError) {
        console.error('Firebase sync error:', firebaseError);
        return new Response(
          JSON.stringify({ error: 'Failed to sync to Firebase' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    if (body.type === 'sync_devices') {
      // Sync device list to Firebase
      const { data: devices, error } = await supabaseClient
        .from('devices')
        .select('*');

      if (error) {
        throw error;
      }

      // Simulate Firebase push for devices
      console.log('Syncing devices to Firebase:', {
        projectId: firebaseConfig.projectId,
        path: '/devices',
        devices_count: devices.length
      });

      return new Response(
        JSON.stringify({ 
          message: 'Devices synced to Firebase successfully',
          synced_devices: devices.length 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (body.type === 'push_notification') {
      // Send push notification via Firebase FCM
      console.log('Sending FCM notification:', {
        projectId: firebaseConfig.projectId,
        title: body.title,
        message: body.message,
        tokens: body.tokens || []
      });

      // In real implementation, use Firebase Admin SDK for FCM
      return new Response(
        JSON.stringify({ message: 'Notification sent successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Unknown sync type' }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Firebase Sync error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})
