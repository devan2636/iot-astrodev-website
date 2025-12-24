import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Globe, Eye, EyeOff, Loader2, Droplets, Save, CloudRain } from 'lucide-react';

interface Device {
  id: string;
  name: string;
  description: string;
  type: string;
  location: string;
  status: 'online' | 'offline';
  battery?: number;
  created_at: string;
}

interface PublicAccessDevice {
  id: string;
  device_id: string;
  is_public: boolean;
  device?: Device;
  created_at: string;
  updated_at: string;
}

const PublicAccess = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [publicAccessList, setPublicAccessList] = useState<PublicAccessDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingDeviceId, setUpdatingDeviceId] = useState<string | null>(null);
  const [waterLevelLimits, setWaterLevelLimits] = useState({ WASPADA: 20, BAHAYA: 40 });
  const [rainfallLimits, setRainfallLimits] = useState({ RINGAN: 5, SEDANG: 10, LEBAT: 20 });
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [savingRainfall, setSavingRainfall] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchDevices();
    fetchPublicAccessSettings();
    fetchWaterLevelLimits();
    fetchRainfallLimits();
  }, []);

  const fetchDevices = async () => {
    try {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDevices(data || []);
    } catch (error) {
      console.error('Error fetching devices:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch devices',
        variant: 'destructive',
      });
    }
  };

  const fetchPublicAccessSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('public_device_access')
        .select('*');

      if (error) throw error;
      setPublicAccessList(data || []);
    } catch (error) {
      console.error('Error fetching public access settings:', error);
      // If table doesn't exist yet, that's okay
    } finally {
      setLoading(false);
    }
  };

  const fetchWaterLevelLimits = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'water_level_limits')
        .single();

      if (data && data.value) {
        setWaterLevelLimits(data.value as any);
      }
    } catch (error) {
      console.log('Using default water level limits');
    }
  };

  const fetchRainfallLimits = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'rainfall_limits')
        .single();

      if (data && data.value) {
        setRainfallLimits(data.value as any);
      }
    } catch (error) {
      console.log('Using default rainfall limits');
    }
  };

  const saveWaterLevelLimits = async () => {
    try {
      setSavingThreshold(true);
      
      // Validate values
      if (waterLevelLimits.WASPADA >= waterLevelLimits.BAHAYA) {
        toast({
          title: 'Error',
          description: 'Threshold WASPADA harus lebih kecil dari BAHAYA',
          variant: 'destructive',
        });
        return;
      }

      const { error } = await supabase
        .from('app_settings')
        .upsert({
          key: 'water_level_limits',
          value: waterLevelLimits,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'key'
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Water level threshold updated successfully',
      });
    } catch (error) {
      console.error('Error saving water level limits:', error);
      toast({
        title: 'Error',
        description: 'Failed to save threshold settings',
        variant: 'destructive',
      });
    } finally {
      setSavingThreshold(false);
    }
  };

  const saveRainfallLimits = async () => {
    try {
      setSavingRainfall(true);
      
      // Validate values
      if (rainfallLimits.RINGAN >= rainfallLimits.SEDANG || rainfallLimits.SEDANG >= rainfallLimits.LEBAT) {
        toast({
          title: 'Error',
          description: 'Threshold harus berurutan: RINGAN < SEDANG < LEBAT',
          variant: 'destructive',
        });
        return;
      }

      const { error } = await supabase
        .from('app_settings')
        .upsert({
          key: 'rainfall_limits',
          value: rainfallLimits,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'key'
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Rainfall threshold updated successfully',
      });
    } catch (error) {
      console.error('Error saving rainfall limits:', error);
      toast({
        title: 'Error',
        description: 'Failed to save rainfall threshold',
        variant: 'destructive',
      });
    } finally {
      setSavingRainfall(false);
    }
  };

  const isDevicePublic = (deviceId: string) => {
    return publicAccessList.some(access => access.device_id === deviceId && access.is_public);
  };

  const togglePublicAccess = async (device: Device) => {
    try {
      setUpdatingDeviceId(device.id);
      const currentPublic = isDevicePublic(device.id);

      if (currentPublic) {
        // Remove from public access
        const { error } = await supabase
          .from('public_device_access')
          .delete()
          .eq('device_id', device.id);

        if (error) throw error;

        setPublicAccessList(prev => prev.filter(access => access.device_id !== device.id));
        toast({
          title: 'Success',
          description: `${device.name} is now private`,
        });
      } else {
        // Add to public access
        const { data, error } = await supabase
          .from('public_device_access')
          .insert({
            device_id: device.id,
            is_public: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select();

        if (error) throw error;

        setPublicAccessList(prev => [...prev, data[0]]);
        toast({
          title: 'Success',
          description: `${device.name} is now public`,
        });
      }
    } catch (error) {
      console.error('Error updating public access:', error);
      toast({
        title: 'Error',
        description: 'Failed to update public access',
        variant: 'destructive',
      });
    } finally {
      setUpdatingDeviceId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Loading devices...</p>
      </div>
    );
  }

  const publicDevicesCount = publicAccessList.filter(a => a.is_public).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Globe className="w-8 h-8 text-blue-600" />
            Public Access Management
          </h1>
          <p className="text-gray-600 mt-2">Manage which devices are visible on the public map</p>
        </div>
      </div>

      {/* Summary Card */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-600" />
            Public Access Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Devices</p>
              <p className="text-2xl font-bold text-gray-900">{devices.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Public Devices</p>
              <p className="text-2xl font-bold text-blue-600">{publicDevicesCount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Private Devices</p>
              <p className="text-2xl font-bold text-gray-600">{devices.length - publicDevicesCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AWLR Threshold Settings */}
      <Card className="bg-gradient-to-r from-cyan-50 to-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="w-5 h-5 text-cyan-600" />
            AWLR Water Level Threshold
          </CardTitle>
          <CardDescription>Configure alert thresholds for water level monitoring</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Threshold WASPADA (cm)
              </label>
              <Input
                type="number"
                value={waterLevelLimits.WASPADA}
                onChange={(e) => setWaterLevelLimits({ ...waterLevelLimits, WASPADA: parseFloat(e.target.value) || 0 })}
                className="w-full"
                min="0"
              />
              <p className="text-xs text-gray-500 mt-1">Ketinggian air saat status WASPADA</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Threshold BAHAYA (cm)
              </label>
              <Input
                type="number"
                value={waterLevelLimits.BAHAYA}
                onChange={(e) => setWaterLevelLimits({ ...waterLevelLimits, BAHAYA: parseFloat(e.target.value) || 0 })}
                className="w-full"
                min="0"
              />
              <p className="text-xs text-gray-500 mt-1">Ketinggian air saat status BAHAYA</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between bg-white rounded-lg p-4 border">
            <div className="text-sm text-gray-600">
              Current Settings: <span className="font-semibold text-green-600">&lt; {waterLevelLimits.WASPADA} cm (Aman)</span> | 
              <span className="font-semibold text-yellow-600 ml-2">{waterLevelLimits.WASPADA}-{waterLevelLimits.BAHAYA} cm (Waspada)</span> | 
              <span className="font-semibold text-red-600 ml-2">&gt; {waterLevelLimits.BAHAYA} cm (Bahaya)</span>
            </div>
            <Button
              onClick={saveWaterLevelLimits}
              disabled={savingThreshold}
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              {savingThreshold ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Threshold
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Rainfall Intensity Threshold Configuration */}
      <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CloudRain className="w-5 h-5 text-indigo-600" />
            <CardTitle className="text-indigo-900">Rainfall Intensity Threshold Configuration</CardTitle>
          </div>
          <p className="text-sm text-indigo-600 mt-1">
            Configure rainfall intensity levels based on BMKG standards (mm/hour)
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Light Rain (RINGAN) mm/hour
              </label>
              <Input
                type="number"
                value={rainfallLimits.RINGAN}
                onChange={(e) => setRainfallLimits({
                  ...rainfallLimits,
                  RINGAN: Number(e.target.value)
                })}
                className="border-green-300 focus:border-green-500"
                placeholder="e.g., 5"
              />
              <p className="text-xs text-gray-500 mt-1">BMKG: 1.0-5.0 mm/hour</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Moderate Rain (SEDANG) mm/hour
              </label>
              <Input
                type="number"
                value={rainfallLimits.SEDANG}
                onChange={(e) => setRainfallLimits({
                  ...rainfallLimits,
                  SEDANG: Number(e.target.value)
                })}
                className="border-yellow-300 focus:border-yellow-500"
                placeholder="e.g., 10"
              />
              <p className="text-xs text-gray-500 mt-1">BMKG: 5.0-10 mm/hour</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Heavy Rain (LEBAT) mm/hour
              </label>
              <Input
                type="number"
                value={rainfallLimits.LEBAT}
                onChange={(e) => setRainfallLimits({
                  ...rainfallLimits,
                  LEBAT: Number(e.target.value)
                })}
                className="border-red-300 focus:border-red-500"
                placeholder="e.g., 20"
              />
              <p className="text-xs text-gray-500 mt-1">BMKG: 10-20 mm/hour</p>
            </div>
          </div>

          <div className="p-4 bg-white rounded-lg border border-indigo-200">
            <p className="text-sm font-medium text-gray-700 mb-2">Current Settings:</p>
            <div className="flex flex-wrap gap-3">
              <Badge className="bg-green-100 text-green-800 border-green-300">
                Light: &lt; {rainfallLimits.RINGAN} mm/h
              </Badge>
              <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                Moderate: {rainfallLimits.RINGAN}-{rainfallLimits.SEDANG} mm/h
              </Badge>
              <Badge className="bg-orange-100 text-orange-800 border-orange-300">
                Heavy: {rainfallLimits.SEDANG}-{rainfallLimits.LEBAT} mm/h
              </Badge>
              <Badge className="bg-red-100 text-red-800 border-red-300">
                Very Heavy: &gt; {rainfallLimits.LEBAT} mm/h
              </Badge>
            </div>
          </div>

          <div className="flex justify-end">
            <Button 
              onClick={saveRainfallLimits}
              disabled={savingRainfall}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {savingRainfall ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Threshold
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Devices List */}
      <Card>
        <CardHeader>
          <CardTitle>Device List</CardTitle>
          <CardDescription>Toggle to make devices visible on the public map</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {devices.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No devices found</p>
            ) : (
              devices.map(device => {
                const isPublic = isDevicePublic(device.id);
                const isUpdating = updatingDeviceId === device.id;

                return (
                  <div
                    key={device.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        {device.name}
                        {isPublic && (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                            <Eye className="w-3 h-3 mr-1" />
                            Public
                          </Badge>
                        )}
                        {!isPublic && (
                          <Badge variant="outline" className="text-gray-600">
                            <EyeOff className="w-3 h-3 mr-1" />
                            Private
                          </Badge>
                        )}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {device.description || 'No description'}
                      </p>
                      <div className="flex gap-3 mt-2 text-xs text-gray-500">
                        {device.type && <span>Type: {device.type}</span>}
                        {device.location && <span>Location: {device.location}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <Button
                        onClick={() => togglePublicAccess(device)}
                        disabled={isUpdating}
                        variant={isPublic ? 'default' : 'outline'}
                        size="sm"
                        className="ml-4"
                      >
                        {isUpdating ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Updating...
                          </>
                        ) : isPublic ? (
                          <>
                            <EyeOff className="w-4 h-4 mr-2" />
                            Make Private
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4 mr-2" />
                            Make Public
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50">
        <CardHeader>
          <CardTitle className="text-base">How it works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-700">
          <p>
            <strong>Public devices</strong> will be displayed on the public map accessible to anyone without authentication.
          </p>
          <p>
            <strong>Private devices</strong> are only visible to authenticated users with proper access permissions.
          </p>
          <p>
            Changes take effect immediately. The public map will automatically update to show only devices marked as public.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PublicAccess;
