
import React, { useEffect, useState, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Battery, Thermometer, Droplets, Gauge, Wifi } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('user');

  useEffect(() => {
    fetchUserRole();
    fetchDevicesAndSensors();
  }, []);

  useEffect(() => {
    if (!mapContainer.current || devices.length === 0) return;

    // Initialize map with a default token (user should replace this)
    mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw';
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [devices[0].longitude, devices[0].latitude],
      zoom: 10
    });

    // Add markers for each device
    devices.forEach((device) => {
      if (device.latitude && device.longitude) {
        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div style="padding: 10px; min-width: 200px;">
            <h3 style="margin: 0 0 8px 0; font-weight: bold;">${device.name}</h3>
            <div style="margin-bottom: 8px;">
              <span style="background: ${device.status === 'online' ? '#22c55e' : '#ef4444'}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">
                ${device.status}
              </span>
            </div>
            <p style="margin: 4px 0; font-size: 14px;"><strong>Location:</strong> ${device.location}</p>
            <p style="margin: 4px 0; font-size: 14px;"><strong>Type:</strong> ${device.type}</p>
            <p style="margin: 4px 0; font-size: 14px;"><strong>Battery:</strong> ${device.battery}%</p>
          </div>
        `);

        new mapboxgl.Marker({
          color: device.status === 'online' ? '#22c55e' : '#ef4444'
        })
        .setLngLat([device.longitude, device.latitude])
        .setPopup(popup)
        .addTo(map.current!);
      }
    });

    return () => {
      map.current?.remove();
    };
  }, [devices]);

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

      if (userRole === 'superadmin' || userRole === 'admin') {
        const { data, error } = await supabase
          .from('devices')
          .select('*')
          .not('latitude', 'is', null)
          .not('longitude', 'is', null);

        if (error) throw error;
        devicesData = data;
      } else {
        const { data: accessData, error } = await supabase
          .from('user_device_access')
          .select(`
            devices!user_device_access_device_id_fkey(*)
          `)
          .eq('user_id', user.id);

        if (error) throw error;
        devicesData = accessData
          ?.map(access => access.devices)
          .filter(device => device && device.latitude !== null && device.longitude !== null) || [];
      }

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
      }

      setDevices(devicesData || []);
      setSensors(sensorsData);
    } catch (error) {
      console.error('Error fetching devices and sensors for map:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p>Loading map...</p>
      </div>
    );
  }

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
            <div ref={mapContainer} style={{ height: '100%', width: '100%' }} />
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
