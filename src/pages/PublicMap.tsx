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
  Waves
} from 'lucide-react';
import SensorChart from '@/components/SensorChart';
import InlineSensorPanel from '@/components/InlineSensorPanel';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

// --- KONFIGURASI FILTER DEVICE ---
const ALLOWED_DEVICE_NAMES = [
  "AWLR 1 Dummy", 
  "AWLR 2 Dummy",
  "AWLR 3 Dummy",
  "AWLR 4 Dummy",
  "AWLR Gateway Dummy"
];

// --- KONFIGURASI THRESHOLD (BATAS AMAN) ---
const WATER_LEVEL_LIMITS = {
  WASPADA: 20, 
  BAHAYA: 40   
};

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
  // Parse jika masih string
  if (typeof sensorData === 'string') {
    try { sensorData = JSON.parse(sensorData); } catch (e) {}
  }

  // Cek JSON Object
  if (sensorData && typeof sensorData === 'object') {
    if (sensorData[fieldHint] !== undefined) return sensorData[fieldHint];
    if (sensorData.value !== undefined) return sensorData.value;
    if (sensorData.val !== undefined) return sensorData.val;
    const snakeCase = fieldHint.replace(/\s+/g, '_');
    if (sensorData[snakeCase] !== undefined) return sensorData[snakeCase];
  }

  // Cek Legacy Columns
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
  if (normalizedType.includes('co2')) return 'co2';
  if (normalizedType.includes('ph')) return 'ph';
  if (normalizedType.includes('batt')) return 'battery';
  if (normalizedType.includes('light') || normalizedType.includes('lux')) return 'light';
  if (normalizedType.includes('wind')) return 'wind_speed';
  if (normalizedType.includes('arah')) return 'wind_direction';
  
  return normalizedType.replace(/[^a-z0-9_]/g, '_');
};

