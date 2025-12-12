import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
// import { Battery, Thermometer, Droplets, Gauge, Wifi, List, Sun } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import 'leaflet/dist/leaflet.css';
import {
  Battery,
  Thermometer,
  Droplets,
  Gauge,
  Wifi,
  List,
  Sun,
  Cloud,
  Heart,
  CloudRain,
  Wind,
  Compass,
  TestTube,
  Lightbulb
} from 'lucide-react';

// Fix for default markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icon configuration based on device status
const createDeviceIcon = (status: string) => {
  const iconUrl = status === 'online' 
    ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png'
    : 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png';
    
  return new L.Icon({
    iconUrl: iconUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    shadowSize: [41, 41]
  });
};

interface Device {
  id: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  status: string;
  battery: number;
  type: string;
}

interface Sensor {
  id: string;
  name: string;
  type: string;
  unit: string;
  device_id: string;
  is_active: boolean;
}

const DeviceMap = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('user');

  useEffect(() => {
    fetchUserRole();
    fetchDevicesAndSensors();
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

  const fetchDevicesAndSensors = async () => {
    try {
      let devicesData;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const userRole = profile?.role || 'user';
      console.log('Map - User role:', userRole);

      if (userRole === 'superadmin' || userRole === 'admin') {
        // Admin and superadmin can see all devices
        const { data, error } = await supabase
          .from('devices')
          .select('*')
          .not('latitude', 'is', null)
          .not('longitude', 'is', null);

        if (error) throw error;
        devicesData = data;
        console.log('Map - Admin devices:', devicesData);
      } else {
        // Regular users can only see devices they have access to
        const { data: accessData, error } = await supabase
          .from('user_device_access')
          .select(`
            devices!user_device_access_device_id_fkey(*)
          `)
          .eq('user_id', user.id);

        if (error) {
          console.error('Map - Error fetching user device access:', error);
          throw error;
        }

        console.log('Map - User device access:', accessData);
        devicesData = accessData
          ?.map(access => access.devices)
          .filter(device => device && device.latitude !== null && device.longitude !== null) || [];
        console.log('Map - User accessible devices:', devicesData);
      }

      // Fetch sensors for accessible devices
      const deviceIds = devicesData?.map(d => d.id) || [];
      let sensorsData = [];

      if (deviceIds.length > 0) {
        const { data: sensors, error: sensorsError } = await supabase
          .from('sensors')
          .select('*')
          .in('device_id', deviceIds)
          .eq('is_active', true);

        if (sensorsError) throw sensorsError;
        sensorsData = sensors || [];
        console.log('Map - Sensors for devices:', sensorsData);
      }

      setDevices(devicesData || []);
      setSensors(sensorsData);
    } catch (error) {
      console.error('Error fetching devices and sensors for map:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDeviceSensors = (deviceId: string) => {
    return sensors.filter(sensor => sensor.device_id === deviceId);
  };

  // const getSensorIcon = (sensorType: string) => {
  //   switch (sensorType.toLowerCase()) {
  //     case 'temperature':
  //       return <Thermometer className="h-4 w-4 text-red-500" />;
  //     case 'humidity':
  //       return <Droplets className="h-4 w-4 text-blue-500" />;
  //     case 'pressure':
  //       return <Gauge className="h-4 w-4 text-green-500" />;
  //     default:
  //       return <Sun className="h-4 w-4 text-gray-500" />;
  //   }
  // };
  const getSensorIcon = (sensorType: string) => {
  switch (sensorType.toLowerCase()) {
    case 'temperature':
      return <Thermometer className="h-4 w-4 text-red-500" />;
    case 'humidity':
      return <Droplets className="h-4 w-4 text-blue-500" />;
    case 'pressure':
      return <Gauge className="h-4 w-4 text-green-500" />;
    case 'co2':
      return <Cloud className="h-4 w-4 text-gray-700" />; // Abu-abu gelap untuk gas
    case 'o2':
      return <Heart className="h-4 w-4 text-pink-500" />; // Merah muda untuk oksigen/kehidupan
    case 'light':
      return <Sun className="h-4 w-4 text-yellow-500" />; // Kuning terang untuk cahaya
    case 'curah hujan': // Diubah sesuai kunci JSON Anda
      return <CloudRain className="h-4 w-4 text-indigo-500" />; // Biru keunguan untuk hujan
    case 'kecepatan angin': // Diubah sesuai kunci JSON Anda
      return <Wind className="h-4 w-4 text-teal-500" />; // Teal untuk angin
    case 'arah angin': // Diubah sesuai kunci JSON Anda
      return <Compass className="h-4 w-4 text-orange-500" />; // Oranye untuk arah
    case 'ph':
      return <TestTube className="h-4 w-4 text-purple-500" />; // Ungu untuk pH/kimia
    default:
      // Ikon default jika tipe sensor tidak dikenali
      return <List className="h-4 w-4 text-gray-400" />;
  }
};

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p>Loading map...</p>
      </div>
    );
  }

  // Default center to Indonesia if no devices
  const defaultCenter: [number, number] = [-6.2088, 106.8456];
  const mapCenter = devices.length > 0 
    ? [devices[0].latitude, devices[0].longitude] as [number, number]
    : defaultCenter;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Device Map</h2>
        <p className="text-gray-600">
          Lokasi perangkat IoT yang {userRole === 'user' ? 'dapat diakses' : 'terdaftar'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Interactive Map</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 rounded-lg overflow-hidden">
            <MapContainer
              center={mapCenter}
              zoom={devices.length > 0 ? 12 : 10}
              style={{ height: '100%', width: '100%' }}
              className="map-container"
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              
              {devices.map((device) => (
                <Marker
                  key={device.id}
                  position={[device.latitude, device.longitude]}
                  icon={createDeviceIcon(device.status)}
                >
                  <Popup>
                    {/* MODIFIKASI 1: Tambahkan max-w-xs (max-width: 20rem / 320px) */}
                    {/* <div className="p-2 min-w-[250px]"> */}
                    <div className="p-2 min-w-[250px] max-w-sm">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          {/* <h3 className="font-semibold text-lg">{device.name}</h3> */}
                          {/* MODIFIKASI 3: Tambahkan break-words untuk nama device */}
                          <h3 className="font-semibold text-lg break-words">{device.name}</h3>
                          <div className="flex items-center space-x-2">
                            <Battery className="h-4 w-4" />
                            <span className="text-sm">{device.battery}%</span>
                          </div>
                          <Badge variant={device.status === 'online' ? 'default' : 'secondary'}>
                            {device.status}
                          </Badge>
                        </div> 

                        <Separator />

                        {/* Registered Sensors */}
                        <div>
                          <h4 className="font-medium text-sm mb-2">Registered Sensors:</h4>
                          {/* <div className="space-y-2"> */}
                          {/* MODIFIKASI 2: Tambahkan max-h-40 dan overflow-y-auto */}
                          {/* <div className="space-y-2 max-h-40 overflow-y-auto"> */}
                          <div className="space-y-1 max-h-28 overflow-y-auto pr-1"> {/* Sesuaikan max-h jika perlu, misal max-h-28 untuk sekitar 3-4 item ringkas */}
                            {getDeviceSensors(device.id).map((sensor) => (
                              <div key={sensor.id} className="flex items-center space-x-2 py-1 px-2 hover:bg-gray-100 rounded">
                                {getSensorIcon(sensor.type)}
                                {/* <div className="flex-1"> */}
                                <div className="flex-1 min-w-0"> {/* Tambahkan min-w-0 untuk flex-1 bekerja dengan baik bersama truncate/break-words */}
                                  {/* <p className="text-sm font-medium">{sensor.name}</p>
                                  <p className="text-xs text-gray-500"> */}
                                  {/* MODIFIKASI 3: Tambahkan break-words untuk nama sensor */}
                                  <span className="text-sm text-gray-700 flex-1 truncate">{sensor.name}</span>
                                  {/* MODIFIKASI 3: Tambahkan break-words untuk tipe sensor */}
                                  {/* <p className="text-xs text-gray-500 break-words">
                                    {sensor.type} ({sensor.unit})
                                  </p> */}
                                </div>
                                <Badge variant={sensor.is_active ? 'default' : 'secondary'} className="text-xs">
                                  {sensor.is_active ? 'Active' : 'Inactive'}
                                </Badge>
                              </div>
                            ))}
                            {getDeviceSensors(device.id).length === 0 && (
                              <p className="text-xs text-gray-400 italic">No sensors registered</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
          
          {devices.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              {userRole === 'user' 
                ? 'Belum ada device dengan koordinat yang dapat diakses'
                : 'Belum ada device dengan koordinat yang terdaftar'
              }
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DeviceMap;
