import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, subDays, subHours } from 'date-fns';
import PDFReport from './PDFReport';

const Monitoring = () => {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('all');
  const [timeRange, setTimeRange] = useState('24h');
  const [sensorData, setSensorData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('user');
  const { toast } = useToast();

  useEffect(() => {
    fetchUserRole();
    fetchDevices();
  }, []);

  useEffect(() => {
    if (devices.length > 0) {
      fetchSensorData();
    }
  }, [selectedDevice, timeRange, devices]);

  const fetchUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        
        if (profile) {
          setUserRole(profile.role || 'user');
        }
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
    }
  };

  const fetchDevices = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const userRole = profile?.role || 'user';

      let data;
      if (userRole === 'superadmin' || userRole === 'admin') {
        const { data: allDevices, error } = await supabase
          .from('devices')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        data = allDevices;
      } else {
        const { data: accessData, error } = await supabase
          .from('user_device_access')
          .select(`
            devices!user_device_access_device_id_fkey(*)
          `)
          .eq('user_id', user.id);

        if (error) throw error;
        data = accessData?.map(access => access.devices).filter(device => device !== null) || [];
      }

      setDevices(data || []);
    } catch (error) {
      console.error('Error fetching devices:', error);
      toast({
        title: "Error",
        description: "Failed to fetch devices",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSensorData = async () => {
    try {
      let query = supabase
        .from('sensor_readings')
        .select('*')
        .order('timestamp', { ascending: true });

      // Filter by device if specific device is selected
      if (selectedDevice !== 'all') {
        query = query.eq('device_id', selectedDevice);
      } else {
        // Filter by accessible devices for regular users
        if (userRole !== 'superadmin' && userRole !== 'admin') {
          const deviceIds = devices.map(d => d.id);
          if (deviceIds.length > 0) {
            query = query.in('device_id', deviceIds);
          }
        }
      }

      // Filter by time range
      let startTime;
      switch (timeRange) {
        case '1h':
          startTime = subHours(new Date(), 1);
          break;
        case '24h':
          startTime = subHours(new Date(), 24);
          break;
        case '7d':
          startTime = subDays(new Date(), 7);
          break;
        case '30d':
          startTime = subDays(new Date(), 30);
          break;
        default:
          startTime = subHours(new Date(), 24);
      }

      query = query.gte('timestamp', startTime.toISOString());

      const { data, error } = await query;

      if (error) throw error;

      // Process data for charts
      const processedData = data.map(reading => ({
        timestamp: reading.timestamp,
        time: format(new Date(reading.timestamp), timeRange === '1h' ? 'HH:mm' : timeRange === '24h' ? 'HH:mm' : 'dd/MM'),
        temperature: reading.temperature,
        humidity: reading.humidity,
        pressure: reading.pressure,
        battery: reading.battery,
        device_id: reading.device_id,
        ...(reading.sensor_data && typeof reading.sensor_data === 'object' ? reading.sensor_data : {})
      }));

      setSensorData(processedData);
    } catch (error) {
      console.error('Error fetching sensor data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch sensor data",
        variant: "destructive",
      });
    }
  };

  const getDeviceStats = () => {
    const onlineDevices = devices.filter(d => d.status === 'online').length;
    const offlineDevices = devices.filter(d => d.status === 'offline').length;
    const totalReadings = sensorData.length;
    
    const avgTemperature = sensorData.length > 0 
      ? (sensorData.reduce((sum, d) => sum + (d.temperature || 0), 0) / sensorData.length).toFixed(1)
      : 0;

    return { onlineDevices, offlineDevices, totalReadings, avgTemperature };
  };

  const stats = getDeviceStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p>Loading monitoring data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Monitoring</h1>
          <p className="text-gray-600">Monitor real-time sensor data and device performance</p>
        </div>
        
        <div className="flex gap-2">
          <PDFReport devices={devices} />
          <Button onClick={fetchSensorData} variant="outline">
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-4 items-center">
        <div className="flex items-center gap-2">
          <label htmlFor="device-select" className="text-sm font-medium">Device:</label>
          <Select value={selectedDevice} onValueChange={setSelectedDevice}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Devices</SelectItem>
              {devices.map((device) => (
                <SelectItem key={device.id} value={device.id}>
                  {device.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-2">
          <label htmlFor="time-range" className="text-sm font-medium">Time Range:</label>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Online Devices</CardTitle>
            <span className="text-2xl">🟢</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.onlineDevices}</div>
            <p className="text-xs text-gray-500">Currently active</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offline Devices</CardTitle>
            <span className="text-2xl">🔴</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.offlineDevices}</div>
            <p className="text-xs text-gray-500">Not responding</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Readings</CardTitle>
            <span className="text-2xl">📊</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalReadings}</div>
            <p className="text-xs text-gray-500">In selected period</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Temperature</CardTitle>
            <span className="text-2xl">🌡️</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgTemperature}°C</div>
            <p className="text-xs text-gray-500">Average reading</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="temperature" className="space-y-4">
        <TabsList>
          <TabsTrigger value="temperature">Temperature</TabsTrigger>
          <TabsTrigger value="humidity">Humidity</TabsTrigger>
          <TabsTrigger value="pressure">Pressure</TabsTrigger>
          <TabsTrigger value="battery">Battery</TabsTrigger>
        </TabsList>
        
        <TabsContent value="temperature" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Temperature Readings</CardTitle>
              <CardDescription>Temperature data over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sensorData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="temperature" stroke="#8884d8" name="Temperature (°C)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="humidity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Humidity Readings</CardTitle>
              <CardDescription>Humidity data over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sensorData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="humidity" stroke="#82ca9d" name="Humidity (%)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="pressure" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pressure Readings</CardTitle>
              <CardDescription>Atmospheric pressure data over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sensorData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="pressure" stroke="#ffc658" name="Pressure (hPa)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="battery" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Battery Levels</CardTitle>
              <CardDescription>Device battery status over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sensorData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="battery" fill="#ff7300" name="Battery (%)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Device Status List */}
      <Card>
        <CardHeader>
          <CardTitle>Device Status</CardTitle>
          <CardDescription>Current status of all monitored devices</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {devices.map((device) => (
              <div key={device.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Badge variant={device.status === 'online' ? 'default' : 'destructive'}>
                    {device.status}
                  </Badge>
                  <div>
                    <p className="font-medium">{device.name}</p>
                    <p className="text-sm text-gray-500">{device.location}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <span>Battery: {device.battery}%</span>
                  <span>Updated: {format(new Date(device.updated_at), 'HH:mm')}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Monitoring;
