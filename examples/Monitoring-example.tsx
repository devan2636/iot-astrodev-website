import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Download, Bell, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';

interface Device {
  id: string;
  name: string;
  location: string;
  status: string;
}

interface Sensor {
  id: string;
  device_id: string;
  name: string;
  type: string;
  unit: string;
  min_value: number | null;
  max_value: number | null;
  is_active: boolean;
}

interface SensorReading {
  id: string;
  device_id: string;
  temperature: number | null;
  humidity: number | null;
  pressure: number | null;
  battery: number | null;
  timestamp: string;
}

interface AlarmEvent {
  id: string;
  type: 'warning' | 'error' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: string;
  device_name: string;
}

interface GraphData {
  id: string;
  deviceId: string;
  deviceName: string;
  sensorId: string;
  sensorName: string;
  sensorType: string;
  sensorUnit: string;
  timeRange: string;
  data: Array<{
    timestamp: string;
    value: number;
    formattedTime: string;
  }>;
}

const Monitoring = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [selectedSensor, setSelectedSensor] = useState('');
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');
  const [isAddGraphOpen, setIsAddGraphOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [currentReadings, setCurrentReadings] = useState<SensorReading | null>(null);
  const [alarmEvents, setAlarmEvents] = useState<AlarmEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [graphs, setGraphs] = useState<GraphData[]>([]);

  const { toast } = useToast();

  const timeRanges = [
    { value: '1h', label: 'Last 1 Hour' },
    { value: '6h', label: 'Last 6 Hours' },
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
  ];

  useEffect(() => {
    fetchDevices();
    fetchSensors();
    fetchCurrentReadings();
    generateAlarmEvents();
  }, []);

  useEffect(() => {
    if (selectedDevice) {
      fetchCurrentReadings();
    }
  }, [selectedDevice]);

  // Di dalam komponen Monitoring, di bagian atas bersama state lainnya
  useEffect(() => {
    console.log('Monitoring.tsx: startDate changed to:', startDate);
  }, [startDate]);

  useEffect(() => {
    console.log('Monitoring.tsx: endDate changed to:', endDate);
  }, [endDate]);

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
      toast({
        title: "Error",
        description: "Failed to fetch devices",
        variant: "destructive",
      });
    }
  };

  const fetchSensors = async () => {
    try {
      const { data, error } = await supabase
        .from('sensors')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setSensors(data || []);
    } catch (error) {
      console.error('Error fetching sensors:', error);
    }
  };

  const fetchCurrentReadings = async () => {
    if (!selectedDevice) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sensor_readings')
        .select('*')
        .eq('device_id', selectedDevice)
        .order('timestamp', { ascending: false })
        .limit(1);

      if (error) throw error;
      setCurrentReadings(data && data.length > 0 ? data[0] : null);
    } catch (error) {
      console.error('Error fetching readings:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateAlarmEvents = async () => {
    try {
      const { data: readings, error: readingsError } = await supabase
        .from('sensor_readings')
        .select(`
          *,
          devices(name)
        `)
        .order('timestamp', { ascending: false })
        .limit(50);

      if (readingsError) throw readingsError;

      const { data: sensorsData, error: sensorsError } = await supabase
        .from('sensors')
        .select('*');

      if (sensorsError) throw sensorsError;

      const events: AlarmEvent[] = [];
      
      readings?.forEach((reading) => {
        const deviceSensors = sensorsData?.filter(s => s.device_id === reading.device_id) || [];
        
        deviceSensors.forEach((sensor) => {
          let value: number | null = null;
          
          switch (sensor.type.toLowerCase()) {
            case 'temperature':
              value = reading.temperature;
              break;
            case 'humidity':
              value = reading.humidity;
              break;
            case 'pressure':
              value = reading.pressure;
              break;
          }

          if (value !== null) {
            if (sensor.max_value && value > sensor.max_value) {
              events.push({
                id: `${reading.id}-${sensor.id}-max`,
                type: 'warning',
                title: `${sensor.type} Threshold Exceeded`,
                message: `${sensor.name} reached ${value}${sensor.unit} (max: ${sensor.max_value}${sensor.unit})`,
                timestamp: reading.timestamp,
                device_name: (reading as any).devices?.name || 'Unknown Device'
              });
            }
            
            if (sensor.min_value && value < sensor.min_value) {
              events.push({
                id: `${reading.id}-${sensor.id}-min`,
                type: 'warning',
                title: `${sensor.type} Below Minimum`,
                message: `${sensor.name} dropped to ${value}${sensor.unit} (min: ${sensor.min_value}${sensor.unit})`,
                timestamp: reading.timestamp,
                device_name: (reading as any).devices?.name || 'Unknown Device'
              });
            }
          }
        });

        if (reading.battery !== null && reading.battery < 20) {
          events.push({
            id: `${reading.id}-battery`,
            type: reading.battery < 10 ? 'error' : 'warning',
            title: 'Low Battery Warning',
            message: `Device battery level: ${reading.battery}%`,
            timestamp: reading.timestamp,
            device_name: (reading as any).devices?.name || 'Unknown Device'
          });
        }

        const deviceInfo = devices.find(d => d.id === reading.device_id);
        if (deviceInfo?.status === 'online') {
          const recentTime = new Date(Date.now() - 10 * 60 * 1000);
          const readingTime = new Date(reading.timestamp);
          
          if (readingTime > recentTime) {
            events.push({
              id: `${reading.id}-connected`,
              type: 'success',
              title: 'Device Connected',
              message: `${deviceInfo.name} is sending data`,
              timestamp: reading.timestamp,
              device_name: deviceInfo.name
            });
          }
        }
      });

      const uniqueEvents = events.filter((event, index, self) =>
        index === self.findIndex(e => e.id === event.id)
      ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setAlarmEvents(uniqueEvents.slice(0, 10));
    } catch (error) {
      console.error('Error generating alarm events:', error);
    }
  };

  const getDeviceSensors = () => {
    return sensors.filter(sensor => sensor.device_id === selectedDevice);
  };

  const handleCreateGraph = async () => {
    if (!selectedDevice || !selectedSensor) {
      toast({
        title: "Error",
        description: "Please select both device and sensor",
        variant: "destructive",
      });
      return;
    }

    try {
      const device = devices.find(d => d.id === selectedDevice);
      const sensor = sensors.find(s => s.id === selectedSensor);
      
      if (!device || !sensor) return;

      // Calculate time range
      const now = new Date();
      let startTime = new Date();
      
      switch (selectedTimeRange) {
        case '1h':
          startTime.setHours(now.getHours() - 1);
          break;
        case '6h':
          startTime.setHours(now.getHours() - 6);
          break;
        case '24h':
          startTime.setDate(now.getDate() - 1);
          break;
        case '7d':
          startTime.setDate(now.getDate() - 7);
          break;
      }

      // Fetch sensor data
      const { data: readings, error } = await supabase
        .from('sensor_readings')
        .select('*')
        .eq('device_id', selectedDevice)
        .gte('timestamp', startTime.toISOString())
        .order('timestamp', { ascending: true });

      if (error) throw error;

      // Prepare chart data
      const chartData = readings?.map(reading => {
        let value = 0;
        switch (sensor.type.toLowerCase()) {
          case 'temperature':
            value = reading.temperature || 0;
            break;
          case 'humidity':
            value = reading.humidity || 0;
            break;
          case 'pressure':
            value = reading.pressure || 0;
            break;
          case 'battery':
            value = reading.battery || 0;
            break;
        }

        return {
          timestamp: reading.timestamp,
          value,
          formattedTime: format(new Date(reading.timestamp), 'HH:mm')
        };
      }) || [];

      const newGraph: GraphData = {
        id: `graph-${Date.now()}`,
        deviceId: selectedDevice,
        deviceName: device.name,
        sensorId: selectedSensor,
        sensorName: sensor.name,
        sensorType: sensor.type,
        sensorUnit: sensor.unit,
        timeRange: selectedTimeRange,
        data: chartData
      };

      setGraphs(prev => [...prev, newGraph]);
      setIsAddGraphOpen(false);
      setSelectedSensor('');

      toast({
        title: "Success",
        description: "Graph created successfully",
      });
    } catch (error) {
      console.error('Error creating graph:', error);
      toast({
        title: "Error",
        description: "Failed to create graph",
        variant: "destructive",
      });
    }
  };

  const handleRemoveGraph = (graphId: string) => {
    setGraphs(prev => prev.filter(g => g.id !== graphId));
  };

  const handleExportReport = async () => {
    if (!startDate || !endDate || !selectedDevice) {
      toast({
        title: "Error",
        description: "Please select device and date range",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('sensor_readings')
        .select(`
          *,
          devices(name)
        `)
        .eq('device_id', selectedDevice)
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .order('timestamp', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        toast({
          title: "No Data",
          description: "No sensor data found for the selected period",
          variant: "destructive",
        });
        return;
      }

      const headers = ['Timestamp', 'Device', 'Temperature (°C)', 'Humidity (%)', 'Pressure (Pa)', 'Battery (%)'];
      const csvContent = [
        headers.join(','),
        ...data.map(row => [
          new Date(row.timestamp).toLocaleString(),
          (row as any).devices?.name || 'Unknown',
          row.temperature || '',
          row.humidity || '',
          row.pressure || '',
          row.battery || ''
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sensor-report-${format(startDate, 'yyyy-MM-dd')}-${format(endDate, 'yyyy-MM-dd')}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);

      setIsExportOpen(false);
      toast({
        title: "Export Successful",
        description: "Sensor data has been exported to CSV",
      });
    } catch (error) {
      console.error('Error exporting data:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export sensor data",
        variant: "destructive",
      });
    }
  };

  const currentDevice = devices.find(d => d.id === selectedDevice);
  const deviceSensors = getDeviceSensors();

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      case 'info': return 'ℹ️';
      default: return '📄';
    }
  };

  const getEventBgColor = (type: string) => {
    switch (type) {
      case 'success': return 'bg-green-50';
      case 'warning': return 'bg-yellow-50';
      case 'error': return 'bg-red-50';
      case 'info': return 'bg-blue-50';
      default: return 'bg-gray-50';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Baru saja';
    if (diffInMinutes < 60) return `${diffInMinutes} menit yang lalu`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} jam yang lalu`;
    return `${Math.floor(diffInMinutes / 1440)} hari yang lalu`;
  };

  const chartConfig = {
    value: {
      label: "Value",
      color: "hsl(var(--chart-1))",
    },
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Monitoring</h1>
          <p className="text-gray-600">Monitor data IoT device secara real-time</p>
        </div>
        
        <div className="flex space-x-2">
          <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="bg-green-600 hover:bg-green-700 text-white">
                <Download className="w-4 h-4 mr-2" />
                Export Data
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Export Sensor Data</DialogTitle>
                <DialogDescription>
                  Export sensor data for a specific time period
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Device</label>
                  <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                    <SelectTrigger>
                      <SelectValue />
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
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Start Date</label>
                    <Popover modal={false}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !startDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {startDate ? format(startDate, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={(date) => {
                            console.log('Calendar onSelect for startDate, date:', date); // <-- TAMBAHKAN INI
                            setStartDate(date);
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">End Date</label>
                    <Popover modal={false}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !endDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={(date) => {
                            console.log('Calendar onSelect for endDate, date:', date); // <-- TAMBAHKAN INI
                            setEndDate(date);
                            }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                
                <Button onClick={handleExportReport} className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV Report
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddGraphOpen} onOpenChange={setIsAddGraphOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                + Add Graph
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Device Graph</DialogTitle>
                <DialogDescription>
                  Create a new graph to monitor device data
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Device</label>
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
                  <label className="text-sm font-medium">Select Sensor</label>
                  <Select value={selectedSensor} onValueChange={setSelectedSensor}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a sensor" />
                    </SelectTrigger>
                    <SelectContent>
                      {deviceSensors.map((sensor) => (
                        <SelectItem key={sensor.id} value={sensor.id}>
                          {sensor.name} ({sensor.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Time Range</label>
                  <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timeRanges.map((range) => (
                        <SelectItem key={range.value} value={range.value}>
                          {range.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <Button onClick={handleCreateGraph} className="w-full">
                  Create Graph
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="space-y-2">
          <label className="text-sm font-medium">Device</label>
          <Select value={selectedDevice} onValueChange={setSelectedDevice}>
            <SelectTrigger className="w-64">
              <SelectValue />
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
          <label className="text-sm font-medium">Time Range</label>
          <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timeRanges.map((range) => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Current Values */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Temperature</CardTitle>
            <span className="text-2xl">🌡️</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : currentReadings?.temperature ? `${currentReadings.temperature}°C` : 'N/A'}
            </div>
            <p className="text-xs text-gray-500">Current reading</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Humidity</CardTitle>
            <span className="text-2xl">💧</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : currentReadings?.humidity ? `${currentReadings.humidity}%` : 'N/A'}
            </div>
            <p className="text-xs text-gray-500">Current reading</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pressure</CardTitle>
            <span className="text-2xl">🌪️</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : currentReadings?.pressure ? `${currentReadings.pressure} Pa` : 'N/A'}
            </div>
            <p className="text-xs text-gray-500">Current reading</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Battery</CardTitle>
            <span className="text-2xl">🔋</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : currentReadings?.battery ? `${currentReadings.battery}%` : 'N/A'}
            </div>
            <p className="text-xs text-gray-500">
              {currentReadings?.battery && currentReadings.battery < 20 ? 'Low battery' : 'Good condition'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Graphs */}
      {graphs.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">📊</span>
              </div>
              <h3 className="text-lg font-medium mb-2">No graphs added yet</h3>
              <p className="text-gray-500 mb-4">Add a graph to start monitoring your IoT device data in real-time. Select a device, sensor, and time range to visualize the data.</p>
              <Button onClick={() => setIsAddGraphOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                Add Your First Graph
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {graphs.map((graph) => (
            <Card key={graph.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{graph.sensorName}</CardTitle>
                    <CardDescription>
                      {graph.deviceName} • {graph.timeRange} • {graph.sensorType}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveGraph(graph.id)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={graph.data}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="formattedTime" 
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `${value}${graph.sensorUnit}`}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value) => [`${value}${graph.sensorUnit}`, graph.sensorType]}
                          />
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="var(--color-value)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Recent Events
          </CardTitle>
          <CardDescription>Log aktivitas dan alert terbaru dari sensor</CardDescription>
        </CardHeader>
        <CardContent>
          {alarmEvents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No recent events to display</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alarmEvents.map((event) => (
                <div key={event.id} className={`flex items-center space-x-4 p-3 rounded-lg ${getEventBgColor(event.type)}`}>
                  <span className="text-xl">{getEventIcon(event.type)}</span>
                  <div className="flex-1">
                    <p className="font-medium">{event.title}</p>
                    <p className="text-sm text-gray-600">{event.message}</p>
                    <p className="text-xs text-gray-500 mt-1">Device: {event.device_name}</p>
                  </div>
                  <span className="text-xs text-gray-500">{formatTimeAgo(event.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Monitoring;
