import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import 'leaflet/dist/leaflet.css';
import { 
  Battery, Thermometer, Droplets, Gauge, Sun, CloudRain, Wind, 
  Compass, TestTube, List, ChevronLeft, LogIn, LayoutDashboard,
  Waves, Signal, SignalHigh, SignalLow, ExternalLink, MessageCircle, X, Info,
  Code2, ShieldCheck, Mail, Globe, Building2
} from 'lucide-react';
import SensorChart from '@/components/SensorChart';
import InlineSensorPanel from '@/components/InlineSensorPanel';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

// --- DEFAULT THRESHOLD UNTUK AWLR (Fallback jika belum ada di database) ---
const DEFAULT_WATER_LEVEL_LIMITS = {
  WASPADA: 20, 
  BAHAYA: 40   
};

// Helper: Check if device is AWLR type
const isAWLRDevice = (device: any) => {
  const name = (device.name || '').toLowerCase();
  const type = (device.type || '').toLowerCase();
  return name.includes('awlr') || type.includes('awlr') || type.includes('water level') || type.includes('tinggi air');
};

// BATAS WAKTU DEVICE DIANGGAP OFFLINE (5 Menit)
const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000; 

// Fix for default markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// --- FUNGSI ICON DINAMIS ---
const createDeviceIcon = (color: 'blue' | 'red' | 'gold' | 'green' | 'grey') => {
  const iconUrl = `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`;

  return new L.Icon({
    iconUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    shadowSize: [41, 41]
  });
};

const getSensorIcon = (sensorType: string) => {
  const t = (sensorType || '').toLowerCase();
  if (t.includes('temp')) return <Thermometer className="h-4 w-4 text-red-500" />;
  if (t.includes('humid')) return <Droplets className="h-4 w-4 text-blue-500" />;
  if (t.includes('press')) return <Gauge className="h-4 w-4 text-green-500" />;
  if (t.includes('rain') || t.includes('curah')) return <CloudRain className="h-4 w-4 text-indigo-500" />;
  if (t.includes('wind') || t.includes('kecepatan')) return <Wind className="h-4 w-4 text-teal-500" />;
  if (t.includes('arah')) return <Compass className="h-4 w-4 text-orange-500" />;
  if (t.includes('ph')) return <TestTube className="h-4 w-4 text-purple-500" />;
  if (t.includes('light') || t.includes('lux')) return <Sun className="h-4 w-4 text-yellow-500" />;
  if (t.includes('tinggi') || t.includes('water') || t.includes('level')) return <Waves className="h-4 w-4 text-cyan-600" />;
  return <List className="h-4 w-4 text-gray-400" />;
};

// --- HELPER: SMART VALUE FINDER ---
const findValueInReading = (latest: any, fieldHint: string) => {
  if (!latest) return null;

  let sensorData = latest.sensor_data;
  if (typeof sensorData === 'string') {
    try { sensorData = JSON.parse(sensorData); } catch (e) {}
  }

  if (sensorData && typeof sensorData === 'object') {
    if (sensorData[fieldHint] !== undefined) return sensorData[fieldHint];
    if (sensorData.value !== undefined) return sensorData.value;
    if (sensorData.val !== undefined) return sensorData.val;
    const snakeCase = fieldHint.replace(/\s+/g, '_');
    if (sensorData[snakeCase] !== undefined) return sensorData[snakeCase];
  }

  if (latest[fieldHint] !== undefined) return latest[fieldHint];
  if (latest.value !== undefined) return latest.value;
  return null;
};

const getSensorFieldFromType = (sensorType: string) => {
  const normalizedType = (sensorType || '').toLowerCase().trim();
  if (!normalizedType) return '';

  if (normalizedType.includes('tinggi') || normalizedType.includes('water') || normalizedType.includes('level')) return 'ketinggian_air';
  if (normalizedType.includes('temp')) return 'temperature';
  if (normalizedType.includes('humid')) return 'humidity';
  if (normalizedType.includes('press')) return 'pressure';
  if (normalizedType.includes('rain') || normalizedType.includes('curah')) return 'curah_hujan';
  if (normalizedType.includes('batt')) return 'battery';
  if (normalizedType.includes('light') || normalizedType.includes('lux')) return 'light';
  
  return normalizedType.replace(/[^a-z0-9_]/g, '_'); 
};

