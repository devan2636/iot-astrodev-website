import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Bell, Info, Activity, Signal, Clock, Thermometer, Droplets, Gauge, Waves, TrendingUp, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { subDays, subHours } from 'date-fns';
import DevicePagination from './DevicePagination';
import ExcelReport from './ExcelReport';
import DeviceDetails from './DeviceDetails';

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
  last_seen?: string;
  sensor_data?: any;
  wifi_rssi?: number;
}

const Monitoring: React.FC = () => {
  const { toast } = useToast();
  const [devices, setDevices] = useState<(Device & Partial<DeviceStatus>)[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<string>('all');
  const [sensorData, setSensorData] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [alarmEvents, setAlarmEvents] = useState<AlarmEvent[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const eventsPerPage = 5;
  const [userRole, setUserRole] = useState<string>('user');
  const [selectedDeviceForDetails, setSelectedDeviceForDetails] = useState<Device & Partial<DeviceStatus> | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'online' | 'offline'>('all');
  const [filterType, setFilterType] = useState('all');
  const [uniqueDeviceTypes, setUniqueDeviceTypes] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch devices on mount and set up auto-refresh
  useEffect(() => {
    fetchDevices();
    fetchSensorData();
    const interval = setInterval(() => {
      fetchDevices();
      fetchSensorData();
    }, 30000); // Auto-refresh every 30 seconds

    return () => clearInterval(interval);
  }, [timeRange, selectedDevice]);

  // Fetch and format timestamp functions
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const formatDateTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('id-ID', { month: 'short', day: 'numeric' });
  };

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const { data: deviceList, error: deviceError } = await supabase
        .from('devices')
        .select('*');

      if (deviceError) throw deviceError;

      // Get unique device types
      const types = [...new Set(deviceList?.map(d => d.type) || [])];
      setUniqueDeviceTypes(types as string[]);

      const devicePromises = (deviceList || []).map(async (device) => {
        try {
          const { data: statusData, error: statusError } = await supabase
            .from('device_status')
            .select('*')
            .eq('device_id', device.id)
            .order('timestamp', { ascending: false })
            .limit(1)
            .single();

          if (statusError && statusError.code !== 'PGRST116') throw statusError;

          // Determine if device is online: recent data wins unless explicitly offline
          let currentStatus: 'online' | 'offline' = 'offline';
          if (statusData) {
            const lastUpdate = new Date(statusData.timestamp).getTime();
            const isRecent = (Date.now() - lastUpdate) <= (30 * 60 * 1000); // 30 minutes

            if (statusData.status === 'offline') {
              currentStatus = 'offline';
            } else if (isRecent) {
              // If recent, consider online even when status is null/missing
              currentStatus = 'online';
            } else {
              currentStatus = 'offline';
            }
          }

          let parsedSensorData: any = {};
          if (statusData?.sensor_data && typeof statusData.sensor_data === 'string') {
            try {
              parsedSensorData = JSON.parse(statusData.sensor_data);
            } catch (e) {
              parsedSensorData = statusData.sensor_data;
            }
          } else if (statusData?.sensor_data) {
            parsedSensorData = statusData.sensor_data;
          }

          return {
            ...device,
            wifi_rssi: statusData?.wifi_rssi,
            uptime: statusData?.uptime,
            free_heap: statusData?.free_heap,
            ota_update: statusData?.ota_update,
            status: currentStatus,
            battery: statusData?.battery !== undefined && statusData?.battery !== null ? statusData.battery : device.battery,
            last_seen: statusData?.timestamp,
            sensor_data: parsedSensorData,
            last_status_timestamp: statusData?.timestamp
          } as Device & Partial<DeviceStatus>;
        } catch (error) {
          console.error(`Error fetching status for device ${device.id}:`, error);
          return {
            ...device,
            status: 'offline' as const
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

  // Explicit refresh handler for the Refresh Data button
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchDevices(), fetchSensorData(), generateAlarmEvents()]);
      toast({ title: 'Refreshed', description: 'Monitoring data updated.' });
    } catch (error) {
      console.error('Error during manual refresh:', error);
      toast({ title: 'Error', description: 'Failed to refresh data', variant: 'destructive' });
    } finally {
      setRefreshing(false);
    }
  };

  // Format time ago for events/connections
  const formatTimeAgo = (timestamp: string) => {
    if (!timestamp) return 'Unknown';
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Baru saja';
    if (diffInMinutes < 60) return `${diffInMinutes} menit yang lalu`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} jam yang lalu`;
    return `${Math.floor(diffInMinutes / 1440)} hari yang lalu`;
  };

  const formatLastConnected = (timestamp: string) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleString('id-ID', {
      timeZone: 'UTC',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
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

  // Helper functions for device card display
  const getBatteryColor = (battery: number) => {
    if (battery >= 60) return 'text-green-600';
    if (battery >= 30) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getBatteryIcon = (battery: number) => {
    if (battery >= 60) return '🔋';
    if (battery >= 30) return '🪫';
    return '⚠️';
  };

  const getSignalColor = (rssi: number) => {
    if (rssi >= -60) return 'text-green-600';
    if (rssi >= -75) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSignalIcon = (rssi: number) => {
    if (rssi >= -60) return <Signal className="w-4 h-4" />;
    if (rssi >= -75) return <Signal className="w-4 h-4" />;
    return <Signal className="w-4 h-4" />;
  };

  const getSensorIcon = (sensorType: string) => {
    const t = (sensorType || '').toLowerCase();
    if (t.includes('temp')) return <Thermometer className="h-4 w-4 text-red-500" />;
    if (t.includes('humid')) return <Droplets className="h-4 w-4 text-blue-500" />;
    if (t.includes('press')) return <Gauge className="h-4 w-4 text-green-500" />;
    if (t.includes('tinggi') || t.includes('water') || t.includes('level')) return <Waves className="h-4 w-4 text-cyan-600" />;
    return <Activity className="h-4 w-4 text-gray-400" />;
  };

  const formatUptime = (seconds: number) => {
    if (!seconds) return 'N/A';
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (parts.length === 0) return `${Math.floor(seconds / 60)}m`;
    return parts.join(' ');
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return 'N/A';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const handleDeviceClick = (device: Device & Partial<DeviceStatus>) => {
    setSelectedDeviceForDetails(device);
    setIsDetailsOpen(true);
  };

  const handleEditDevice = (device: Device) => {
    // Implement edit functionality or navigate to edit page
    console.log('Edit device:', device);
  };

  // Filter devices based on search query and filters
  const getFilteredDevices = () => {
    return devices.filter(device => {
      const matchesSearch = 
        device.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        device.serial?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        device.mac?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        device.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        device.description?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = filterStatus === 'all' || device.status === filterStatus;
      const matchesType = filterType === 'all' || device.type === filterType;

      return matchesSearch && matchesStatus && matchesType;
    });
  };

  const filteredDevices = getFilteredDevices();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Monitoring</h1>
          <p className="text-gray-600">Monitor real-time sensor data and device performance</p>
        </div>
        <div className="flex gap-2">
          <ExcelReport devices={filteredDevices} />
          <Button onClick={handleRefresh} variant="outline" disabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh Data'}
          </Button>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white p-4 rounded-lg border space-y-4">
        {/* Search */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Search Device</label>
          <input
            type="text"
            placeholder="Cari berdasarkan nama, serial, MAC, lokasi..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filter Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Status Filter */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Status</label>
            <Select value={filterStatus} onValueChange={(value) => {
              setFilterStatus(value as 'all' | 'online' | 'offline');
              setCurrentPage(1);
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Type Filter */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Tipe Device</label>
            <Select value={filterType} onValueChange={(value) => {
              setFilterType(value);
              setCurrentPage(1);
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Tipe</SelectItem>
                {uniqueDeviceTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Devices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDevices.length > 0 ? (
          filteredDevices.map((device) => (
            <Card key={device.id} onClick={() => handleDeviceClick(device)} className="cursor-pointer hover:shadow-md transition">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-lg">{device.name}</CardTitle>
                  <CardDescription className="text-xs">{device.type}</CardDescription>
                </div>
                <Badge variant={device.status === 'online' ? 'default' : 'secondary'}>
                  {device.status}
                </Badge>
              </CardHeader>
              <CardContent className="text-sm text-gray-700 space-y-1">
                {device.location && <div>📍 {device.location}</div>}
                {device.battery !== undefined && device.battery !== null && (
                  <div>🔋 {device.battery}%</div>
                )}
                {device.wifi_rssi !== undefined && device.wifi_rssi !== null && (
                  <div>📶 {device.wifi_rssi} dBm</div>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full text-center py-12 text-gray-500">
            <Activity className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No devices registered yet</p>
          </div>
        )}
      </div>

      {/* Device Details Modal */}

      {/* Device Details Modal */}
      {selectedDeviceForDetails && (
        <DeviceDetails
          device={selectedDeviceForDetails}
          open={isDetailsOpen}
          onOpenChange={setIsDetailsOpen}
          onEdit={handleEditDevice}
        />
      )}

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
