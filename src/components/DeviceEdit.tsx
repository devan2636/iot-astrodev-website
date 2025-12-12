
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const DeviceEdit = ({ device, open, onOpenChange, onDeviceUpdate }) => {
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    location: '',
    serial: '',
    mac: '',
    status: '',
    battery: 0,
    description: '',
    latitude: '', // TAMBAHKAN INI
    longitude: '', // TAMBAHKAN INI
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const deviceTypes = ['Temperature', 'Humidity', 'Controller', 'Sensor', 'Gateway'];

  useEffect(() => {
    if (device) {
      setFormData({
        name: device.name || '',
        type: device.type || '',
        location: device.location || '',
        serial: device.serial || '',
        mac: device.mac || '',
        status: device.status || 'offline',
        battery: device.battery || 0,
        description: device.description || '',
        // Ubah nilai null/undefined menjadi string kosong, angka menjadi string
        latitude: device.latitude === null || device.latitude === undefined ? '' : String(device.latitude),
        longitude: device.longitude === null || device.longitude === undefined ? '' : String(device.longitude),
      });
    }
  }, [device]);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSelectChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.type || !formData.location || !formData.serial || !formData.mac) {
      toast({
        title: "Error",
        // description: "All required fields must be filled",
        description: "Semua field yang wajib (selain deskripsi, latitude, longitude) harus diisi",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      let lat: number | null = null;
      if (formData.latitude !== '') {
        const parsedLat = parseFloat(formData.latitude);
        if (isNaN(parsedLat)) {
          toast({ title: "Error", description: "Nilai Latitude tidak valid. Masukkan angka atau kosongkan.", variant: "destructive" });
          setLoading(false);
          return;
        }
        lat = parsedLat;
      }

      let lon: number | null = null;
      if (formData.longitude !== '') {
        const parsedLon = parseFloat(formData.longitude);
        if (isNaN(parsedLon)) {
          toast({ title: "Error", description: "Nilai Longitude tidak valid. Masukkan angka atau kosongkan.", variant: "destructive" });
          setLoading(false);
          return;
        }
        lon = parsedLon;
      }

      const batteryLevel = parseInt(String(formData.battery), 10);
      if (isNaN(batteryLevel) || batteryLevel < 0 || batteryLevel > 100) {
        toast({ title: "Error", description: "Level Baterai tidak valid. Harus antara 0 dan 100.", variant: "destructive" });
        setLoading(false);
        return;
      }

      const updatePayload = {
        name: formData.name,
        type: formData.type,
        location: formData.location,
        serial: formData.serial,
        mac: formData.mac,
        status: formData.status,
        battery: batteryLevel,
        description: formData.description,
        latitude: lat, // Gunakan nilai yang sudah diparsing
        longitude: lon, // Gunakan nilai yang sudah diparsing
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('devices')
        .update(updatePayload)
        .eq('id', device.id)
        .select();

      if (error) {
        throw error;
      }

      toast({
        title: "Device Updated",
        description: `${formData.name} has been updated successfully`,
      });
      
      onOpenChange(false);
      onDeviceUpdate(data[0]);
    } catch (error) {
      console.error('Error updating device:', error);
      toast({
        title: "Error",
        description: "Failed to update device",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Device</DialogTitle>
          <DialogDescription>Update the details for this device</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2"> {/* Tambahkan max-height dan overflow */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Device Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Temperature Sensor 1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Device Type</Label>
              <Select 
                value={formData.type} 
                onValueChange={(value) => handleSelectChange('type', value)}
              >
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
                value={formData.location}
                onChange={handleChange}
                placeholder="Building A, Room 101"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="serial">Serial Number</Label>
              <Input
                id="serial"
                value={formData.serial}
                onChange={handleChange}
                placeholder="SN12345678"
              />
            </div>
          </div>

          {/* TAMBAHKAN INPUT LATITUDE DAN LONGITUDE DI SINI */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="latitude">Latitude</Label>
              <Input id="latitude" type="number" step="any" value={formData.latitude} onChange={handleChange} placeholder="e.g., -6.2088"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="longitude">Longitude</Label>
              <Input id="longitude" type="number" step="any" value={formData.longitude} onChange={handleChange} placeholder="e.g., 106.8456"/>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mac">MAC Address</Label>
              <Input
                id="mac"
                value={formData.mac}
                onChange={handleChange}
                placeholder="XX:XX:XX:XX:XX:XX"
              />
              <p className="text-xs text-gray-500">Format: XX:XX:XX:XX:XX:XX</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value) => handleSelectChange('status', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="battery">Battery Level (%)</Label>
            <Input
              id="battery"
              type="number"
              min="0"
              max="100"
              value={formData.battery}
              onChange={handleChange}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Enter description or notes about this device"
              rows={3}
            />
          </div>
        </div>
        
        <div className="flex justify-between mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Updating...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeviceEdit;
