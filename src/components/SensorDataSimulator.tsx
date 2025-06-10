
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Play, RefreshCw, Key } from 'lucide-react';

const SensorDataSimulator = () => {
  const [devices, setDevices] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [selectedApiKey, setSelectedApiKey] = useState('');
  const [temperature, setTemperature] = useState('25.5');
  const [humidity, setHumidity] = useState('60.2');
  const [pressure, setPressure] = useState('1013.25');
  const [battery, setBattery] = useState('85');
  const [isSimulating, setIsSimulating] = useState(false);
  const [intervalId, setIntervalId] = useState(null);
  
  const { toast } = useToast();

  React.useEffect(() => {
    fetchDevices();
    fetchApiKeys();
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

  const fetchApiKeys = async () => {
    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('is_active', true)
        .in('permissions', ['write', 'admin'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApiKeys(data || []);
      
      if (data && data.length > 0 && !selectedApiKey) {
        setSelectedApiKey(data[0].key_value);
      }
    } catch (error) {
      console.error('Error fetching API keys:', error);
    }
  };

  const sendSensorData = async (deviceId, temp, hum, press, bat) => {
    try {
      const headers = {
        'Content-Type': 'application/json',
      };

      // Add Authorization header if API key is selected
      if (selectedApiKey) {
        headers['Authorization'] = `Bearer ${selectedApiKey}`;
      }

      const response = await fetch('https://gdmvqskgtdpsktuhsnal.supabase.co/functions/v1/esp32-data', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          device_id: deviceId,
          temperature: parseFloat(temp),
          humidity: parseFloat(hum),
          pressure: parseFloat(press),
          battery: parseInt(bat)
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log('Data sent successfully:', result);
        return { success: true, result };
      } else {
        console.error('Error sending data:', result);
        return { success: false, error: result };
      }
    } catch (error) {
      console.error('Network error:', error);
      return { success: false, error: { message: error.message } };
    }
  };

  const handleSendOnce = async () => {
    if (!selectedDevice) {
      toast({
        title: "Error",
        description: "Please select a device",
        variant: "destructive",
      });
      return;
    }

    const result = await sendSensorData(selectedDevice, temperature, humidity, pressure, battery);
    
    if (result.success) {
      toast({
        title: "Success",
        description: `Data sent successfully ${result.result.authentication === 'authenticated' ? '(authenticated)' : '(no auth)'}`,
      });
    } else {
      toast({
        title: "Error",
        description: result.error?.message || "Failed to send sensor data",
        variant: "destructive",
      });
    }
  };

  const generateRandomData = () => {
    const baseTemp = 25;
    const baseHum = 60;
    const basePress = 1013;
    const baseBat = parseInt(battery);

    setTemperature((baseTemp + (Math.random() - 0.5) * 10).toFixed(1));
    setHumidity((baseHum + (Math.random() - 0.5) * 20).toFixed(1));
    setPressure((basePress + (Math.random() - 0.5) * 50).toFixed(2));
    setBattery(Math.max(0, Math.min(100, baseBat + Math.floor((Math.random() - 0.5) * 10))).toString());
  };

  const startSimulation = () => {
    if (!selectedDevice) {
      toast({
        title: "Error",
        description: "Please select a device",
        variant: "destructive",
      });
      return;
    }

    setIsSimulating(true);
    
    const id = setInterval(async () => {
      generateRandomData();
      
      // Use the current values after generation
      setTimeout(async () => {
        const result = await sendSensorData(
          selectedDevice, 
          temperature, 
          humidity, 
          pressure, 
          battery
        );
        
        if (!result.success) {
          console.warn('Failed to send simulated data:', result.error);
        }
      }, 100);
    }, 5000); // Send data every 5 seconds

    setIntervalId(id);
    
    toast({
      title: "Simulation Started",
      description: "Sending random sensor data every 5 seconds",
    });
  };

  const stopSimulation = () => {
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }
    setIsSimulating(false);
    
    toast({
      title: "Simulation Stopped",
      description: "Data simulation has been stopped",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="w-5 h-5" />
          Sensor Data Simulator
        </CardTitle>
        <CardDescription>
          Simulasi data sensor untuk testing sistem monitoring
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <Label htmlFor="apikey" className="flex items-center gap-2">
              <Key className="w-4 h-4" />
              API Key (Optional)
            </Label>
            <Select value={selectedApiKey} onValueChange={setSelectedApiKey}>
              <SelectTrigger>
                <SelectValue placeholder="No authentication" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No authentication</SelectItem>
                {apiKeys.map((key) => (
                  <SelectItem key={key.id} value={key.key_value}>
                    {key.name} ({key.permissions})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="temperature">Temperature (°C)</Label>
            <Input
              id="temperature"
              type="number"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="humidity">Humidity (%)</Label>
            <Input
              id="humidity"
              type="number"
              step="0.1"
              value={humidity}
              onChange={(e) => setHumidity(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="pressure">Pressure (Pa)</Label>
            <Input
              id="pressure"
              type="number"
              step="0.01"
              value={pressure}
              onChange={(e) => setPressure(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="battery">Battery (%)</Label>
            <Input
              id="battery"
              type="number"
              min="0"
              max="100"
              value={battery}
              onChange={(e) => setBattery(e.target.value)}
            />
          </div>
        </div>
        
        <div className="flex gap-2 pt-4">
          <Button onClick={handleSendOnce} variant="outline">
            Send Once
          </Button>
          
          <Button onClick={generateRandomData} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Random Data
          </Button>
          
          {!isSimulating ? (
            <Button onClick={startSimulation} className="bg-green-600 hover:bg-green-700">
              <Play className="w-4 h-4 mr-2" />
              Start Simulation
            </Button>
          ) : (
            <Button onClick={stopSimulation} variant="destructive">
              Stop Simulation
            </Button>
          )}
        </div>
        
        {isSimulating && (
          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
            <p className="text-sm text-green-700 font-medium">
              🟢 Simulation running - sending data every 5 seconds
            </p>
          </div>
        )}

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">API Information</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <p><strong>Endpoint:</strong> <code>https://gdmvqskgtdpsktuhsnal.supabase.co/functions/v1/esp32-data</code></p>
            <p><strong>Method:</strong> POST</p>
            <p><strong>Authentication:</strong> {selectedApiKey ? 'Bearer token required' : 'No authentication (backward compatibility)'}</p>
            <p><strong>Content-Type:</strong> application/json</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SensorDataSimulator;
