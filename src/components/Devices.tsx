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
import DeviceDetails from './DeviceDetails';
import DeviceEdit from './DeviceEdit';
import DeviceMap from './DeviceMap';
import DevicePagination from './DevicePagination';
import ErrorBoundary from './ErrorBoundary';

const Devices = () => {
  const [devices, setDevices] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userRole, setUserRole] = useState('user');
  const [newDevice, setNewDevice] = useState({
    name: '',
    type: '',
    location: '',
    serial: '',
    mac: '',
    description: ''
  });

  const { toast } = useToast();
  const deviceTypes = ['Temperature', 'Humidity', 'Controller', 'Sensor', 'Gateway'];
  const itemsPerPage = 5;

  // Calculate pagination
  const totalPages = Math.ceil(devices.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentDevices = devices.slice(startIndex, endIndex);

  // Fetch user role and devices on component mount
  useEffect(() => {
    fetchUserRole();
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
      console.log('User role in devices:', userRole);

      let data;
      if (userRole === 'superadmin' || userRole === 'admin') {
        // Admin and superadmin can see all devices
        const { data: allDevices, error } = await supabase
          .from('devices')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        data = allDevices;
        console.log('Admin devices:', data);
      } else {
        // Regular users can only see devices they have access to
        const { data: accessData, error } = await supabase
          .from('user_device_access')
          .select(`
            devices!user_device_access_device_id_fkey(*)
          `)
          .eq('user_id', user.id);

        if (error) {
          console.error('Error fetching user device access in devices:', error);
          throw error;
        }

        console.log('User device access in devices:', accessData);
        data = accessData?.map(access => access.devices).filter(device => device !== null) || [];
        console.log('User accessible devices in devices page:', data);
      }

      setDevices(data || []);
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

  const refreshDeviceStatus = async () => {
    try {
      setRefreshing(true);
      console.log('Manual refresh device status...');
      
      const { data, error } = await supabase.functions.invoke('update-device-status');
      
      if (error) {
        console.error('Error updating device status:', error);
        toast({
          title: "Error",
          description: "Gagal update status device",
          variant: "destructive",
        });
      } else {
        console.log('Device status updated:', data);
        
        // Refresh device list after status update
        await fetchDevices();
        
        toast({
          title: "Status Updated",
          description: `Updated ${data?.offline_count || 0} offline dan ${data?.online_count || 0} online devices`,
        });
      }
    } catch (error) {
      console.error('Error refreshing device status:', error);
      toast({
        title: "Error",
        description: "Gagal refresh status device",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleAddDevice = async () => {
    if (!newDevice.name || !newDevice.type || !newDevice.location || !newDevice.serial || !newDevice.mac) {
      toast({
        title: "Error",
        description: "Semua field wajib diisi",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('devices')
        .insert({
          name: newDevice.name,
          type: newDevice.type,
          location: newDevice.location,
          serial: newDevice.serial,
          mac: newDevice.mac,
          description: newDevice.description,
          status: 'offline',
          battery: 100
        })
        .select();

      if (error) {
        throw error;
      }

      setDevices([data[0], ...devices]);
      setNewDevice({ name: '', type: '', location: '', serial: '', mac: '', description: '' });
      setIsAddDialogOpen(false);
      
      toast({
        title: "Device Berhasil Ditambahkan",
        description: `${newDevice.name} telah ditambahkan ke sistem`,
      });
    } catch (error) {
      console.error('Error adding device:', error);
      toast({
        title: "Error",
        description: "Failed to add device",
        variant: "destructive",
      });
    }
  };

  const handleViewDetails = (device) => {
    setSelectedDevice(device);
    setIsDetailsOpen(true);
  };

  const handleEdit = (device) => {
    setSelectedDevice(device);
    setIsEditOpen(true);
  };

  const handleDeviceUpdate = (updatedDevice) => {
    setDevices(devices.map(device => 
      device.id === updatedDevice.id ? updatedDevice : device
    ));
    fetchDevices(); // Refetch to ensure we have the latest data
  };

  const canManageDevices = userRole === 'admin' || userRole === 'superadmin';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Devices</h1>
          <p className="text-gray-600">
            Kelola dan pantau semua IoT device Anda
            {!canManageDevices && <span className="text-blue-600"> (View Only - Akses Terbatas)</span>}
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={refreshDeviceStatus}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh Status'}
          </Button>
          
          {canManageDevices && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  + Register Device
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Register New Device</DialogTitle>
                  <DialogDescription>
                    Masukkan detail device IoT baru Anda
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="deviceName">Device Name</Label>
                      <Input
                        id="deviceName"
                        placeholder="Temperature Sensor 1"
                        value={newDevice.name}
                        onChange={(e) => setNewDevice({...newDevice, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="deviceType">Device Type</Label>
                      <Select value={newDevice.type} onValueChange={(value) => setNewDevice({...newDevice, type: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a device type" />
                        </SelectTrigger>
                        <SelectContent>
                          {deviceTypes.map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="location">Location</Label>
                      <Input
                        id="location"
                        placeholder="Building A, Room 101"
                        value={newDevice.location}
                        onChange={(e) => setNewDevice({...newDevice, location: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="serial">Serial Number</Label>
                      <Input
                        id="serial"
                        placeholder="SN12345678"
                        value={newDevice.serial}
                        onChange={(e) => setNewDevice({...newDevice, serial: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="mac">MAC Address</Label>
                    <Input
                      id="mac"
                      placeholder="XX:XX:XX:XX:XX:XX"
                      value={newDevice.mac}
                      onChange={(e) => setNewDevice({...newDevice, mac: e.target.value})}
                    />
                    <p className="text-xs text-gray-500">Format: XX:XX:XX:XX:XX:XX</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea
                      id="description"
                      placeholder="Enter description or notes about this device"
                      value={newDevice.description}
                      onChange={(e) => setNewDevice({...newDevice, description: e.target.value})}
                      rows={3}
                    />
                  </div>
                  
                  <Button onClick={handleAddDevice} className="w-full">
                    Register Device
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Device Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {canManageDevices ? 'Total Devices' : 'Accessible Devices'}
            </CardTitle>
            <span className="text-2xl">📱</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{devices.length}</div>
            <p className="text-xs text-gray-500">
              {canManageDevices ? 'Semua device terdaftar' : 'Device yang dapat diakses'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Online Devices</CardTitle>
            <span className="text-2xl">🟢</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{devices.filter(d => d.status === 'online').length}</div>
            <p className="text-xs text-gray-500">Device aktif saat ini</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offline Devices</CardTitle>
            <span className="text-2xl">🔴</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{devices.filter(d => d.status === 'offline').length}</div>
            <p className="text-xs text-gray-500">Device tidak aktif</p>
          </CardContent>
        </Card>
      </div>

      {/* Map Component */}
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

      {/* Device List */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Device</CardTitle>
          <CardDescription>
            {canManageDevices 
              ? 'Kelola semua device IoT yang terdaftar'
              : 'Lihat device IoT yang dapat diakses'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <p>Loading devices...</p>
            </div>
          ) : devices.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-center">
              <div>
                <p className="text-gray-500 mb-2">No devices found</p>
                <p className="text-sm text-gray-400">
                  {canManageDevices 
                    ? "Click on '+ Register Device' to add your first device"
                    : "Belum ada device yang diberi akses. Hubungi admin untuk mendapatkan akses."
                  }
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {currentDevices.map((device) => (
                <div key={device.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="font-semibold text-gray-900">{device.name}</h3>
                      <Badge variant={device.status === 'online' ? 'default' : 'destructive'}>
                        {device.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Device ID:</span> 
                        <span className="font-mono text-xs block">{device.id}</span>
                      </div>
                      <div>
                        <span className="font-medium">Type:</span> {device.type}
                      </div>
                      <div>
                        <span className="font-medium">Location:</span> {device.location}
                      </div>
                      <div>
                        <span className="font-medium">Serial:</span> {device.serial}
                      </div>
                      <div>
                        <span className="font-medium">Battery:</span> {device.battery}%
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      MAC: {device.mac}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleViewDetails(device)}>
                      View Details
                    </Button>
                    {canManageDevices && (
                      <Button variant="outline" size="sm" onClick={() => handleEdit(device)}>
                        Edit
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

      {/* Device Details Dialog */}
      <DeviceDetails 
        device={selectedDevice} 
        open={isDetailsOpen} 
        onOpenChange={setIsDetailsOpen} 
        onEdit={canManageDevices ? handleEdit : null}
      />

      {/* Device Edit Dialog */}
      {canManageDevices && (
        <DeviceEdit 
          device={selectedDevice} 
          open={isEditOpen} 
          onOpenChange={setIsEditOpen}
          onDeviceUpdate={handleDeviceUpdate}
        />
      )}
    </div>
  );
};

export default Devices;