const PublicMap: React.FC = () => {
  const [devices, setDevices] = useState<any[]>([]);
  const [sensors, setSensors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sensorLatestByDevice, setSensorLatestByDevice] = useState<Record<string, Record<string, any>>>({});
  const navigate = useNavigate();
  
  const sensorsRef = useRef<any[]>([]); 
  const devicesRef = useRef<any[]>([]); // Ref untuk device agar bisa diupdate realtime
  
  const [selectedSensorForChart, setSelectedSensorForChart] = useState<any | null>(null);
  const [selectedDeviceForChart, setSelectedDeviceForChart] = useState<any | null>(null);

  useEffect(() => {
    fetchDevicesAndSensors(true);

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

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    sensorsRef.current = sensors;
  }, [sensors]);

  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  // --- LOGIC UTAMA REALTIME ---
  const handleNewRealtimeData = (newReading: any) => {
    const deviceId = newReading.device_id;
    if (!deviceId) return;

    const deviceSensors = sensorsRef.current.filter(s => s.device_id === deviceId);
    if (deviceSensors.length === 0) return;

    // 1. UPDATE NILAI SENSOR & LEVEL AIR
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

    // 2. FORCE UPDATE DEVICE STATUS KE 'ONLINE'
    // Ini penting! Jika data masuk, berarti device online. Jangan biarkan map mengira offline.
    setDevices(prevDevices => {
        const deviceExists = prevDevices.find(d => d.id === deviceId);
        if (deviceExists && deviceExists.status !== 'online') {
            console.log(`📡 Device ${deviceExists.name} is sending data -> Force Online`);
            return prevDevices.map(d => 
                d.id === deviceId ? { ...d, status: 'online' } : d
            );
        }
        return prevDevices;
    });
  };

  const fetchDevicesAndSensors = async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) setLoading(true);

      const { data: devData, error: devError } = await supabase
        .from('devices')
        .select('id, name, latitude, longitude, status, battery, location')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (devError) throw devError;

      let validDevices = (devData || []) as any[];

      if (ALLOWED_DEVICE_NAMES.length > 0) {
        validDevices = validDevices.filter(d => 
          ALLOWED_DEVICE_NAMES.includes(d.name)
        );
      }

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

    await Promise.all(devs.map(async (device) => {
      const { data } = await supabase
        .from('sensor_readings')
        .select('*')
        .eq('device_id', device.id)
        .order('timestamp', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const latest = data[0];
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
  };

  const fetchLatestForDevice = async (deviceId: string) => {
      try {
        const { data } = await supabase
          .from('sensor_readings')
          .select('*')
          .eq('device_id', deviceId)
          .order('timestamp', { ascending: false })
          .limit(1);
  
        if (data && data[0]) {
           handleNewRealtimeData(data[0]);
        }
      } catch (error) {
        console.error('Error manual refresh', error);
      }
  };

  const handleOpenChart = (sensor: any, device: any) => {
    setSelectedSensorForChart({ ...sensor, devices: device });
    setSelectedDeviceForChart(device);
  };

  const handleCloseChart = () => {
    setSelectedSensorForChart(null);
    setSelectedDeviceForChart(null);
  };

  // --- LOGIC WARNA ---
  const getMarkerColor = (device: any): 'blue' | 'red' | 'gold' | 'green' | 'grey' => {
    // Priority: Jika ada data water level, abaikan status offline database
    const readings = sensorLatestByDevice[device.id];
    const waterLevel = readings?.['__water_level'];

    if (waterLevel !== undefined && waterLevel !== null) {
      const val = parseFloat(waterLevel);
      if (val >= WATER_LEVEL_LIMITS.BAHAYA) return 'red';   
      if (val >= WATER_LEVEL_LIMITS.WASPADA) return 'gold';  
      return 'green'; 
    }

    // Jika tidak ada data sensor level air, baru cek status device
    if (device.status !== 'online') return 'grey'; 

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
                Astrodev-IoT
              </h1>
              <p className="text-[10px] text-gray-500 font-medium tracking-wide">PUBLIC MONITORING</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <Button 
                variant="default" 
                size="sm" 
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                onClick={() => navigate('/')}
              >
                <LogIn className="w-4 h-4 mr-2" />
                Login
             </Button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 w-full p-2 lg:p-3 overflow-hidden min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 h-full">
          
          {/* MAP SECTION */}
          <div className="lg:col-span-3 h-full flex flex-col relative z-10 rounded-xl overflow-hidden shadow-md border bg-white">
             <MapContainer center={mapCenter} zoom={devices.length > 0 ? 13 : 10} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
                {devices.map(device => {
                  const markerColor = getMarkerColor(device);
                  
                  return (
                  <Marker
                    key={`${device.id}-${markerColor}`} // Force Re-render saat warna berubah
                    position={[device.latitude, device.longitude]}
                    icon={createDeviceIcon(markerColor)}
                    eventHandlers={{ click: () => fetchLatestForDevice(device.id) }} 
                  >
                    <Popup>
                      <div className="p-2 min-w-[250px] max-w-sm">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-lg text-gray-800">{device.name}</h3>
                            <div className="flex items-center space-x-2">
                              <Battery className="h-4 w-4 text-gray-500" />
                              <span className="text-sm font-medium">{device.battery ?? '-'}%</span>
                            </div>
                            
                            {(() => {
                               // Gunakan Logic Warna yang SAMA PERSIS dengan Marker
                               let label = device.status;
                               let badgeClass = "bg-gray-100 text-gray-600"; 

                               if (markerColor === 'red') { label = 'BAHAYA'; badgeClass = "bg-red-100 text-red-700 border-red-200"; }
                               else if (markerColor === 'gold') { label = 'WASPADA'; badgeClass = "bg-yellow-100 text-yellow-700 border-yellow-200"; }
                               else if (markerColor === 'green') { label = 'AMAN'; badgeClass = "bg-green-100 text-green-700 border-green-200"; }
                               else if (markerColor === 'blue') { label = 'ONLINE'; badgeClass = "bg-blue-100 text-blue-700 border-blue-200"; }

                               return <Badge variant="outline" className={`ml-2 border ${badgeClass}`}>{label}</Badge>;
                            })()}
                          </div>
                          <Separator />
                          <div>
                            <h4 className="font-medium text-sm mb-2 text-gray-700">Sensors:</h4>
                            <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                              {getDeviceSensors(device.id).map(sensor => (
                                <div key={sensor.id} className="flex items-center justify-between py-1 px-2 hover:bg-gray-100 rounded transition-colors cursor-pointer" onClick={() => handleOpenChart(sensor, device)}>
                                  <div className="flex items-center space-x-2">
                                    {getSensorIcon(sensor.type)}
                                    <span className="text-sm text-gray-700 font-medium hover:text-blue-600">
                                      {sensor.name}
                                    </span>
                                  </div>
                                  <div className="text-sm font-semibold text-gray-800">
                                    {sensorLatestByDevice[device.id]?.[sensor.id] ?? '-'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                )})}
                
                {/* LEGENDA */}
                <div className="absolute bottom-4 left-4 z-[400] bg-white/95 backdrop-blur p-2 rounded-md shadow-md border text-xs space-y-1">
                  <div className="font-semibold text-gray-700 mb-1">Status Sungai:</div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500"></div> Aman (&lt; {WATER_LEVEL_LIMITS.WASPADA} cm)</div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-400"></div> Waspada ({WATER_LEVEL_LIMITS.WASPADA}-{WATER_LEVEL_LIMITS.BAHAYA} cm)</div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500"></div> Bahaya (&gt; {WATER_LEVEL_LIMITS.BAHAYA} cm)</div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-gray-400"></div> Offline</div>
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
                      let borderClass = "border-gray-100";
                      let statusText = "ONLINE";
                      let statusColorClass = "bg-blue-100 text-blue-700";

                      if (color === 'red') { 
                        borderClass = "border-red-300 ring-1 ring-red-100";
                        statusText = "BAHAYA";
                        statusColorClass = "bg-red-100 text-red-700";
                      } else if (color === 'gold') {
                        borderClass = "border-yellow-300 ring-1 ring-yellow-100";
                        statusText = "WASPADA";
                        statusColorClass = "bg-yellow-100 text-yellow-700";
                      } else if (color === 'green') {
                        borderClass = "border-green-200 ring-1 ring-green-50";
                        statusText = "AMAN";
                        statusColorClass = "bg-green-100 text-green-700";
                      } else if (color === 'grey') {
                        statusText = "OFFLINE";
                        statusColorClass = "bg-gray-100 text-gray-600";
                      }

                      return (
                      <div key={device.id} className={`bg-white rounded-lg p-3 shadow-sm border ${borderClass} hover:shadow-md transition-shadow duration-200`}>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                               {device.name}
                               {device.status === 'online' && <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                               </span>}
                            </div>
                            {device.location && (
                               <div className="flex items-center text-[10px] text-gray-500 mt-0.5">
                                 <Compass className="w-3 h-3 mr-1" /> {device.location}
                               </div>
                            )}
                          </div>
                          <div className="text-right">
                             <div className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${statusColorClass}`}>{statusText}</div>
                             
                             <div className="text-[10px] font-medium mt-1 text-gray-600 flex justify-end items-center gap-1">
                                <Battery className="w-3 h-3" /> {device.battery ?? '-'}%
                             </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-2">
                          {getDeviceSensors(device.id).map((s: any) => (
                            <InlineSensorPanel
                              key={s.id}
                              sensor={{ ...s, devices: device }}
                              device={device}
                              expanded={false}
                              onOpenFull={(sensor) => handleOpenChart(sensor, device)} 
                            />
                          ))}
                        </div>
                      </div>
                    )})}
                  </div>
                )}
              </CardContent>

              <div className="flex-none p-2 bg-white border-t text-center z-10">
                 <p className="text-[10px] text-gray-400">Powered by Astrodev</p>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PublicMap;