// --- HELPER KHUSUS: FORMAT TANGGAL & WAKTU (FIX +7 HOURS ISSUE) ---
const formatLastSeenTime = (timestamp: string) => {
  if (!timestamp) return '-';
  // FIX: Menambahkan Tanggal (Day, Month, Year) dan TimeZone UTC
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

const PublicMap: React.FC = () => {
  const [devices, setDevices] = useState<any[]>([]);
  const [sensors, setSensors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sensorLatestByDevice, setSensorLatestByDevice] = useState<Record<string, Record<string, any>>>({});
  const [waterLevelLimits, setWaterLevelLimits] = useState(DEFAULT_WATER_LEVEL_LIMITS);
  
  // STATE: Data realtime
  const [lastSeenByDevice, setLastSeenByDevice] = useState<Record<string, string>>({});
  const [currentTime, setCurrentTime] = useState(Date.now());
  
  // STATE: Modal Info Bot & About
  const [showBotInfo, setShowBotInfo] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  // STATE DATA ABOUT (Default Value)
  const [aboutData, setAboutData] = useState({
    title: 'Astrodev IoT Dashboard',
    description: 'Sistem Monitoring Cerdas untuk perangkat IoT dengan visualisasi data real-time, prediksi cuaca, dan peringatan dini banjir.',
    version: '1.0.0',
    developer: 'Devandri Suherman & Firdaus',
    company: 'School of Electrical Engineering and Informatics',
    contact_email: 'devandrisuherman9@gmail.com',
    website: 'https://astrodev.cloud',
    copyright: 'Copyright © 2025 Astrodev. All rights reserved.'
  });

  const navigate = useNavigate();
  const sensorsRef = useRef<any[]>([]); 
  
  const [selectedSensorForChart, setSelectedSensorForChart] = useState<any | null>(null);
  const [selectedDeviceForChart, setSelectedDeviceForChart] = useState<any | null>(null);

  useEffect(() => {
    fetchDevicesAndSensors(true);
    fetchAboutData(); // Ambil data About dari DB
    fetchWaterLevelLimits(); // Ambil threshold AWLR dari DB

    const channel = supabase
      .channel('public-dashboard-updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sensor_readings' },
        (payload) => {
          handleNewRealtimeData(payload.new);
        }
      )
      .subscribe();

    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    sensorsRef.current = sensors;
  }, [sensors]);

  // Fungsi fetch About Data
  const fetchAboutData = async () => {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'about_info')
        .single();

      if (data && data.value) {
        setAboutData(data.value as any);
      }
    } catch (err) {
      console.log('Using default about data');
    }
  };

  // Fungsi fetch Water Level Limits
  const fetchWaterLevelLimits = async () => {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'water_level_limits')
        .single();

      if (data && data.value) {
        setWaterLevelLimits(data.value as any);
      }
    } catch (err) {
      console.log('Using default water level limits');
    }
  };

  const handleNewRealtimeData = (newReading: any) => {
    const deviceId = newReading.device_id;
    if (!deviceId) return;

    setLastSeenByDevice(prev => ({
      ...prev,
      [deviceId]: newReading.timestamp 
    }));

    const deviceSensors = sensorsRef.current.filter(s => s.device_id === deviceId);
    if (deviceSensors.length === 0) return;

    setSensorLatestByDevice(prevState => {
      const prevValues = prevState[deviceId] || {};
      const newValues: Record<string, any> = { ...prevValues };
      let hasUpdate = false;

      deviceSensors.forEach(sensor => {
        const fieldHint = getSensorFieldFromType(sensor.type);
        const val = findValueInReading(newReading, fieldHint);
        
        if (val !== null && val !== undefined) {
          newValues[sensor.id] = val;
          hasUpdate = true;
          const typeKey = sensor.type.toLowerCase();
          if(typeKey.includes('tinggi') || typeKey.includes('water') || typeKey.includes('level')) {
             newValues['__water_level'] = val;
          }
        }
      });

      if (!hasUpdate) return prevState;
      return { ...prevState, [deviceId]: newValues };
    });
  };

  const fetchDevicesAndSensors = async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) setLoading(true);

      // Fetch all devices with type information
      const { data: devData, error: devError } = await supabase
        .from('devices')
        .select('id, name, type, latitude, longitude, status, battery, location')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (devError) throw devError;

      // Fetch public device access list
      const { data: publicAccessData, error: publicAccessError } = await supabase
        .from('public_device_access')
        .select('device_id')
        .eq('is_public', true);

      if (publicAccessError) {
        console.error('Error fetching public access data:', publicAccessError);
        console.log('Please configure public devices in Public Access settings');
        setDevices([]);
        return;
      }

      // Filter devices based on public access
      const publicDeviceIds = new Set(publicAccessData?.map(d => d.device_id) || []);
      let validDevices = (devData || []).filter(d => publicDeviceIds.has(d.id)) as any[];

      const deviceIds = validDevices.map(d => d.id);
      let sensorsData: any[] = [];
      
      if (deviceIds.length > 0) {
        const { data: sData, error: sError } = await supabase
          .from('sensors')
          .select('*')
          .in('device_id', deviceIds)
          .eq('is_active', true);

        if (sError) throw sError;
        sensorsData = sData || [];
        setSensors(sensorsData || []);
        sensorsRef.current = sensorsData || [];

        await fetchAllLatestReadings(validDevices, sensorsData || []);
      }
      setDevices(validDevices);
    } catch (error) {
      console.error('Error fetching initial data:', error);
    } finally {
      if (isInitialLoad) setLoading(false);
    }
  };

  const fetchAllLatestReadings = async (devs: any[], allSensors: any[]) => {
    const newReadings: Record<string, Record<string, any>> = {};
    const newLastSeen: Record<string, string> = {};

    await Promise.all(devs.map(async (device) => {
      const { data } = await supabase
        .from('sensor_readings')
        .select('*')
        .eq('device_id', device.id)
        .order('timestamp', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const latest = data[0];
        newLastSeen[device.id] = latest.timestamp;

        const deviceSensors = allSensors.filter(s => s.device_id === device.id);
        const values: Record<string, any> = {};

        deviceSensors.forEach(sensor => {
          const fieldHint = getSensorFieldFromType(sensor.type);
          const val = findValueInReading(latest, fieldHint);
          values[sensor.id] = val !== null ? val : null;
          
          const typeKey = sensor.type.toLowerCase();
          if(typeKey.includes('tinggi') || typeKey.includes('water') || typeKey.includes('level')) {
             if (val !== null) values['__water_level'] = val;
          }
        });
        newReadings[device.id] = values;
      }
    }));

    setSensorLatestByDevice(newReadings);
    setLastSeenByDevice(newLastSeen);
  };

  const fetchLatestForDevice = async (deviceId: string) => {
      try {
        const { data } = await supabase
          .from('sensor_readings')
          .select('*')
          .eq('device_id', deviceId)
          .order('timestamp', { ascending: false })
          .limit(1);
        if (data && data[0]) handleNewRealtimeData(data[0]);
      } catch (error) {
        console.error('Error manual refresh', error);
      }
  };

  const getDeviceRealtimeStatus = (deviceId: string) => {
    const lastSeen = lastSeenByDevice[deviceId];
    if (!lastSeen) return 'offline';
    const lastSeenDate = new Date(lastSeen).getTime();
    if (currentTime - lastSeenDate > OFFLINE_THRESHOLD_MS) {
      return 'offline';
    }
    return 'online';
  };

  const handleOpenChart = (sensor: any, device: any) => {
    setSelectedSensorForChart({ ...sensor, devices: device });
    setSelectedDeviceForChart(device);
  };

  const handleCloseChart = () => {
    setSelectedSensorForChart(null);
    setSelectedDeviceForChart(null);
  };

  const getMarkerColor = (device: any): 'blue' | 'red' | 'gold' | 'green' | 'grey' => {
    const status = getDeviceRealtimeStatus(device.id);
    if (status === 'offline') return 'grey';
    
    // Special logic for AWLR devices (water level monitoring)
    if (isAWLRDevice(device)) {
      const readings = sensorLatestByDevice[device.id];
      const waterLevel = readings?.['__water_level'];
      if (waterLevel !== undefined && waterLevel !== null) {
        const val = parseFloat(waterLevel);
        if (val >= waterLevelLimits.BAHAYA) return 'red';   
        if (val >= waterLevelLimits.WASPADA) return 'gold';  
        return 'green'; 
      }
    }
    
    // Default: Online devices are blue
    return 'blue'; 
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center animate-pulse">
           <LayoutDashboard className="h-10 w-10 text-blue-600 mx-auto mb-2" />
           <p className="text-gray-500 font-medium">Loading Astrodev Public Map...</p>
        </div>
      </div>
    );
  }

  const defaultCenter: [number, number] = [-6.9175, 107.6191]; 
  const mapCenter = devices.length > 0 && devices[0].latitude && devices[0].longitude
    ? [devices[0].latitude, devices[0].longitude] as [number, number]
    : defaultCenter;

  const getDeviceSensors = (deviceId: string) => sensors.filter(s => s.device_id === deviceId);

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 font-sans overflow-hidden">
      
      {/* HEADER */}
      <header className="flex-none z-30 w-full bg-white/80 backdrop-blur-md border-b shadow-sm h-16">
        <div className="px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-lg flex items-center justify-center shadow-sm">
               <CloudRain className="text-white h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-none bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-cyan-600">
                IoT Dashboard
              </h1>
              <p className="text-[10px] text-gray-500 font-medium tracking-wide">PUBLIC MONITORING</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
             {/* TOMBOL ABOUT */}
             <Button 
                variant="ghost" 
                size="sm" 
                className="text-gray-600 hover:text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                onClick={() => setShowAbout(true)}
             >
                <Info className="w-4 h-4" />
                <span className="hidden sm:inline">About</span>
             </Button>

             {/* TOMBOL BOT */}
             <Button 
                variant="outline" 
                size="sm" 
                className="text-cyan-600 border-cyan-200 hover:bg-cyan-50 flex items-center gap-2"
                onClick={() => setShowBotInfo(true)}
             >
                <MessageCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Info Bot</span>
                <span className="sm:hidden">Bot</span>
             </Button>

             {/* TOMBOL LOGIN */}
             <Button 
                variant="default" 
                size="sm" 
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                onClick={() => navigate('/')}
              >
                <LogIn className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Login</span>
             </Button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 w-full p-2 lg:p-3 overflow-hidden min-h-0 relative">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 h-full">
          
          {/* MAP SECTION */}
          <div className="lg:col-span-3 h-full flex flex-col relative z-10 rounded-xl overflow-hidden shadow-md border bg-white">
             <MapContainer center={mapCenter} zoom={devices.length > 0 ? 13 : 10} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
                {devices.map(device => {
                  const markerColor = getMarkerColor(device);
                  const realtimeStatus = getDeviceRealtimeStatus(device.id);
                  const lastSeenTime = lastSeenByDevice[device.id];
                  
                  return (
                  <Marker
                    key={`${device.id}-${markerColor}`}
                    position={[device.latitude, device.longitude]}
                    icon={createDeviceIcon(markerColor)}
                    eventHandlers={{ click: () => fetchLatestForDevice(device.id) }} 
                  >
                    <Popup>
                      <div className="p-2 min-w-[250px] max-w-sm">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-lg text-gray-800">{device.name}</h3>
                            {(() => {
                               let label = realtimeStatus === 'online' ? 'ONLINE' : 'OFFLINE';
                               let badgeClass = "bg-gray-100 text-gray-600"; 
                               
                               // AWLR-specific status labels
                               if (isAWLRDevice(device)) {
                                 if (markerColor === 'red') { label = 'BAHAYA'; badgeClass = "bg-red-100 text-red-700 border-red-200"; }
                                 else if (markerColor === 'gold') { label = 'WASPADA'; badgeClass = "bg-yellow-100 text-yellow-700 border-yellow-200"; }
                                 else if (markerColor === 'green') { label = 'AMAN'; badgeClass = "bg-green-100 text-green-700 border-green-200"; }
                                 else if (markerColor === 'blue') { label = 'ONLINE'; badgeClass = "bg-blue-100 text-blue-700 border-blue-200"; }
                                 else if (markerColor === 'grey') { label = 'OFFLINE'; badgeClass = "bg-gray-100 text-gray-500 border-gray-200"; }
                               } else {
                                 // Generic device status
                                 if (markerColor === 'blue') { label = 'ONLINE'; badgeClass = "bg-blue-100 text-blue-700 border-blue-200"; }
                                 else if (markerColor === 'grey') { label = 'OFFLINE'; badgeClass = "bg-gray-100 text-gray-500 border-gray-200"; }
                               }
                               
                               return <Badge variant="outline" className={`ml-2 border ${badgeClass}`}>{label}</Badge>;
                            })()}
                          </div>
                          
                          <div className="flex flex-col gap-1 text-xs text-gray-500">
                             <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1"><Battery className="h-3 w-3" /> {device.battery ?? '-'}%</div>
                                {realtimeStatus === 'online' ? (
                                  <div className="flex items-center gap-1 text-green-600"><SignalHigh className="h-3 w-3" /> Live</div>
                                ) : (
                                  <div className="flex items-center gap-1 text-gray-400"><SignalLow className="h-3 w-3" /> Offline</div>
                                )}
                             </div>
                             {/* LAST SEEN DENGAN TANGGAL */}
                             <div className="text-[10px] text-right italic text-gray-400 mt-1 border-t pt-1">
                               Last seen: {formatLastSeenTime(lastSeenTime)}
                             </div>
                          </div>

                          <Separator />
                          <div>
                            <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                              {getDeviceSensors(device.id).map(sensor => (
                                <div key={sensor.id} className="flex items-center justify-between py-1 px-2 hover:bg-gray-100 rounded transition-colors cursor-pointer" onClick={() => handleOpenChart(sensor, device)}>
                                  <div className="flex items-center space-x-2">
                                    {getSensorIcon(sensor.type)}
                                    <span className="text-sm text-gray-700 font-medium">{sensor.name}</span>
                                  </div>
                                  <div className="text-sm font-semibold text-gray-800">{sensorLatestByDevice[device.id]?.[sensor.id] ?? '-'}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                )})}
                
                {/* LEGENDA DINAMIS */}
                <div className="absolute bottom-4 left-4 z-[400] bg-white/95 backdrop-blur p-2 rounded-md shadow-md border text-xs space-y-1">
                  <div className="font-semibold text-gray-700 mb-1">
                    {devices.some(d => isAWLRDevice(d)) ? 'Status Sungai:' : 'Status Device:'}
                  </div>
                  {devices.some(d => isAWLRDevice(d)) ? (
                    // AWLR Legend
                    <>
                      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500"></div> Aman (&lt; {waterLevelLimits.WASPADA} cm)</div>
                      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-400"></div> Waspada ({waterLevelLimits.WASPADA}-{waterLevelLimits.BAHAYA} cm)</div>
                      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500"></div> Bahaya (&gt; {waterLevelLimits.BAHAYA} cm)</div>
                    </>
                  ) : (
                    // Generic Legend
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500"></div> Online</div>
                  )}
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-gray-400"></div> Offline (&gt; 5 Menit)</div>
                </div>
             </MapContainer>
          </div>

          {/* SIDEBAR DASHBOARD */}
          <div className="lg:col-span-1 h-full flex flex-col min-h-0">
            <Card className="h-full border shadow-md flex flex-col bg-white overflow-hidden rounded-xl">
              <CardHeader className="flex-none pb-3 border-b bg-white pt-4 z-10">
                 {selectedSensorForChart ? (
                    <div className="flex flex-col space-y-2">
                       <Button variant="ghost" size="sm" onClick={handleCloseChart} className="-ml-3 w-fit text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                          <ChevronLeft className="h-4 w-4 mr-1" /> Back
                       </Button>
                       <div>
                          <CardTitle className="text-base text-gray-800">{selectedSensorForChart.name}</CardTitle>
                          <p className="text-xs text-gray-500">{selectedDeviceForChart?.name}</p>
                       </div>
                    </div>
                 ) : (
                    <div>
                      <CardTitle className="text-base font-semibold text-gray-800">Public Dashboard</CardTitle>
                      <p className="text-sm text-gray-500 mt-1">Real-time Data Visualization</p>
                    </div>
                 )}
              </CardHeader>
              
              <CardContent className="flex-1 overflow-y-auto p-3 custom-scrollbar bg-slate-50">
                {selectedSensorForChart && selectedDeviceForChart ? (
                  <div className="bg-white rounded-lg p-2 shadow-sm border min-h-[300px]">
                    <SensorChart 
                      sensor={selectedSensorForChart} 
                      onClose={handleCloseChart}
                      hideCloseButton={true}
                    />
                  </div>
                ) : (
                  <div className="space-y-3 pb-4">
                    {devices.length === 0 && (
                      <div className="text-center py-10 bg-white rounded-lg border border-dashed">
                        <LayoutDashboard className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">No public devices.</p>
                      </div>
                    )}
                    {devices.map(device => {
                      const color = getMarkerColor(device);
                      const realtimeStatus = getDeviceRealtimeStatus(device.id);
                      const lastSeenTime = lastSeenByDevice[device.id];

                      let borderClass = "border-gray-100";
                      let statusText = "ONLINE";
                      let statusColorClass = "bg-blue-100 text-blue-700";

                      // AWLR-specific styling
                      if (isAWLRDevice(device)) {
                        if (color === 'red') { borderClass = "border-red-300 ring-1 ring-red-100"; statusText = "BAHAYA"; statusColorClass = "bg-red-100 text-red-700"; } 
                        else if (color === 'gold') { borderClass = "border-yellow-300 ring-1 ring-yellow-100"; statusText = "WASPADA"; statusColorClass = "bg-yellow-100 text-yellow-700"; } 
                        else if (color === 'green') { borderClass = "border-green-200 ring-1 ring-green-50"; statusText = "AMAN"; statusColorClass = "bg-green-100 text-green-700"; } 
                        else if (color === 'grey') { borderClass = "border-gray-200 bg-gray-50"; statusText = "OFFLINE"; statusColorClass = "bg-gray-100 text-gray-500"; }
                      } else {
                        // Generic device styling
                        if (color === 'blue') { borderClass = "border-blue-200 ring-1 ring-blue-50"; statusText = "ONLINE"; statusColorClass = "bg-blue-100 text-blue-700"; }
                        else if (color === 'grey') { borderClass = "border-gray-200 bg-gray-50"; statusText = "OFFLINE"; statusColorClass = "bg-gray-100 text-gray-500"; }
                      }

                      return (
                      <div key={device.id} className={`bg-white rounded-lg p-3 shadow-sm border ${borderClass} hover:shadow-md transition-shadow duration-200`}>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                               {device.name}
                               {realtimeStatus === 'online' ? (
                                 <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>
                               ) : (
                                 <span className="relative inline-flex rounded-full h-2 w-2 bg-gray-400"></span>
                               )}
                            </div>
                            <div className="flex items-center text-[10px] text-gray-500 mt-0.5 gap-2">
                               {device.location && <span><Compass className="w-3 h-3 inline mr-1" /> {device.location}</span>}
                            </div>
                            {/* LAST SEEN DENGAN TANGGAL DI SIDEBAR */}
                            <div className={`text-[10px] mt-1 ${realtimeStatus === 'offline' ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                               Last seen: {formatLastSeenTime(lastSeenTime)}
                            </div>
                          </div>
                          <div className="text-right">
                             <div className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${statusColorClass}`}>{statusText}</div>
                             <div className="text-[10px] font-medium mt-1 text-gray-600 flex justify-end items-center gap-1"><Battery className="w-3 h-3" /> {device.battery ?? '-'}%</div>
                          </div>
                        </div>
                        
                        <div className={`grid grid-cols-1 gap-2 ${realtimeStatus === 'offline' ? 'opacity-60 grayscale' : ''}`}>
                          {getDeviceSensors(device.id).map((s: any) => (
                            <InlineSensorPanel key={s.id} sensor={{ ...s, devices: device }} device={device} expanded={false} onOpenFull={(sensor) => handleOpenChart(sensor, device)} />
                          ))}
                        </div>
                      </div>
                    )})}
                  </div>
                )}
              </CardContent>
              <div className="flex-none p-2 bg-white border-t text-center z-10"><p className="text-[10px] text-gray-400">Powered by Astrodev</p></div>
            </Card>
          </div>
        </div>

        {/* MODAL INFO BOT TELEGRAM */}
        {showBotInfo && (
          <div className="absolute inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowBotInfo(false)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                   <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                      <MessageCircle className="w-5 h-5 text-cyan-600" />
                      Informasi Bot Telegram
                   </h3>
                   <Button variant="ghost" size="sm" onClick={() => setShowBotInfo(false)}><X className="w-4 h-4" /></Button>
                </div>
                <div className="p-6">
                    <div className="border rounded-xl p-5 bg-slate-50 hover:bg-slate-100 transition-colors border-cyan-100">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-cyan-100 rounded-lg text-cyan-600"><Waves className="w-6 h-6" /></div>
                          <div><h3 className="font-semibold text-gray-900">River Monitoring Bot</h3><p className="text-sm text-cyan-600 font-medium">@PantauSungai_bot</p></div>
                        </div>
                      </div>
                      <div className="space-y-3 mb-5">
                        <p className="text-sm text-gray-600">Bot ini fokus memberikan peringatan dini (Early Warning System) terkait kondisi sungai:</p>
                        <ul className="text-sm text-gray-500 space-y-1 list-disc pl-4"><li>Status Level Air (Waspada/Bahaya)</li><li>Data Curah Hujan Realtime</li><li>Peringatan Banjir</li></ul>
                      </div>
                      <Button className="w-full bg-cyan-600 hover:bg-cyan-700 text-white" onClick={() => window.open('https://t.me/PantauSungai_bot', '_blank')}><ExternalLink className="w-4 h-4 mr-2" /> Buka Bot di Telegram</Button>
                    </div>
                    <div className="bg-yellow-50 p-4 rounded-md border border-yellow-100 mt-4"><h4 className="font-medium text-yellow-800 text-sm mb-1">Cara Mengaktifkan:</h4><p className="text-sm text-yellow-700">Klik tombol di atas, lalu tekan tombol <strong>START</strong> di aplikasi Telegram Anda untuk mulai menerima notifikasi.</p></div>
                </div>
            </div>
          </div>
        )}

        {/* MODAL ABOUT APPLICATION */}
        {showAbout && (
          <div className="absolute inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowAbout(false)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
               <div className="p-4 border-b flex justify-between items-center bg-white sticky top-0 z-10">
                   <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Info className="w-5 h-5 text-blue-600" /> About Application</h3>
                   <Button variant="ghost" size="sm" onClick={() => setShowAbout(false)}><X className="w-4 h-4" /></Button>
               </div>
               <div className="p-0">
                  <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-6 border-b flex justify-center items-center">
                     <img src="/logo-astrodev.png" alt="Astrodev Logo" className="h-24 w-auto object-contain drop-shadow-sm" />
                  </div>
                  <div className="p-6 space-y-6">
                     <div className="text-center space-y-3">
                        <h2 className="text-2xl font-bold text-slate-800">{aboutData.title}</h2>
                        <Badge variant="secondary" className="px-3 py-1">{aboutData.version}</Badge>
                        <p className="text-slate-600 text-sm leading-relaxed">{aboutData.description}</p>
                     </div>
                     <Separator />
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                           <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2"><Code2 className="w-4 h-4 text-blue-500" /> Development Team</h3>
                           <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm">
                              <div className="mb-3">
                                 <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Developers</span>
                                 <p className="text-slate-800 font-medium mt-0.5">{aboutData.developer}</p>
                              </div>
                              <div>
                                 <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Affiliation</span>
                                 <div className="flex items-start gap-2 mt-0.5">
                                    <Building2 className="w-3 h-3 text-slate-400 mt-1" />
                                    <p className="text-slate-800 font-medium">{aboutData.company}</p>
                                 </div>
                              </div>
                           </div>
                        </div>
                        <div className="space-y-4">
                           <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-green-500" /> Contact</h3>
                           <div className="space-y-2 text-sm">
                              <div className="flex items-center gap-3">
                                 <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center text-blue-600"><Mail className="w-3 h-3" /></div>
                                 <span className="text-slate-600">{aboutData.contact_email}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                 <div className="w-7 h-7 rounded-full bg-purple-50 flex items-center justify-center text-purple-600"><Globe className="w-3 h-3" /></div>
                                 <a href={aboutData.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{aboutData.website}</a>
                              </div>
                           </div>
                        </div>
                     </div>
                     <Separator />
                     <div className="text-center pb-2"><p className="text-xs text-slate-400 font-medium">{aboutData.copyright}</p></div>
                  </div>
               </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default PublicMap;