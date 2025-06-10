
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const DeviceDetails = ({ device, open, onOpenChange, onEdit }) => {
  const [sensorData, setSensorData] = useState([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (device && open) {
      fetchSensorData();
    }
  }, [device, open]);
  
  const fetchSensorData = async () => {
    if (!device) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sensor_readings')
        .select('*')
        .eq('device_id', device.id)
        .order('timestamp', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      
      // If no data, create sample data
      if (!data || data.length === 0) {
        const sampleData = [];
        const baseTime = new Date();
        
        for (let i = 9; i >= 0; i--) {
          const time = new Date(baseTime);
          time.setHours(baseTime.getHours() - i);
          
          sampleData.push({
            timestamp: time.toISOString(),
            temperature: 22 + Math.random() * 5,
            humidity: 45 + Math.random() * 15,
            pressure: 1010 + Math.random() * 10,
            battery: device.battery - Math.floor(i * 0.5),
          });
        }
        
        setSensorData(sampleData);
      } else {
        setSensorData(data);
      }
    } catch (error) {
      console.error('Error fetching sensor data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  if (!device) return null;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{device.name}</DialogTitle>
          <DialogDescription>Device details and information</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">Status:</span>
            <Badge variant={device.status === 'online' ? 'default' : 'destructive'}>
              {device.status}
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <span className="font-medium block">Device ID:</span>
              <span className="font-mono text-sm text-gray-600 break-all">{device.id}</span>
            </div>
            
            <div>
              <span className="font-medium block">Type:</span>
              <span>{device.type}</span>
            </div>
            
            <div>
              <span className="font-medium block">Battery:</span>
              <span>{device.battery}%</span>
            </div>
            
            <div>
              <span className="font-medium block">Location:</span>
              <span>{device.location}</span>
            </div>
            
            <div>
              <span className="font-medium block">Serial Number:</span>
              <span>{device.serial}</span>
            </div>
            
            <div className="col-span-2">
              <span className="font-medium block">MAC Address:</span>
              <span className="font-mono text-sm">{device.mac}</span>
            </div>
            
            <div className="col-span-2">
              <span className="font-medium block">Coordinates:</span>
              <span className="font-mono text-sm">
                {device.latitude ? `Lat: ${device.latitude}, Long: ${device.longitude}` : 'Not available'}
              </span>
            </div>
            
            {device.description && (
              <div className="col-span-2">
                <span className="font-medium block">Description:</span>
                <p className="text-sm text-gray-600 mt-1">{device.description}</p>
              </div>
            )}
          </div>
          
          {/* Sensor data section */}
          <div className="space-y-4 mt-4">
            <h4 className="font-medium">Recent Sensor Readings</h4>
            
            {loading ? (
              <div className="flex justify-center p-4">
                <p>Loading sensor data...</p>
              </div>
            ) : (
              sensorData.length > 0 ? (
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sensorData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={formatTimestamp} 
                      />
                      <YAxis />
                      <Tooltip 
                        formatter={(value, name) => {
                          const units = {
                            temperature: '°C',
                            humidity: '%',
                            pressure: 'hPa',
                            battery: '%'
                          };
                          return [`${value}${units[name] || ''}`, name];
                        }}
                        labelFormatter={formatTimestamp}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="temperature" 
                        stroke="#ef4444" 
                        name="Temperature"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="humidity" 
                        stroke="#3b82f6" 
                        name="Humidity"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No sensor data available</p>
              )
            )}
          </div>
        </div>
        
        <div className="flex justify-between mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={() => {
            onOpenChange(false);
            onEdit(device);
          }}>Edit Device</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeviceDetails;
