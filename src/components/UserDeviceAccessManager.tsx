// src/components/UserDeviceAccessManager.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label'; // Pastikan Label sudah diimpor
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2 } from 'lucide-react';
import { User } from '@supabase/supabase-js';

// Tipe data untuk dropdown dan tabel
interface ProfileMin {
  id: string;
  username: string | null;
}

interface DeviceMin {
  id: string;
  name: string | null;
  location: string | null;
}

interface UserDeviceAccessEntry {
  id: string;
  created_at: string;
  user_id: string;
  device_id: string;
  granted_by: string;
  // Objek ini akan diisi oleh hasil join Supabase
  // Jika join berhasil, 'profiles' akan berisi objek ProfileMin
  // Jika tidak, 'profiles' akan null atau tidak ada (tergantung bagaimana Supabase mengembalikan jika join gagal sebagian)
  profiles: ProfileMin | null; 
  devices: DeviceMin | null;
}

const UserDeviceAccessManager = () => {
  const [usersForDropdown, setUsersForDropdown] = useState<ProfileMin[]>([]);
  const [devicesForDropdown, setDevicesForDropdown] = useState<DeviceMin[]>([]);
  const [userAccessList, setUserAccessList] = useState<UserDeviceAccessEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedDevice, setSelectedDevice] = useState('');
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);

  const { toast } = useToast();

    const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch users (profiles) untuk dropdown "Grant Access"
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, username')
        .order('username');

      if (usersError) {
        console.error('Users fetch error (for dropdown):', usersError);
        toast({ title: 'Error', description: `Gagal memuat data user: ${usersError.message}`, variant: 'destructive' });
      } else {
        setUsersForDropdown(usersData || []);
      }

      // Fetch devices untuk dropdown "Grant Access"
      const { data: devicesData, error: devicesError } = await supabase
        .from('devices')
        .select('id, name, location')
        .order('name');

      if (devicesError) {
        console.error('Devices fetch error (for dropdown):', devicesError);
        toast({ title: 'Error', description: `Gagal memuat data device: ${devicesError.message}`, variant: 'destructive' });
      } else {
        setDevicesForDropdown(devicesData || []);
      }

      // Fetch user_device_access data dengan join
      console.log('Fetching user_device_access data with explicit joins...');
      const { data: accessDataResult, error: accessError } = await supabase
        .from('user_device_access')
        .select(`
          id,
          created_at,
          user_id,
          device_id,
          granted_by,
          profiles ( id, username ),
          devices ( id, name, location )
        `)
        .order('created_at', { ascending: false });

      if (accessError) {
        console.error('Access data fetch error:', accessError);
        toast({
            title: 'Error Fetching Access Data',
            description: `Pesan: ${accessError.message}. Detail: ${accessError.details || ''}. Hint: ${accessError.hint || ''}`,
            variant: 'destructive',
        });
        setUserAccessList([]);
      } else {
        console.log('Access data fetched (JOINED):', accessDataResult);
        setUserAccessList(accessDataResult as UserDeviceAccessEntry[] || []);
      }
    } catch (error: any) {
      console.error('Error in fetchData function:', error);
      toast({ title: 'Error', description: error.message || 'Gagal memuat data. Silakan coba lagi.', variant: 'destructive'});
      setUserAccessList([]);
    } finally {
      setLoading(false);
    }
  }, [toast]); // toast ditambahkan sebagai dependensi useCallback

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setLoggedInUser(user);
      await fetchData();
    };
    fetchInitialData();
  }, [fetchData]);


  const handleGrantAccess = async () => {
    if (!selectedUser || !selectedDevice) {
      toast({ title: 'Error', description: 'Pilih user dan device terlebih dahulu', variant: 'destructive' });
      return;
    }
    if (!loggedInUser) {
      toast({ title: 'Error', description: 'User tidak terautentikasi. Silakan login ulang.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      // Insert data baru
      const { data: insertedData, error: insertError } = await supabase
        .from('user_device_access')
        .insert({
          user_id: selectedUser,
          device_id: selectedDevice,
          granted_by: loggedInUser.id,
        })
        .select('id') // Hanya select id untuk konfirmasi insert
        .single();

      if (insertError) {
        console.error('Grant access insert error:', insertError);
        if (insertError.code === '23505') { 
          toast({ title: 'Error', description: 'User sudah memiliki akses ke device ini.', variant: 'destructive' });
        } else {
          toast({ title: 'Error', description: `Gagal memberikan akses: ${insertError.message}`, variant: 'destructive' });
        }
      } else if (insertedData) {
        // Jika insert berhasil, panggil fetchData() untuk refresh seluruh list dengan data yang benar dari database
        // Ini memastikan data yang ditampilkan konsisten dengan database setelah join
        await fetchData(); 
        toast({ title: 'Berhasil', description: 'Akses device berhasil diberikan.' });
        setSelectedUser('');
        setSelectedDevice('');
        setIsAddDialogOpen(false);
      }
    } catch (error: any) {
      console.error('Error granting access:', error);
      toast({ title: 'Error', description: `Gagal memberikan akses: ${error.message}`, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeAccess = async (accessId: string) => {
    if (!confirm('Apakah Anda yakin ingin mencabut akses device ini?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_device_access')
        .delete()
        .eq('id', accessId);

      if (error) throw error;

      // Update state secara lokal atau panggil fetchData() untuk konsistensi
      setUserAccessList(prevAccess => prevAccess.filter(access => access.id !== accessId));
      toast({ title: 'Berhasil', description: 'Akses device berhasil dicabut.' });
    } catch (error: any) {
      console.error('Error revoking access:', error);
      toast({ title: 'Error', description: `Gagal mencabut akses: ${error.message}`, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (loading && userAccessList.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>User Device Access Management</CardTitle></CardHeader>
        <CardContent><p>Memuat data akses device...</p></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>User Device Access Management</CardTitle>
            <CardDescription>Kelola akses user ke device tertentu</CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={loading}><Plus className="w-4 h-4 mr-2" />Grant Access</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Grant Device Access</DialogTitle>
                <DialogDescription>Berikan akses user ke device tertentu</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="select-user-grant-modal">User</Label>
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger id="select-user-grant-modal"><SelectValue placeholder="Pilih user" /></SelectTrigger>
                    <SelectContent>
                      {usersForDropdown.map((userItem) => (
                        <SelectItem key={userItem.id} value={userItem.id}>
                          {userItem.username || `User ID: ${userItem.id.substring(0,8)}...`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="select-device-grant-modal">Device</Label>
                  <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                    <SelectTrigger id="select-device-grant-modal"><SelectValue placeholder="Pilih device" /></SelectTrigger>
                    <SelectContent>
                      {devicesForDropdown.map((deviceItem) => (
                        <SelectItem key={deviceItem.id} value={deviceItem.id}>
                          {deviceItem.name || 'Unnamed Device'} - {deviceItem.location || 'No Location'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleGrantAccess} className="w-full" disabled={loading}>
                  {loading ? 'Processing...' : 'Grant Access'}
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
              {userAccessList.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                    Belum ada akses device yang diberikan.
                  </TableCell>
                </TableRow>
              ) : (
                userAccessList.map((access) => (
                  <TableRow key={access.id}>
                    <TableCell>
                      {/* Akses data join dari profiles */}
                      {access.profiles?.username || `User ID: ${access.user_id.substring(0,8)}...`}
                    </TableCell>
                    <TableCell>
                      {/* Akses data join dari devices */}
                      {access.devices?.name || 'Unknown Device'}
                      {access.devices?.location && (
                        <div className="text-sm text-gray-500">
                          {access.devices.location}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(access.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRevokeAccess(access.id)}
                        disabled={loading}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Catatan Penting</h4>
          <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
            <li>Admin dan Superadmin diasumsikan memiliki akses ke semua device (pengaturan RLS mungkin diperlukan di database untuk memastikan ini).</li>
            <li>User biasa hanya dapat mengakses device yang telah diberikan izin secara eksplisit melalui tabel ini.</li>
            <li>Akses dapat dicabut kapan saja.</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default UserDeviceAccessManager;