import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import DeviceMap from './DeviceMap';
import ErrorBoundary from './ErrorBoundary';
import SensorChart from './SensorChart';
import DevicePagination from './DevicePagination';

const Dashboard = () => {
  const [devices, setDevices] = useState([]);
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentReadings, setCurrentReadings] = useState(null);
  const [userRole, setUserRole] = useState('user');
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [showChart, setShowChart] = useState(false);
  
  // Pagination states
  const [sensorCurrentPage, setSensorCurrentPage] = useState(1);
  const [deviceCurrentPage, setDeviceCurrentPage] = useState(1);
  const sensorsPerPage = 6;
  const devicesPerPage = 4;
  
  const [stats, setStats] = useState([
    { title: 'Accessible Devices', value: '0', change: '+0 dari jam terakhir', color: 'text-green-600' },
    { title: 'Online Devices', value: '0', change: '+0 dari jam terakhir', color: 'text-blue-600' },
    { title: 'Active Sensors', value: '0', change: '+0 dari jam terakhir', color: 'text-purple-600' },
    { title: 'Recent Readings', value: '0', change: '+0 dari jam terakhir', color: 'text-orange-600' },
  ]);

  // Calculate pagination for sensors
  const sensorTotalPages = Math.ceil(sensors.length / sensorsPerPage);
  const sensorStartIndex = (sensorCurrentPage - 1) * sensorsPerPage;
  const sensorEndIndex = sensorStartIndex + sensorsPerPage;
  const currentSensors = sensors.slice(sensorStartIndex, sensorEndIndex);

  // Calculate pagination for devices
  const deviceTotalPages = Math.ceil(devices.length / devicesPerPage);
  const deviceStartIndex = (deviceCurrentPage - 1) * devicesPerPage;
  const deviceEndIndex = deviceStartIndex + devicesPerPage;
  const currentDevices = devices.slice(deviceStartIndex, deviceEndIndex);

  useEffect(() => {
    fetchUserRole();
    fetchDevices();
    fetchSensors();
    fetchLatestReadings();
  }, []);

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

      let data;
      if (userRole === 'superadmin' || userRole === 'admin') {
        // Admin and superadmin can see all devices
        const { data: allDevices, error } = await supabase
          .from('devices')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        data = allDevices;
        console.log('Admin/Superadmin devices:', data);
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
        data = accessData?.map(access => access.devices).filter(device => device !== null) || [];
        console.log('User accessible devices:', data);
      }
      
      setDevices(data || []);
      
      // Update stats based on device data
      const onlineCount = data?.filter(d => d.status === 'online').length || 0;
      const totalCount = data?.length || 0;
      
      setStats(prev => [
        { 
          title: 'Accessible Devices', 
          value: totalCount.toString(), 
          change: '+0 dari jam terakhir', 
          color: 'text-green-600' 
        },
        { 
          title: 'Online Devices', 
          value: onlineCount.toString(), 
          change: '+0 dari jam terakhir', 
          color: 'text-blue-600' 
        },
        { 
          title: 'Active Sensors', 
          value: (data?.length || 0).toString(), 
          change: '+0 dari jam terakhir', 
          color: 'text-purple-600' 
        },
        { 
          title: 'Recent Readings', 
          value: (onlineCount * 24).toString(), 
          change: '+24 dari jam terakhir', 
          color: 'text-orange-600' 
        },
      ]);
    } catch (error) {
      console.error('Error fetching devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSensors = async () => {
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
        // Admin and superadmin can see all sensors
        const { data: allSensors, error } = await supabase
          .from('sensors')
          .select(`
            *,
            devices(name, location)
          `)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (error) throw error;
        data = allSensors;
      } else {
        // Regular users can only see sensors from devices they have access to
        const { data: accessData, error: devicesError } = await supabase
          .from('user_device_access')
          .select('device_id')
          .eq('user_id', user.id);

        if (devicesError) {
          console.error('Error fetching accessible devices for sensors:', devicesError);
          throw devicesError;
        }

        const deviceIds = accessData?.map(access => access.device_id) || [];
        console.log('Device IDs for sensor fetch:', deviceIds);

        if (deviceIds.length > 0) {
          const { data: sensors, error } = await supabase
            .from('sensors')
            .select(`
              *,
              devices(name, location)
            `)
            .in('device_id', deviceIds)
            .eq('is_active', true)
            .order('created_at', { ascending: false });

          if (error) throw error;
          data = sensors;
          console.log('User accessible sensors:', data);
        } else {
          data = [];
        }
      }
      
      setSensors(data || []);
      
      // Update sensors count in stats
      setStats(prev => [
        prev[0], // Keep accessible devices
        prev[1], // Keep online devices
        { 
          title: 'Active Sensors', 
          value: (data?.length || 0).toString(), 
          change: '+0 dari jam terakhir', 
          color: 'text-purple-600' 
        },
        prev[3], // Keep recent readings
      ]);
    } catch (error) {
      console.error('Error fetching sensors:', error);
    }
  };

  const fetchLatestReadings = async () => {
    try {
      const { data, error } = await supabase
        .from('sensor_readings')
        .select('*, devices(name)')
        .order('timestamp', { ascending: false })
        .limit(1);

      if (error) throw error;
      setCurrentReadings(data && data.length > 0 ? data[0] : null);
    } catch (error) {
      console.error('Error fetching latest readings:', error);
    }
  };

  const handleSensorClick = (sensor) => {
    setSelectedSensor(sensor);
    setShowChart(true);
  };

  const handleCloseChart = () => {
    setShowChart(false);
    setSelectedSensor(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">
          Overview dari network IoT device Anda 
          {userRole === 'user' && <span className="text-sm text-blue-600">(Akses terbatas)</span>}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {stat.title}
              </CardTitle>
              <div className={`text-2xl ${stat.color}`}>
                {stat.title.includes('Accessible') && '📱'}
                {stat.title.includes('Online') && '🟢'}
                {stat.title.includes('Sensors') && '📊'}
                {stat.title.includes('Readings') && '⚡'}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-gray-500 mt-1">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sensor Information */}
      <Card>
        <CardHeader>
          <CardTitle>Sensor Information</CardTitle>
          <CardDescription>
            Informasi sensor yang dapat diakses
            {userRole === 'user' && <span className="text-blue-600"> (berdasarkan device yang diberi akses)</span>}
            <br />
            <span className="text-sm text-gray-500">Klik pada sensor untuk melihat grafik data</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <p>Loading sensors...</p>
            </div>
          ) : sensors.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-center">
              <div>
                <p className="text-gray-500 mb-2">No sensors found</p>
                <p className="text-sm text-gray-400">
                  {userRole === 'user' 
                    ? 'Belum ada device yang diberi akses atau belum ada sensor yang terdaftar'
                    : 'Belum ada sensor yang terdaftar pada device'
                  }
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentSensors.map((sensor) => (
                  <div 
                    key={sensor.id} 
                    className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer hover:border-blue-300"
                    onClick={() => handleSensorClick(sensor)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-900">{sensor.name}</h4>
                      <Badge variant={sensor.is_active ? 'default' : 'destructive'}>
                        {sensor.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      <p><span className="font-medium">Type:</span> {sensor.type}</p>
                      <p><span className="font-medium">Unit:</span> {sensor.unit}</p>
                      <p><span className="font-medium">Device:</span> {sensor.devices?.name || 'Unknown'}</p>
                      <p><span className="font-medium">Location:</span> {sensor.devices?.location || 'Unknown'}</p>
                      {sensor.min_value !== null && sensor.max_value !== null && (
                        <p><span className="font-medium">Range:</span> {sensor.min_value} - {sensor.max_value}</p>
                      )}
                    </div>
                    <div className="mt-2 text-xs text-blue-500">
                      📊 Klik untuk melihat grafik
                    </div>
                  </div>
                ))}
              </div>
              
              {sensorTotalPages > 1 && (
                <DevicePagination
                  currentPage={sensorCurrentPage}
                  totalPages={sensorTotalPages}
                  onPageChange={setSensorCurrentPage}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Device Map - Full Width */}
      <ErrorBoundary fallback={
        <Card>
          <CardHeader>
            <CardTitle>Device Map</CardTitle>
            <CardDescription>Map is temporarily unavailable</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-gray-500">
              Map component error - please refresh the page
            </div>
          </CardContent>
        </Card>
      }>
        <DeviceMap />
      </ErrorBoundary>

      {/* Device Status */}
      <Card>
        <CardHeader>
          <CardTitle>Status Device</CardTitle>
          <CardDescription>
            Daftar device dan status terkini
            {userRole === 'user' && <span className="text-blue-600"> (yang dapat diakses)</span>}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <p>Loading devices...</p>
            </div>
          ) : devices.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-gray-500">
                {userRole === 'user' 
                  ? 'Belum ada device yang diberi akses' 
                  : 'No devices found'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-4">
                {currentDevices.map((device) => (
                  <div key={device.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{device.name}</p>
                      <p className="text-sm text-gray-500">{device.location}</p>
                      <p className="text-xs text-gray-400">Last updated: {new Date(device.updated_at).toLocaleString('id-ID', { timeZone: 'UTC' })}</p>
                    </div>
                    <div className="text-right space-y-1">
                      <Badge variant={device.status === 'online' ? 'default' : 'destructive'}>
                        {device.status}
                      </Badge>
                      <p className="text-xs text-gray-500">Battery: {device.battery}%</p>
                    </div>
                  </div>
                ))}
              </div>
              
              {deviceTotalPages > 1 && (
                <DevicePagination
                  currentPage={deviceCurrentPage}
                  totalPages={deviceTotalPages}
                  onPageChange={setDeviceCurrentPage}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sensor Chart Modal */}
      {showChart && selectedSensor && (
        <SensorChart 
          sensor={selectedSensor}
          onClose={handleCloseChart}
        />
      )}
    </div>
  );
};

export default Dashboard;
