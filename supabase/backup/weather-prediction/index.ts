
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SensorData {
  temperature: number;
  humidity: number;
  pressure: number;
  timestamp: string;
}

interface PredictionResult {
  predicted_temperature: number;
  confidence: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  prediction_for: string;
}

// Simple linear regression implementation
function linearRegression(data: number[]): { slope: number, intercept: number } {
  const n = data.length;
  const x = Array.from({ length: n }, (_, i) => i);
  
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = data.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * data[i], 0);
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  return { slope, intercept };
}

// Calculate moving average for smoothing
function movingAverage(data: number[], window: number): number[] {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - window + 1);
    const subset = data.slice(start, i + 1);
    const avg = subset.reduce((a, b) => a + b, 0) / subset.length;
    result.push(avg);
  }
  return result;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    if (req.method === 'POST') {
      const { device_id, hours_ahead = 1 } = await req.json()
      
      console.log('Predicting weather for device:', device_id, 'hours ahead:', hours_ahead)

      // Get historical data for the last 24 hours
      const { data: sensorData, error } = await supabase
        .from('sensor_readings')
        .select('temperature, humidity, pressure, timestamp')
        .eq('device_id', device_id)
        .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('timestamp', { ascending: true })

      if (error || !sensorData || sensorData.length < 5) {
        return new Response(
          JSON.stringify({ 
            error: 'Insufficient data for prediction. Need at least 5 data points in last 24 hours.' 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Extract temperature data
      const temperatures = sensorData
        .filter(d => d.temperature !== null)
        .map(d => d.temperature as number);

      if (temperatures.length < 5) {
        return new Response(
          JSON.stringify({ 
            error: 'Insufficient temperature data for prediction.' 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Apply smoothing
      const smoothedTemps = movingAverage(temperatures, 3);
      
      // Perform linear regression
      const { slope, intercept } = linearRegression(smoothedTemps);
      
      // Predict temperature for next X hours
      const nextIndex = temperatures.length + (hours_ahead - 1);
      const predictedTemp = slope * nextIndex + intercept;
      
      // Calculate confidence based on variance
      const mean = temperatures.reduce((a, b) => a + b, 0) / temperatures.length;
      const variance = temperatures.reduce((sum, temp) => sum + Math.pow(temp - mean, 2), 0) / temperatures.length;
      const standardDev = Math.sqrt(variance);
      
      // Simple confidence calculation (inverse of standard deviation, normalized)
      const confidence = Math.max(0.1, Math.min(0.95, 1 - (standardDev / 10)));
      
      // Determine trend
      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (slope > 0.1) trend = 'increasing';
      else if (slope < -0.1) trend = 'decreasing';
      
      const predictionTime = new Date(Date.now() + hours_ahead * 60 * 60 * 1000);
      
      const result: PredictionResult = {
        predicted_temperature: Math.round(predictedTemp * 10) / 10,
        confidence: Math.round(confidence * 100) / 100,
        trend,
        prediction_for: predictionTime.toISOString()
      };

      console.log('Prediction result:', result);

      return new Response(
        JSON.stringify({
          success: true,
          data: result,
          model_info: {
            data_points_used: temperatures.length,
            slope: Math.round(slope * 1000) / 1000,
            method: 'linear_regression_with_smoothing'
          }
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // GET method untuk informasi API
    if (req.method === 'GET') {
      return new Response(
        JSON.stringify({ 
          message: 'Weather Prediction API',
          endpoint: 'POST /functions/v1/weather-prediction',
          description: 'Simple temperature prediction using linear regression',
          expected_format: {
            device_id: 'uuid',
            hours_ahead: 'number (optional, default: 1)'
          },
          features: [
            'Linear regression based prediction',
            'Moving average smoothing',
            'Trend analysis',
            'Confidence calculation'
          ]
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
