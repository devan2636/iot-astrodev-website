
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { UserPlus, Trash2, Key, RefreshCw } from 'lucide-react';

type UserRole = 'admin' | 'superadmin' | 'user';

interface NewUserState {
  email: string;
  password: string;
  role: UserRole;
}

const SuperAdminAccountManager = () => {
  const [adminUsers, setAdminUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState<NewUserState>({
    email: '',
    password: '',
    role: 'admin'
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchAdminUsers();
  }, []);

  const fetchAdminUsers = async () => {
    try {
      setLoading(true);
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['admin', 'superadmin'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAdminUsers(profiles || []);
    } catch (error) {
      console.error('Error fetching admin users:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch admin users',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdminUser = async () => {
    if (!newUser.email || !newUser.password) {
      toast({
        title: 'Error',
        description: 'Email dan password harus diisi',
        variant: 'destructive',
      });
      return;
    }

    try {
      setCreating(true);
      
      // Create user using signUp instead of admin API
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
        options: {
          data: {
            role: newUser.role
          }
        }
      });

      if (authError) throw authError;

      // If user is created, update the profile directly
      if (authData.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({ 
            id: authData.user.id,
            role: newUser.role,
            username: newUser.email.split('@')[0],
            updated_at: new Date().toISOString()
          });

        if (profileError) throw profileError;
      }

      toast({
        title: 'Berhasil',
        description: `Akun ${newUser.role === 'superadmin' ? 'Superadmin' : 'Admin'} berhasil dibuat. User akan menerima email konfirmasi.`,
      });

      // Reset form
      setNewUser({ email: '', password: '', role: 'admin' });
      
      // Refresh list
      fetchAdminUsers();
    } catch (error) {
      console.error('Error creating admin user:', error);
      toast({
        title: 'Error',
        description: error.message || 'Gagal membuat akun admin',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus user ini?')) return;

    try {
      // Just delete from profiles table since we can't access auth.users with anon key
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: 'Berhasil',
        description: 'Profile user berhasil dihapus',
      });

      fetchAdminUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: 'Error',
        description: 'Gagal menghapus user',
        variant: 'destructive',
      });
    }
  };

  const handleResetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`
      });

      if (error) throw error;

      toast({
        title: 'Berhasil',
        description: 'Link reset password telah dikirim ke email.',
      });
    } catch (error) {
      console.error('Error resetting password:', error);
      toast({
        title: 'Error',
        description: 'Gagal mengirim link reset password',
        variant: 'destructive',
      });
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'superadmin':
        return 'bg-red-100 text-red-600';
      case 'admin':
        return 'bg-blue-100 text-blue-600';
      default:
        return 'bg-green-100 text-green-600';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Admin Account Management</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Create New Admin Account */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Create Admin Account
          </CardTitle>
          <CardDescription>
            Buat akun admin atau superadmin baru langsung dari dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter strong password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select 
                value={newUser.role} 
                onValueChange={(value: UserRole) => setNewUser({ ...newUser, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="superadmin">Superadmin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <Button onClick={handleCreateAdminUser} disabled={creating} className="w-full md:w-auto">
            {creating ? 'Creating...' : 'Create Account'}
          </Button>
        </CardContent>
      </Card>

      {/* Existing Admin Accounts */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Admin Accounts</CardTitle>
              <CardDescription>
                Kelola akun admin dan superadmin yang sudah ada
              </CardDescription>
            </div>
            <Button variant="outline" onClick={fetchAdminUsers}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adminUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.username || 'No username'}
                    </TableCell>
                    <TableCell>
                      <Badge className={getRoleBadgeColor(user.role)}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(user.created_at).toLocaleDateString('id-ID')}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResetPassword(user.username + '@example.com')}
                        >
                          <Key className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {adminUsers.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No admin accounts found
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Setup Guide */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Setup Guide</CardTitle>
          <CardDescription>
            Panduan cepat untuk membuat akun admin
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Membuat Akun Superadmin</h4>
            <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
              <li>Isi email dan password yang kuat</li>
              <li>Pilih role "Superadmin" dari dropdown</li>
              <li>Klik "Create Account"</li>
              <li>User akan menerima email konfirmasi untuk mengaktifkan akun</li>
            </ol>
          </div>
          
          <div className="bg-amber-50 p-4 rounded-lg">
            <h4 className="font-medium text-amber-900 mb-2">Reset Password</h4>
            <p className="text-sm text-amber-700">
              Jika lupa password, klik tombol key (🔑) pada akun yang ingin direset. 
              Link reset password akan dikirim ke email yang terdaftar.
            </p>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="font-medium text-green-900 mb-2">Catatan Penting</h4>
            <p className="text-sm text-green-700">
              Akun yang dibuat akan memerlukan konfirmasi email sebelum dapat digunakan. 
              Pastikan email yang digunakan valid dan dapat diakses.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperAdminAccountManager;
