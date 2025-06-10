
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2 } from 'lucide-react';

const UserDeviceAccessManager = () => {
  const [users, setUsers] = useState([]);
  const [devices, setDevices] = useState([]);
  const [userAccess, setUserAccess] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedDevice, setSelectedDevice] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch users (profiles) - only regular users
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'user')
        .order('username');

      if (usersError) {
        console.error('Users fetch error:', usersError);
      } else {
        console.log('Users data:', usersData);
        setUsers(usersData || []);
      }

      // Fetch devices
      const { data: devicesData, error: devicesError } = await supabase
        .from('devices')
        .select('*')
        .order('name');

      if (devicesError) {
        console.error('Devices fetch error:', devicesError);
      } else {
        console.log('Devices data:', devicesData);
        setDevices(devicesData || []);
      }

      // Fetch user device access with joins
      const { data: accessData, error: accessError } = await supabase
        .from('user_device_access')
        .select(`
          *,
          user_profile:profiles!user_device_access_user_id_fkey(
            id,
            username
          ),
          device:devices!user_device_access_device_id_fkey(
            id,
            name,
            location
          )
        `)
        .order('created_at', { ascending: false });

      if (accessError) {
        console.error('Access data fetch error:', accessError);
        setUserAccess([]);
      } else {
        console.log('Access data fetched:', accessData);
        setUserAccess(accessData || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Gagal memuat data. Silakan coba lagi.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGrantAccess = async () => {
    if (!selectedUser || !selectedDevice) {
      toast({
        title: 'Error',
        description: 'Pilih user dan device terlebih dahulu',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: 'Error',
          description: 'User tidak terautentikasi',
          variant: 'destructive',
        });
        return;
      }

      console.log('Granting access:', { selectedUser, selectedDevice, grantedBy: user.id });

      const { data, error } = await supabase
        .from('user_device_access')
        .insert({
          user_id: selectedUser,
          device_id: selectedDevice,
          granted_by: user.id
        })
        .select();

      if (error) {
        console.error('Grant access error:', error);
        if (error.code === '23505') {
          toast({
            title: 'Error',
            description: 'User sudah memiliki akses ke device ini',
            variant: 'destructive',
          });
        } else {
          throw error;
        }
        return;
      }

      console.log('Access granted successfully:', data);
      
      // Refresh data after successful insert
      await fetchData();
      setSelectedUser('');
      setSelectedDevice('');
      setIsAddDialogOpen(false);
      
      toast({
        title: 'Berhasil',
        description: 'Akses device berhasil diberikan',
      });
    } catch (error) {
      console.error('Error granting access:', error);
      toast({
        title: 'Error',
        description: 'Gagal memberikan akses device',
        variant: 'destructive',
      });
    }
  };

  const handleRevokeAccess = async (accessId) => {
    try {
      console.log('Revoking access for ID:', accessId);
      
      const { error } = await supabase
        .from('user_device_access')
        .delete()
        .eq('id', accessId);

      if (error) {
        console.error('Revoke access error:', error);
        throw error;
      }

      console.log('Access revoked successfully');
      
      // Refresh data after successful delete
      await fetchData();
      toast({
        title: 'Berhasil',
        description: 'Akses device berhasil dicabut',
      });
    } catch (error) {
      console.error('Error revoking access:', error);
      toast({
        title: 'Error',
        description: 'Gagal mencabut akses device',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>User Device Access Management</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>User Device Access Management</CardTitle>
            <CardDescription>
              Kelola akses user ke device tertentu
            </CardDescription>
          </div>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Grant Access
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Grant Device Access</DialogTitle>
                <DialogDescription>
                  Berikan akses user ke device tertentu
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">User</label>
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.username || 'No username'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Device</label>
                  <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih device" />
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
                
                <Button onClick={handleGrantAccess} className="w-full">
                  Grant Access
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Granted Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {userAccess.map((access) => (
                <TableRow key={access.id}>
                  <TableCell>
                    {access.user_profile?.username || 'Unknown User'}
                  </TableCell>
                  <TableCell>
                    {access.device?.name || 'Unknown Device'}
                    {access.device?.location && (
                      <div className="text-sm text-gray-500">
                        {access.device.location}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(access.created_at).toLocaleDateString('id-ID')}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRevokeAccess(access.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {userAccess.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Belum ada akses device yang diberikan
          </div>
        )}

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Catatan Penting</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <p>• Admin dan Superadmin memiliki akses ke semua device secara otomatis</p>
            <p>• User biasa hanya dapat mengakses device yang telah diberikan izin</p>
            <p>• Akses dapat dicabut kapan saja oleh Superadmin</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default UserDeviceAccessManager;
