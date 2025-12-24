import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface ThresholdCheckRequest {
  sensorId: string
  value: number
  deviceId?: string
}

interface ThresholdAlert {
  sensorId: string
  sensorName: string
  deviceName: string
  value: number
  unit: string
  thresholdType: 'low' | 'high'
  thresholdValue: number
  message: string
}

interface ThresholdCheckResponse {
  success: boolean
  alerts: ThresholdAlert[]
  alertCount: number
  status: 'normal' | 'alert'
  message: string
}

serve(async (req) => {
  try {
    // Handle CORS
    if (req.method === 'OPTIONS') {
      return new Response('ok', { 
        headers: { 
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        } 
      })
    }

    const { sensorId, value }: ThresholdCheckRequest = await req.json()
    
    if (!sensorId || value === undefined) {
      throw new Error('sensorId and value are required')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    // Get sensor threshold data
    const { data: sensor, error } = await supabase
      .from('sensors')
      .select(`
        id, 
        name, 
        threshold_low, 
        threshold_high, 
        unit,
        devices!inner(
          id,
          name,
          location
        )
      `)
      .eq('id', sensorId)
      .single()
    
    if (error) {
      throw new Error(`Failed to fetch sensor: ${error.message}`)
    }

    if (!sensor) {
      throw new Error('Sensor not found')
    }
    
    const alerts: ThresholdAlert[] = []
    
    // Check low threshold
    if (sensor.threshold_low !== null && value < sensor.threshold_low) {
      const alert: ThresholdAlert = {
        sensorId: sensor.id,
        sensorName: sensor.name,
        deviceName: sensor.devices.name,
        value,
        unit: sensor.unit,
        thresholdType: 'low',
        thresholdValue: sensor.threshold_low,
        message: `⚠️ PERINGATAN: Nilai sensor terlalu RENDAH! ${value} ${sensor.unit} < ${sensor.threshold_low} ${sensor.unit}`
      }
      alerts.push(alert)
      
      console.log(`LOW threshold alert for ${sensor.name}: ${value} < ${sensor.threshold_low}`)
    }
    
    // Check high threshold
    if (sensor.threshold_high !== null && value > sensor.threshold_high) {
      const alert: ThresholdAlert = {
        sensorId: sensor.id,
        sensorName: sensor.name,
        deviceName: sensor.devices.name,
        value,
        unit: sensor.unit,
        thresholdType: 'high',
        thresholdValue: sensor.threshold_high,
        message: `🚨 BAHAYA: Nilai sensor terlalu TINGGI! ${value} ${sensor.unit} > ${sensor.threshold_high} ${sensor.unit}`
      }
      alerts.push(alert)
      
      console.log(`HIGH threshold alert for ${sensor.name}: ${value} > ${sensor.threshold_high}`)
    }
    
    // Send alerts if any
    if (alerts.length > 0) {
      for (const alert of alerts) {
        // Format Telegram message
        const telegramMessage = `
🚨 SENSOR ALERT 🚨

📍 Device: ${alert.deviceName}
📊 Sensor: ${alert.sensorName}
📈 Nilai Saat Ini: ${alert.value} ${alert.unit}
⚡ Threshold ${alert.thresholdType === 'low' ? 'Minimum' : 'Maksimum'}: ${alert.thresholdValue} ${alert.unit}

${alert.thresholdType === 'low' 
  ? `⚠️ Nilai sensor terlalu RENDAH!` 
  : `🔥 Nilai sensor terlalu TINGGI!`}

Timestamp: ${new Date().toISOString()}
Location: ${sensor.devices.location || 'N/A'}
        `.trim()
        
        try {
          // Call telegram notification function
          const { error: telegramError } = await supabase.functions.invoke('send-telegram-alert', {
            body: { 
              message: telegramMessage,
              deviceId: sensor.devices.id,
              sensorId: sensor.id,
              alertType: alert.thresholdType,
              value: alert.value
            }
          })
          
          if (telegramError) {
            console.error('Failed to send Telegram notification:', telegramError)
          } else {
            console.log('Telegram notification sent successfully')
          }
        } catch (telegramError) {
          console.error('Error sending Telegram notification:', telegramError)
          // Continue execution even if Telegram fails
        }

        // Log alert to database
        try {
          await supabase.from('sensor_alerts').insert({
            sensor_id: sensor.id,
            device_id: sensor.devices.id,
            alert_type: alert.thresholdType,
            value: alert.value,
            threshold_value: alert.thresholdValue,
            message: alert.message,
            created_at: new Date().toISOString()
          })
        } catch (logError) {
          console.error('Error logging alert to database:', logError)
          // Continue execution even if logging fails
        }
      }
    }
    
    const response: ThresholdCheckResponse = {
      success: true,
      alerts,
      alertCount: alerts.length,
      status: alerts.length > 0 ? 'alert' : 'normal',
      message: alerts.length > 0 
        ? `${alerts.length} threshold alert(s) triggered` 
        : 'All values within normal threshold'
    }

    return new Response(
      JSON.stringify(response),
      { 
        headers: { 
          "Content-Type": "application/json",
          'Access-Control-Allow-Origin': '*'
        } 
      }
    )
  } catch (error) {
    console.error('Error in check-sensor-threshold:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        alerts: [],
        alertCount: 0,
        status: 'error',
        message: 'Failed to check threshold'
      }),
      { 
        status: 400, 
        headers: { 
          "Content-Type": "application/json",
          'Access-Control-Allow-Origin': '*'
        } 
      }
    )
  }
})
