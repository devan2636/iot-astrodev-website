
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, TrendingDown, Minus, Brain, Thermometer } from 'lucide-react';

interface PredictionResult {
  predicted_temperature: number;
  confidence: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  prediction_for: string;
}

const WeatherPrediction = () => {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [hoursAhead, setHoursAhead] = useState('1');
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [modelInfo, setModelInfo] = useState<any>(null);
  
  const { toast } = useToast();

  React.useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .order('name');

      if (error) throw error;
      setDevices(data || []);
      
      if (data && data.length > 0 && !selectedDevice) {
        setSelectedDevice(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching devices:', error);
    }
  };

  const makePrediction = async () => {
    if (!selectedDevice) {
      toast({
        title: "Error",
        description: "Please select a device",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('https://gdmvqskgtdpsktuhsnal.supabase.co/functions/v1/weather-prediction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          device_id: selectedDevice,
          hours_ahead: parseInt(hoursAhead)
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        setPrediction(result.data);
        setModelInfo(result.model_info);
        toast({
          title: "Success",
          description: "Weather prediction generated successfully",
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Prediction error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate prediction",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="w-5 h-5 text-red-500" />;
      case 'decreasing':
        return <TrendingDown className="w-5 h-5 text-blue-500" />;
      default:
        return <Minus className="w-5 h-5 text-gray-500" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            Weather Prediction (ML Model)
          </CardTitle>
          <CardDescription>
            Prediksi suhu menggunakan model machine learning sederhana dengan linear regression
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="device">Select Device</Label>
              <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a device" />
                </SelectTrigger>
                <SelectContent>
                  {devices.map((device) => (
                    <SelectItem key={device.id} value={device.id}>
                      {device.name} - {device.location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="hours">Hours Ahead</Label>
              <Input
                id="hours"
                type="number"
                min="1"
                max="24"
                value={hoursAhead}
                onChange={(e) => setHoursAhead(e.target.value)}
              />
            </div>

            <div className="flex items-end">
              <Button 
                onClick={makePrediction} 
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? 'Predicting...' : 'Generate Prediction'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {prediction && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Thermometer className="w-5 h-5" />
              Prediction Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Predicted Temperature</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {prediction.predicted_temperature}°C
                    </p>
                  </div>
                  <Thermometer className="w-8 h-8 text-blue-500" />
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Confidence</p>
                    <p className={`text-2xl font-bold ${getConfidenceColor(prediction.confidence)}`}>
                      {Math.round(prediction.confidence * 100)}%
                    </p>
                  </div>
                  <Brain className="w-8 h-8 text-gray-500" />
                </div>
              </div>

              <div className="p-4 bg-green-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Trend</p>
                    <p className="text-lg font-semibold capitalize">
                      {prediction.trend}
                    </p>
                  </div>
                  {getTrendIcon(prediction.trend)}
                </div>
              </div>

              <div className="p-4 bg-purple-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">Prediction Time</p>
                  <p className="text-sm font-medium">
                    {new Date(prediction.prediction_for).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {modelInfo && (
              <div className="mt-4 p-3 bg-gray-100 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">Model Information:</p>
                <div className="text-xs text-gray-600 space-y-1">
                  <p>• Method: {modelInfo.method}</p>
                  <p>• Data points used: {modelInfo.data_points_used}</p>
                  <p>• Trend slope: {modelInfo.slope}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default WeatherPrediction;
