import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface SensorCalibrationRequest {
  sensorId: string
  rawValue: number
}

interface SensorCalibrationResponse {
  success: boolean
  rawValue: number
  calibratedValue: number
  calibration: {
    a: number
    b: number
    formula: string
  }
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

    const { sensorId, rawValue }: SensorCalibrationRequest = await req.json()
    
    if (!sensorId || rawValue === undefined) {
      throw new Error('sensorId and rawValue are required')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    // Get sensor calibration data
    const { data: sensor, error } = await supabase
      .from('sensors')
      .select('id, name, calibration_a, calibration_b, unit')
      .eq('id', sensorId)
      .single()
    
    if (error) {
      throw new Error(`Failed to fetch sensor: ${error.message}`)
    }

    if (!sensor) {
      throw new Error('Sensor not found')
    }
    
    // Apply calibration: y = ax + b
    const a = sensor.calibration_a || 1.0
    const b = sensor.calibration_b || 0.0
    const calibratedValue = (a * rawValue) + b
    
    const response: SensorCalibrationResponse = {
      success: true,
      rawValue,
      calibratedValue: parseFloat(calibratedValue.toFixed(6)),
      calibration: {
        a,
        b,
        formula: `y = ${a} × ${rawValue} + ${b} = ${calibratedValue.toFixed(6)}`
      }
    }

    console.log(`Calibration applied for sensor ${sensor.name}: ${rawValue} → ${calibratedValue.toFixed(6)} ${sensor.unit}`)
    
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
    console.error('Error in apply-sensor-calibration:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
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
