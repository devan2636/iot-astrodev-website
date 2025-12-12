import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Bell, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { subDays, subHours } from 'date-fns';
import DevicePagination from './DevicePagination';
import ExcelReport from './ExcelReport';

interface DeviceStatus {
  id: string;
  device_id: string;
  status: 'online' | 'offline';
  battery: number;
  wifi_rssi: number;
  uptime: number;
  free_heap: number;
  ota_update: string | null;
  timestamp: string;
  created_at: string;
  sensor_data?: {
    temperature?: number;
    humidity?: number;
    pressure?: number;
  };
}

interface AlarmEvent {
  id: string;
  type: 'warning' | 'error' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: string;
  device_name: string;
}

interface Device {
  id: string;
  name: string;
  description: string;
  type: string;
  location: string;
  status: 'online' | 'offline';
  battery: number;
  mac: string;
  serial: string;
  created_at: string;
  updated_at: string;
}

const Monitoring = () => {
  const [devices, setDevices] = useState<(Device & Partial<DeviceStatus>)[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('user');
  const [selectedDevice, setSelectedDevice] = useState('all');
  const [timeRange, setTimeRange] = useState('24h');
  const [sensorData, setSensorData] = useState<any[]>([]);
  const [alarmEvents, setAlarmEvents] = useState<AlarmEvent[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [eventsPerPage] = useState(5);
  const { toast } = useToast();

  useEffect(() => {
    fetchUserRole();
    fetchDevices();

    // Subscribe to real-time updates from Communication Protocols
    const channel = supabase.channel('mqtt-status-updates')
      .on('broadcast', { event: 'device-status-update' }, (payload) => {
        const { device_id, status, battery, wifi_rssi, uptime, free_heap } = payload.payload;
        
          setDevices(prevDevices => {
            return prevDevices.map(device => {
              if (device.id === device_id) {
                return {
                  ...device,
                  status: status || device.status,
                  battery: battery !== undefined && battery !== null ? battery : device.battery,
                  wifi_rssi: wifi_rssi !== undefined && wifi_rssi !== null ? wifi_rssi : device.wifi_rssi,
                  uptime: uptime !== undefined && uptime !== null ? uptime : device.uptime,
                  free_heap: free_heap !== undefined && free_heap !== null ? free_heap : device.free_heap,
                  updated_at: new Date().toISOString()
                };
              }
              return device;
            });
          });
      })
      .subscribe();

    // Set up interval to check device status every minute
    const statusCheckInterval = setInterval(() => {
      console.log('Checking device status automatically...');
      fetchDevices();
    }, 60000); // 60 seconds = 1 minute

    return () => {
      supabase.removeChannel(channel);
      clearInterval(statusCheckInterval);
    };
  }, []);

  useEffect(() => {
    if (devices.length > 0 || selectedDevice === 'all') {
      fetchSensorData();
    }
  }, [selectedDevice, timeRange, devices]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta'
    });
  };

  const formatDateTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      timeZone: 'Asia/Jakarta'
    });
  };

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
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      console.log('Fetching devices for user:', user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const userRole = profile?.role || 'user';
      console.log('User role:', userRole);

      let deviceList: any[] = [];
      if (userRole === 'superadmin' || userRole === 'admin') {
        // Admin and superadmin can see all devices
        const { data: allDevices, error } = await supabase
          .from('devices')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        deviceList = allDevices || [];
        console.log('Admin/Superadmin devices:', deviceList);
      } else {
        // Regular users can only see devices they have access to
        const { data: accessData, error } = await supabase
          .from('user_device_access')
          .select(`
            devices!user_device_access_device_id_fkey(*)
          `)
          .eq('user_id', user.id);

        if (error) {
          console.error('Error fetching user device access:', error);
          throw error;
        }

        console.log('User device access data:', accessData);
        deviceList = accessData?.map(access => access.devices).filter(device => device !== null) || [];
        console.log('User accessible devices:', deviceList);
      }

      // Get latest status for each device and determine online/offline status
          const devicePromises = deviceList.map(async (device: Device) => {
            try {
              const { data: statusData } = await supabase
                .from('device_status')
                .select('wifi_rssi, uptime, free_heap, ota_update, status, battery, timestamp, sensor_data')
                .eq('device_id', device.id)
                .order('timestamp', { ascending: false })
                .limit(1)
                .maybeSingle();

              // Determine online/offline status based on last data timestamp
              let currentStatus: 'online' | 'offline' = 'offline';
              if (statusData && statusData.timestamp) {
                const lastDataTime = new Date(statusData.timestamp);
                const currentTime = new Date();
                const timeDifference = currentTime.getTime() - lastDataTime.getTime();
const fiveMinutesInMs = 5 * 60 * 1000; // 5 minutes in milliseconds
                
// If last data was received within 5 minutes, device is online
// This gives more buffer time for device communication
if (timeDifference <= fiveMinutesInMs) {
  currentStatus = 'online';
}
              }

              console.log(`Device ${device.name}: Last seen ${statusData?.timestamp}, Status: ${currentStatus}`);

              return {
                ...device,
                wifi_rssi: statusData?.wifi_rssi,
                uptime: statusData?.uptime,
                free_heap: statusData?.free_heap,
                ota_update: statusData?.ota_update,
                status: currentStatus,
                battery: statusData?.battery !== undefined && statusData?.battery !== null ? statusData.battery : device.battery,
                last_seen: statusData?.timestamp
              } as Device & Partial<DeviceStatus>;
            } catch (error) {
              console.error(`Error fetching status for device ${device.id}:`, error);
              return {
                ...device,
                status: 'offline' as 'offline'
              } as Device & Partial<DeviceStatus>;
            }
          });

      const devicesWithStatus = await Promise.all(devicePromises);
      setDevices(devicesWithStatus);
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

  const generateAlarmEvents = async () => {
    try {
      const { data: readings, error: readingsError } = await supabase
        .from('device_status')
        .select(`
          *,
          devices(name)
        `)
        .order('timestamp', { ascending: false })
        .limit(50);

      if (readingsError) throw readingsError;

      const events: AlarmEvent[] = [];
      
      readings?.forEach((reading) => {
        // Battery alerts
        if (reading.battery !== null) {
          if (reading.battery < 10) {
            events.push({
              id: `${reading.id}-battery-critical`,
              type: 'error',
              title: 'Battery Critical',
              message: `Device battery level critically low: ${reading.battery}%`,
              timestamp: reading.timestamp,
              device_name: (reading as any).devices?.name || 'Unknown Device'
            });
          } else if (reading.battery < 20) {
            events.push({
              id: `${reading.id}-battery-low`,
              type: 'warning',
              title: 'Low Battery Warning',
              message: `Device battery level: ${reading.battery}%`,
              timestamp: reading.timestamp,
              device_name: (reading as any).devices?.name || 'Unknown Device'
            });
          }
        }

        // WiFi signal alerts
        if (reading.wifi_rssi !== null) {
          if (reading.wifi_rssi < -80) {
            events.push({
              id: `${reading.id}-wifi-weak`,
              type: 'warning',
              title: 'Weak WiFi Signal',
              message: `WiFi signal strength is weak: ${reading.wifi_rssi} dBm`,
              timestamp: reading.timestamp,
              device_name: (reading as any).devices?.name || 'Unknown Device'
            });
          }
        }

        // Memory alerts
        if (reading.free_heap !== null) {
          const freeHeapKB = Math.floor(reading.free_heap / 1024);
          if (freeHeapKB < 10) {
            events.push({
              id: `${reading.id}-memory-low`,
              type: 'warning',
              title: 'Low Memory Warning',
              message: `Device memory is running low: ${freeHeapKB} KB free`,
              timestamp: reading.timestamp,
              device_name: (reading as any).devices?.name || 'Unknown Device'
            });
          }
        }

        // Sensor data alerts - General sensor monitoring
        if (reading.sensor_data && typeof reading.sensor_data === 'object') {
          Object.entries(reading.sensor_data).forEach(([sensorType, value]) => {
            if (typeof value === 'number') {
              // General sensor threshold checking
              // You can customize these thresholds based on your sensor requirements
              let isWarning = false;
              let isCritical = false;
              let unit = '';
              let warningRange = '';
              let criticalRange = '';

              // Define thresholds for common sensor types
              switch (sensorType.toLowerCase()) {
                case 'temperature':
                  unit = '°C';
                  isCritical = value <= 5 || value >= 40;
                  isWarning = !isCritical && (value <= 10 || value >= 35);
                  warningRange = '10-35°C';
                  criticalRange = '5-40°C';
                  break;
                case 'humidity':
                  unit = '%';
                  isCritical = value <= 20 || value >= 80;
                  isWarning = !isCritical && (value <= 30 || value >= 70);
                  warningRange = '30-70%';
                  criticalRange = '20-80%';
                  break;
                case 'pressure':
                  unit = ' hPa';
                  isCritical = value <= 970 || value >= 1040;
                  isWarning = !isCritical && (value <= 980 || value >= 1030);
                  warningRange = '980-1030 hPa';
                  criticalRange = '970-1040 hPa';
                  break;
                default:
                  // For other sensor types, use generic thresholds
                  // You can customize these based on your specific sensors
                  unit = '';
                  isCritical = value <= 0 || value >= 100;
                  isWarning = !isCritical && (value <= 10 || value >= 90);
                  warningRange = '10-90';
                  criticalRange = '0-100';
              }

              if (isCritical) {
                events.push({
                  id: `${reading.id}-${sensorType}-critical`,
                  type: 'error',
                  title: `${sensorType.charAt(0).toUpperCase() + sensorType.slice(1)} Critical`,
                  message: `${sensorType.charAt(0).toUpperCase() + sensorType.slice(1)} is ${value}${unit} (Outside safe range: ${criticalRange})`,
                  timestamp: reading.timestamp,
                  device_name: (reading as any).devices?.name || 'Unknown Device'
                });
              } else if (isWarning) {
                events.push({
                  id: `${reading.id}-${sensorType}-warning`,
                  type: 'warning',
                  title: `${sensorType.charAt(0).toUpperCase() + sensorType.slice(1)} Warning`,
                  message: `${sensorType.charAt(0).toUpperCase() + sensorType.slice(1)} is ${value}${unit} (Outside optimal range: ${warningRange})`,
                  timestamp: reading.timestamp,
                  device_name: (reading as any).devices?.name || 'Unknown Device'
                });
              }
            }
          });
        }

        // Device status alerts
        if (reading.status === 'online') {
          events.push({
            id: `${reading.id}-status-online`,
            type: 'success',
            title: 'Device Connected',
            message: `Device is online and sending data`,
            timestamp: reading.timestamp,
            device_name: (reading as any).devices?.name || 'Unknown Device'
          });
        }
      });

      // Sort events by timestamp and remove duplicates
      const uniqueEvents = events
        .filter((event, index, self) =>
          index === self.findIndex(e => e.id === event.id)
        )
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setAlarmEvents(uniqueEvents);
    } catch (error) {
      console.error('Error generating alarm events:', error);
    }
  };

  const fetchSensorData = async () => {
    try {
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

      // Fetch device status data for charts
      let statusQuery = supabase
        .from('device_status')
        .select('*')
        .gte('timestamp', startTime.toISOString())
        .order('timestamp', { ascending: true });

      // Filter by device if specific device is selected
      if (selectedDevice !== 'all') {
        statusQuery = statusQuery.eq('device_id', selectedDevice);
      } else {
        // Filter by accessible devices for regular users
        if (userRole !== 'superadmin' && userRole !== 'admin') {
          const deviceIds = devices.map(d => d.id);
          if (deviceIds.length > 0) {
            statusQuery = statusQuery.in('device_id', deviceIds);
          }
        }
      }

      const { data: statusData, error: statusError } = await statusQuery;

      if (statusError) throw statusError;

      // Process data for charts with proper time formatting using locale
      const processedData = statusData?.map(reading => ({
        timestamp: reading.timestamp,
        time: timeRange === '7d' || timeRange === '30d' 
          ? formatDateTimestamp(reading.timestamp)
          : formatTimestamp(reading.timestamp),
        battery: reading.battery,
        wifi_rssi: reading.wifi_rssi,
        device_id: reading.device_id
      })) || [];

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

  // Format time ago for events
  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Baru saja';
    if (diffInMinutes < 60) return `${diffInMinutes} menit yang lalu`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} jam yang lalu`;
    return `${Math.floor(diffInMinutes / 1440)} hari yang lalu`;
  };

  // Get event icon based on type
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      case 'info': return 'ℹ️';
      default: return '📄';
    }
  };

  // Get event background color based on type
  const getEventBgColor = (type: string) => {
    switch (type) {
      case 'success': return 'bg-green-50';
      case 'warning': return 'bg-yellow-50';
      case 'error': return 'bg-red-50';
      case 'info': return 'bg-blue-50';
      default: return 'bg-gray-50';
    }
  };

  // Calculate pagination
  const indexOfLastEvent = currentPage * eventsPerPage;
  const indexOfFirstEvent = indexOfLastEvent - eventsPerPage;
  const currentEvents = alarmEvents.slice(indexOfFirstEvent, indexOfLastEvent);
  const totalPages = Math.ceil(alarmEvents.length / eventsPerPage);

  // useEffect for generating alarm events
  useEffect(() => {
    generateAlarmEvents();
    const interval = setInterval(generateAlarmEvents, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [devices]);

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
          <ExcelReport devices={devices} />
          <Button onClick={() => { fetchDevices(); fetchSensorData(); }} variant="outline">
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

      {/* Device Status Information */}
      <Card>
        <CardHeader>
          <CardTitle>Device Status Information</CardTitle>
          <CardDescription>Real-time status monitoring dari Communication Protocols</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.map((device) => (
              <div key={device.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium">{device.name}</h3>
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Battery Level:</span>
                    <span className="font-medium">{device.battery !== undefined && device.battery !== null ? device.battery : 0}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>WiFi Signal:</span>
                    <span className="font-medium">{device.wifi_rssi !== undefined && device.wifi_rssi !== null ? device.wifi_rssi : 'N/A'} dBm</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Uptime:</span>
                    <span className="font-medium">{device.uptime !== undefined && device.uptime !== null ? `${Math.floor(device.uptime / 3600)}h ${Math.floor((device.uptime % 3600) / 60)}m` : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Free Memory:</span>
                    <span className="font-medium">{device.free_heap !== undefined && device.free_heap !== null ? `${Math.floor(device.free_heap / 1024)} KB` : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>OTA Status:</span>
                    <span className="font-medium">{device.ota_update !== undefined && device.ota_update !== null ? device.ota_update : 'N/A'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Device Status Charts */}
      <Tabs defaultValue="battery">
        <div className="space-y-4">
          <TabsList>
            <TabsTrigger value="battery">Battery Levels</TabsTrigger>
            <TabsTrigger value="rssi">WiFi Signal (RSSI)</TabsTrigger>
          </TabsList>
        
          <TabsContent value="battery" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Battery Levels</CardTitle>
                <CardDescription>Device battery status over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sensorData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip 
                        labelFormatter={(label) => {
                          const matchingData = sensorData.find(item => item.time === label);
                          return matchingData ? formatTimestamp(matchingData.timestamp) : label;
                        }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="battery" 
                        stroke="#ff7300" 
                        name="Battery (%)"
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rssi" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>WiFi Signal Strength (RSSI)</CardTitle>
                <CardDescription>Device WiFi signal strength over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sensorData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis domain={[-100, 0]} />
                      <Tooltip 
                        labelFormatter={(label) => {
                          const matchingData = sensorData.find(item => item.time === label);
                          return matchingData ? formatTimestamp(matchingData.timestamp) : label;
                        }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="wifi_rssi" 
                        stroke="#8884d8" 
                        name="RSSI (dBm)"
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>

      {/* Recent Events Parameters Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            Recent Events Parameters
          </CardTitle>
          <CardDescription>Parameter dan threshold untuk event monitoring</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h3 className="font-medium flex items-center gap-2">
                  <span className="text-xl">❌</span> Battery Critical (Error)
                </h3>
                <p className="text-sm text-gray-600">Triggered when battery level falls below 10%</p>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium flex items-center gap-2">
                  <span className="text-xl">⚠️</span> Low Battery Warning
                </h3>
                <p className="text-sm text-gray-600">Triggered when battery level falls below 20%</p>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium flex items-center gap-2">
                  <span className="text-xl">⚠️</span> Weak WiFi Signal
                </h3>
                <p className="text-sm text-gray-600">Triggered when WiFi RSSI falls below -80 dBm</p>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium flex items-center gap-2">
                  <span className="text-xl">⚠️</span> Low Memory Warning
                </h3>
                <p className="text-sm text-gray-600">Triggered when free memory falls below 10 KB</p>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium flex items-center gap-2">
                  <span className="text-xl">✅</span> Device Connected
                </h3>
                <p className="text-sm text-gray-600">Triggered when device comes online and sends data</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <h3 className="font-medium mb-3">Sensor Monitoring:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h3 className="font-medium flex items-center gap-2">
                    <span className="text-xl">🌡️</span> General Sensor Alerts
                  </h3>
                  <p className="text-sm text-gray-600">System monitors all sensor data automatically</p>
                  <p className="text-sm text-gray-600">Alerts generated based on configurable thresholds</p>
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium flex items-center gap-2">
                    <span className="text-xl">📊</span> Supported Sensor Types
                  </h3>
                  <p className="text-sm text-gray-600">Temperature, Humidity, Pressure, and more</p>
                  <p className="text-sm text-gray-600">Custom sensors with dynamic threshold detection</p>
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium flex items-center gap-2">
                    <span className="text-xl">⚙️</span> Threshold Configuration
                  </h3>
                  <p className="text-sm text-gray-600">Warning and Critical levels for each sensor type</p>
                  <p className="text-sm text-gray-600">Customizable ranges based on sensor requirements</p>
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium flex items-center gap-2">
                    <span className="text-xl">🔔</span> Real-time Notifications
                  </h3>
                  <p className="text-sm text-gray-600">Instant alerts when values exceed safe ranges</p>
                  <p className="text-sm text-gray-600">Automatic event logging and history tracking</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
          {currentEvents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No recent events to display</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-3">
                {currentEvents.map((event) => (
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
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="flex items-center px-3 text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Monitoring;
