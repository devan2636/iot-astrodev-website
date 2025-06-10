
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Starting device status update...');

    // Get current time and 2 minutes ago threshold for offline detection
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    
    console.log('Checking for readings after:', twoMinutesAgo);

    // Get all unique device IDs that have sent data in the last 2 minutes
    const { data: recentReadings, error: readingsError } = await supabaseClient
      .from('sensor_readings')
      .select('device_id')
      .gte('timestamp', twoMinutesAgo);

    if (readingsError) {
      console.error('Error fetching recent readings:', readingsError);
      throw readingsError;
    }

    console.log('Recent readings:', recentReadings);

    // Get unique device IDs that are active
    const activeDeviceIds = [...new Set(recentReadings?.map(r => r.device_id) || [])];
    console.log('Active device IDs:', activeDeviceIds);

    // Get all devices
    const { data: allDevices, error: devicesError } = await supabaseClient
      .from('devices')
      .select('id, status');

    if (devicesError) {
      console.error('Error fetching devices:', devicesError);
      throw devicesError;
    }

    console.log('All devices:', allDevices);

    let offlineCount = 0;
    let onlineCount = 0;

    // Update devices that should be online
    if (activeDeviceIds.length > 0) {
      const { data: onlineDevices, error: onlineError } = await supabaseClient
        .from('devices')
        .update({ 
          status: 'online',
          updated_at: new Date().toISOString()
        })
        .in('id', activeDeviceIds)
        .neq('status', 'online')
        .select();

      if (onlineError) {
        console.error('Error updating online devices:', onlineError);
      } else {
        onlineCount = onlineDevices?.length || 0;
        console.log(`Updated ${onlineCount} devices to online`);
      }
    }

    // Get devices that should be offline (not in active list)
    const devicesToOffline = allDevices?.filter(device => 
      !activeDeviceIds.includes(device.id) && device.status === 'online'
    ) || [];

    if (devicesToOffline.length > 0) {
      const deviceIdsToOffline = devicesToOffline.map(d => d.id);
      
      const { data: offlineDevices, error: offlineError } = await supabaseClient
        .from('devices')
        .update({ 
          status: 'offline',
          updated_at: new Date().toISOString()
        })
        .in('id', deviceIdsToOffline)
        .select();

      if (offlineError) {
        console.error('Error updating offline devices:', offlineError);
      } else {
        offlineCount = offlineDevices?.length || 0;
        console.log(`Updated ${offlineCount} devices to offline`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        offline_count: offlineCount,
        online_count: onlineCount,
        active_device_ids: activeDeviceIds,
        total_devices: allDevices?.length || 0,
        message: 'Device status updated successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Device status update error:', error);
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
