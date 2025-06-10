
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Brain, Thermometer, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';

interface PredictionResult {
  predicted_temperature: number;
  confidence: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  prediction_for: string;
}

const WeatherPredictionWidget = () => {
  const [devices, setDevices] = useState([]);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const { toast } = useToast();

  useEffect(() => {
    fetchDevices();
  }, []);

  useEffect(() => {
    if (devices.length > 0) {
      generatePrediction(devices[0].id);
    }
  }, [devices]);

  const fetchDevices = async () => {
    try {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .eq('status', 'online')
        .limit(1);

      if (error) throw error;
      setDevices(data || []);
    } catch (error) {
      console.error('Error fetching devices:', error);
    }
  };

  const generatePrediction = async (deviceId?: string) => {
    if (!deviceId && devices.length === 0) return;
    
    const targetDeviceId = deviceId || devices[0]?.id;
    if (!targetDeviceId) return;

    setIsLoading(true);
    try {
      const response = await fetch('https://gdmvqskgtdpsktuhsnal.supabase.co/functions/v1/weather-prediction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          device_id: targetDeviceId,
          hours_ahead: 2
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        setPrediction(result.data);
        setLastUpdated(new Date());
      } else {
        console.error('Prediction error:', result.error);
      }
    } catch (error) {
      console.error('Prediction error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="w-4 h-4 text-red-500" />;
      case 'decreasing':
        return <TrendingDown className="w-4 h-4 text-blue-500" />;
      default:
        return <Minus className="w-4 h-4 text-gray-500" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-100 text-green-800';
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getTrendText = (trend: string) => {
    switch (trend) {
      case 'increasing': return 'Naik';
      case 'decreasing': return 'Turun';
      default: return 'Stabil';
    }
  };

  if (devices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            Prediksi Cuaca
          </CardTitle>
          <CardDescription>Prediksi suhu 2 jam kedepan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-gray-500">Tidak ada device online untuk prediksi</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Prediksi Cuaca
            </CardTitle>
            <CardDescription>
              Prediksi suhu 2 jam kedepan • Device: {devices[0]?.name}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => generatePrediction()}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Membuat prediksi...</span>
            </div>
          </div>
        ) : prediction ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Thermometer className="w-5 h-5 text-blue-600" />
                  <span className="font-medium">Suhu Prediksi</span>
                </div>
                <p className="text-2xl font-bold text-blue-600">
                  {prediction.predicted_temperature}°C
                </p>
              </div>
              
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="font-medium">Akurasi</span>
                </div>
                <Badge className={getConfidenceColor(prediction.confidence)}>
                  {Math.round(prediction.confidence * 100)}%
                </Badge>
              </div>
              
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="font-medium">Trend</span>
                  {getTrendIcon(prediction.trend)}
                </div>
                <p className="font-semibold">
                  {getTrendText(prediction.trend)}
                </p>
              </div>
            </div>
            
            <div className="text-center">
              <p className="text-sm text-gray-500">
                Prediksi untuk: {new Date(prediction.prediction_for).toLocaleString('id-ID')}
              </p>
              {lastUpdated && (
                <p className="text-xs text-gray-400 mt-1">
                  Terakhir diperbarui: {lastUpdated.toLocaleTimeString('id-ID')}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">Tidak ada prediksi tersedia</p>
            <Button onClick={() => generatePrediction()} variant="outline">
              Buat Prediksi
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WeatherPredictionWidget;
