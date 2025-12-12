import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Trash2, Plus, Activity } from 'lucide-react';
import DevicePagination from './DevicePagination';

const Sensors = () => {
  const [sensors, setSensors] = useState([]);
  const [devices, setDevices] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('user');
  const [newSensor, setNewSensor] = useState({
    device_id: '',
    name: '',
    type: '',
    unit: '',
    min_value: '',
    max_value: '',
    description: ''
  });

  const { toast } = useToast();
  const itemsPerPage = 5;
  
  // Calculate pagination
  const totalPages = Math.ceil(sensors.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentSensors = sensors.slice(startIndex, endIndex);
  
  const sensorTypes = [
    // Environmental Sensors
    'Temperature',
    'Humidity',
    'Pressure',
    
    // Air Quality Sensors
    'CO2',
    'O2',
    'Light',
    
    // Weather Sensors
    'Curah Hujan',
    'Kecepatan Angin',
    'Arah Angin',
    
    // Water Quality
    'pH',
    // Water Level
    'Ketinggian Air',
    
    // Power Management
    'Battery'
  ];

  const units = {
    'Temperature': ['°C', '°F', 'K'],
    'Humidity': ['%'],
    'Pressure': ['hPa', 'bar', 'mmHg'],
    'Light': ['lux'],
    'CO2': ['ppm'],
    'O2': ['%'],
    'pH': ['pH'],
    'Ketinggian Air': ['cm'],
    'Battery': ['%'],
    'Curah Hujan': ['mm'],
    'Kecepatan Angin': ['m/s', 'km/h'],
    'Arah Angin': ['°', 'N/S/E/W']
  };

  useEffect(() => {
    fetchUserRole();
    fetchSensors();
    fetchDevices();
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
          .order('name');

        if (error) throw error;
        data = allDevices;
      } else {
        const { data: accessibleDevices, error } = await supabase
          .from('user_device_access')
          .select(`
            device_id,
            devices!inner(*)
          `)
          .eq('user_id', user.id);

        if (error) throw error;
        data = accessibleDevices.map(access => access.devices);
      }

      setDevices(data || []);
    } catch (error) {
      console.error('Error fetching devices:', error);
    }
  };

  const fetchSensors = async () => {
    try {
      setLoading(true);
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
        const { data: allSensors, error } = await supabase
          .from('sensors')
          .select(`
            *,
            devices(name, location)
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;
        data = allSensors;
      } else {
        const { data: accessibleDevices, error: devicesError } = await supabase
          .from('user_device_access')
          .select('device_id')
          .eq('user_id', user.id);

        if (devicesError) throw devicesError;

        const deviceIds = accessibleDevices.map(access => access.device_id);

        if (deviceIds.length > 0) {
          const { data: sensors, error } = await supabase
            .from('sensors')
            .select(`
              *,
              devices(name, location)
            `)
            .in('device_id', deviceIds)
            .order('created_at', { ascending: false });

          if (error) throw error;
          data = sensors;
        } else {
          data = [];
        }
      }

      setSensors(data || []);
    } catch (error) {
      console.error('Error fetching sensors:', error);
      toast({
        title: "Error",
        description: "Failed to fetch sensors",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddSensor = async () => {
    if (!newSensor.device_id || !newSensor.name || !newSensor.type || !newSensor.unit) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const sensorData: any = {
        device_id: newSensor.device_id,
        name: newSensor.name,
        type: newSensor.type,
        unit: newSensor.unit,
        description: newSensor.description,
        is_active: true
      };

      if (newSensor.min_value) {
        sensorData.min_value = parseFloat(newSensor.min_value);
      }
      if (newSensor.max_value) {
        sensorData.max_value = parseFloat(newSensor.max_value);
      }

      const { data, error } = await supabase
        .from('sensors')
        .insert(sensorData)
        .select();

      if (error) throw error;

      fetchSensors();
      setNewSensor({
        device_id: '',
        name: '',
        type: '',
        unit: '',
        min_value: '',
        max_value: '',
        description: ''
      });
      setIsAddDialogOpen(false);
      
      toast({
        title: "Sensor Added",
        description: `${newSensor.name} has been added successfully`,
      });
    } catch (error) {
      console.error('Error adding sensor:', error);
      toast({
        title: "Error",
        description: "Failed to add sensor",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSensor = async (sensorId) => {
    try {
      const { error } = await supabase
        .from('sensors')
        .delete()
        .eq('id', sensorId);

      if (error) throw error;

      fetchSensors();
      toast({
        title: "Sensor Deleted",
        description: "Sensor has been removed successfully",
      });
    } catch (error) {
      console.error('Error deleting sensor:', error);
      toast({
        title: "Error",
        description: "Failed to delete sensor",
        variant: "destructive",
      });
    }
  };

  const getDeviceName = (deviceId) => {
    const device = devices.find(d => d.id === deviceId);
    return device ? device.name : 'Unknown Device';
  };

  const canManageSensors = userRole === 'admin' || userRole === 'superadmin';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sensors</h1>
          <p className="text-gray-600">
            Kelola sensor-sensor yang terpasang pada device IoT
            {!canManageSensors && <span className="text-blue-600"> (View Only - Akses Terbatas)</span>}
          </p>
        </div>
        
        {canManageSensors && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Add Sensor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Sensor</DialogTitle>
                <DialogDescription>
                  Tambahkan sensor baru ke device yang sudah terdaftar
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="device">Device</Label>
                  <Select value={newSensor.device_id} onValueChange={(value) => setNewSensor({...newSensor, device_id: value})}>
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sensorName">Sensor Name</Label>
                    <Input
                      id="sensorName"
                      placeholder="Temperature Sensor"
                      value={newSensor.name}
                      onChange={(e) => setNewSensor({...newSensor, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sensorType">Sensor Type</Label>
                    <Select value={newSensor.type} onValueChange={(value) => setNewSensor({...newSensor, type: value, unit: ''})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {sensorTypes.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="unit">Unit</Label>
                    <Select value={newSensor.unit} onValueChange={(value) => setNewSensor({...newSensor, unit: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {newSensor.type && units[newSensor.type]?.map((unit) => (
                          <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minValue">Min Value</Label>
                    <Input
                      id="minValue"
                      type="number"
                      placeholder="0"
                      value={newSensor.min_value}
                      onChange={(e) => setNewSensor({...newSensor, min_value: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxValue">Max Value</Label>
                    <Input
                      id="maxValue"
                      type="number"
                      placeholder="100"
                      value={newSensor.max_value}
                      onChange={(e) => setNewSensor({...newSensor, max_value: e.target.value})}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Description about this sensor"
                    value={newSensor.description}
                    onChange={(e) => setNewSensor({...newSensor, description: e.target.value})}
                    rows={3}
                  />
                </div>
                
                <Button onClick={handleAddSensor} className="w-full">
                  Add Sensor
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Sensor Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {canManageSensors ? 'Total Sensors' : 'Accessible Sensors'}
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sensors.length}</div>
            <p className="text-xs text-gray-500">
              {canManageSensors ? 'Sensor terdaftar' : 'Sensor yang dapat diakses'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sensors</CardTitle>
            <span className="text-2xl">🟢</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sensors.filter(s => s.is_active).length}</div>
            <p className="text-xs text-gray-500">Sensor aktif</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sensor Types</CardTitle>
            <span className="text-2xl">📊</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(sensors.map(s => s.type)).size}
            </div>
            <p className="text-xs text-gray-500">Jenis sensor berbeda</p>
          </CardContent>
        </Card>
      </div>

      {/* Sensor List */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Sensor</CardTitle>
          <CardDescription>
            {canManageSensors 
              ? 'Kelola semua sensor yang terdaftar pada device IoT'
              : 'Lihat sensor yang dapat diakses pada device IoT'
            }
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
                  {canManageSensors 
                    ? 'Add sensors to your devices to get started'
                    : 'Belum ada sensor yang dapat diakses. Hubungi admin untuk mendapatkan akses.'
                  }
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {currentSensors.map((sensor) => (
                <div key={sensor.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="font-semibold text-gray-900">{sensor.name}</h3>
                      <Badge variant={sensor.is_active ? 'default' : 'destructive'}>
                        {sensor.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge variant="outline">{sensor.type}</Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Sensor ID:</span>
                        <span className="font-mono text-xs block">{sensor.id}</span>
                      </div>
                      <div>
                        <span className="font-medium">Device:</span> {sensor.devices?.name || getDeviceName(sensor.device_id)}
                      </div>
                      <div>
                        <span className="font-medium">Unit:</span> {sensor.unit}
                      </div>
                      {sensor.min_value !== null && (
                        <div>
                          <span className="font-medium">Min:</span> {sensor.min_value}
                        </div>
                      )}
                      {sensor.max_value !== null && (
                        <div>
                          <span className="font-medium">Max:</span> {sensor.max_value}
                        </div>
                      )}
                    </div>
                    {sensor.description && (
                      <div className="mt-2 text-sm text-gray-500">
                        {sensor.description}
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    {canManageSensors && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleDeleteSensor(sensor.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              
              <DevicePagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Sensors;
