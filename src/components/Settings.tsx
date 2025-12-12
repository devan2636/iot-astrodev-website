import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Bot, Waves, ExternalLink, Smartphone, Signal } from 'lucide-react'; // Import icons baru

import AdminUserTable from './AdminUserTable';
import UserDeviceAccessManager from './UserDeviceAccessManager';
import SuperAdminAccountManager from './SuperAdminAccountManager';
import ApiKeyManager from './ApiKeyManager';
// CommunicationProtocols di-hide/hapus sesuai request

interface SettingsProps {
  user: any;
}

const Settings = ({ user }: SettingsProps) => {
  const [userSettings, setUserSettings] = useState({
    username: '',
    email: '',
    role: 'user',
    autoUpdate: true,
  });

  const [passwordSettings, setPasswordSettings] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [isEditingPassword, setIsEditingPassword] = useState(false);

  const [apiSettings, setApiSettings] = useState({
    esp32ApiKey: '',
    supabaseUrl: '',
    supabaseKey: '',
    emailNotifications: true,
    whatsappNotifications: false,
  });

  const [userProfile, setUserProfile] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('user');
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchUserProfile();
      fetchUserSession();
    }
  }, [user]);

  const fetchUserSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      
      if (session?.user) {
        setUserSettings(prev => ({
          ...prev,
          email: session.user.email || ''
        }));
      }
    } catch (error) {
      console.error('Error fetching user session:', error);
    }
  };

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setUserProfile(data);
        setUserRole(data.role || 'user');
        setUserSettings(prev => ({
          ...prev,
          username: data.username || '',
          role: data.role || 'user'
        }));
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const handleSaveGeneral = async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          username: userSettings.username,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast({
        title: "Pengaturan Disimpan",
        description: "Pengaturan umum berhasil diperbarui",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: "Gagal menyimpan pengaturan",
        variant: "destructive",
      });
    }
  };

  const handleSaveApiKeys = () => {
    toast({
      title: "API Keys Disimpan",
      description: "Konfigurasi API berhasil diperbarui",
    });
  };

  const handleChangePassword = async () => {
    if (passwordSettings.newPassword !== passwordSettings.confirmPassword) {
      toast({
        title: "Error",
        description: "Password baru dan konfirmasi password tidak cocok",
        variant: "destructive",
      });
      return;
    }

    if (passwordSettings.newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password baru harus minimal 6 karakter",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordSettings.newPassword
      });

      if (error) throw error;

      setPasswordSettings({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });

      setIsEditingPassword(false);

      toast({
        title: "Password Berhasil Diubah",
        description: "Password Anda telah berhasil diperbarui",
      });
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast({
        title: "Error",
        description: error.message || "Gagal mengubah password",
        variant: "destructive",
      });
    }
  };

  const handleCancelPasswordEdit = () => {
    setPasswordSettings({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setIsEditingPassword(false);
  };

  const isSuperAdmin = userRole === 'superadmin';
  const isAdmin = userRole === 'admin' || userRole === 'superadmin';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Kelola pengaturan sistem IoT monitoring Anda</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className={`flex flex-wrap items-start gap-2 w-full ${isSuperAdmin ? 'md:grid md:grid-cols-7' : isAdmin ? 'md:grid md:grid-cols-4' : 'md:grid md:grid-cols-3'}`}>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="api">API Keys</TabsTrigger>
          {isAdmin && <TabsTrigger value="admin">Admin</TabsTrigger>}
          {isSuperAdmin && <TabsTrigger value="access">Device Access</TabsTrigger>}
          {isSuperAdmin && <TabsTrigger value="accounts">Account Management</TabsTrigger>}
          {isSuperAdmin && <TabsTrigger value="api-management">API Management</TabsTrigger>}
          {/* Protocols tab dihapus sesuai request */}
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Kelola pengaturan umum sistem monitoring IoT Anda</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={userSettings.username}
                    onChange={(e) => setUserSettings({...userSettings, username: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={userSettings.email}
                    disabled
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Input
                    id="role"
                    value={userRole}
                    disabled
                    className="capitalize"
                  />
                  <p className="text-sm text-gray-500">Role Anda saat ini dalam sistem</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-update Dashboard</Label>
                    <p className="text-sm text-gray-500">Perbarui data dashboard secara otomatis</p>
                  </div>
                  <Switch
                    checked={userSettings.autoUpdate}
                    onCheckedChange={(checked) => setUserSettings({...userSettings, autoUpdate: checked})}
                  />
                </div>
              </div>

              <Button onClick={handleSaveGeneral}>Save Changes</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Password Security</CardTitle>
              <CardDescription>Kelola keamanan password akun Anda</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!isEditingPassword ? (
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Password</h4>
                    <p className="text-sm text-gray-500">••••••••••••</p>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsEditingPassword(true)}
                  >
                    Edit Password
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <Input
                        id="currentPassword"
                        type="password"
                        placeholder="Masukkan password saat ini"
                        value={passwordSettings.currentPassword}
                        onChange={(e) => setPasswordSettings({...passwordSettings, currentPassword: e.target.value})}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        placeholder="Masukkan password baru (minimal 6 karakter)"
                        value={passwordSettings.newPassword}
                        onChange={(e) => setPasswordSettings({...passwordSettings, newPassword: e.target.value})}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="Konfirmasi password baru"
                        value={passwordSettings.confirmPassword}
                        onChange={(e) => setPasswordSettings({...passwordSettings, confirmPassword: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <h4 className="font-medium text-yellow-900 mb-2">Password Security Tips</h4>
                    <div className="text-sm text-yellow-700 space-y-1">
                      <p>• Gunakan minimal 6 karakter</p>
                      <p>• Kombinasikan huruf besar, kecil, angka, dan simbol</p>
                      <p>• Jangan gunakan informasi pribadi yang mudah ditebak</p>
                      <p>• Ubah password secara berkala untuk keamanan optimal</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={handleChangePassword}
                      disabled={!passwordSettings.currentPassword || !passwordSettings.newPassword || !passwordSettings.confirmPassword}
                    >
                      Save New Password
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={handleCancelPasswordEdit}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Telegram Notifications</CardTitle>
              <CardDescription>Gunakan bot Telegram berikut untuk menerima notifikasi realtime dari sistem</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* BOT 1: AstrodevIoT */}
                <div className="border rounded-xl p-5 bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                        <Bot className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Device & System Bot</h3>
                        <p className="text-sm text-blue-600 font-medium">@AstrodevIoT_bot</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3 mb-5">
                    <p className="text-sm text-gray-600">
                      Bot ini khusus memberikan notifikasi terkait kesehatan perangkat keras (Hardware):
                    </p>
                    <ul className="text-sm text-gray-500 space-y-1 list-disc pl-4">
                      <li>Status Sinyal / Konektivitas</li>
                      <li>Status Baterai & Power</li>
                      <li>Maintenance Alert</li>
                    </ul>
                  </div>

                  <Button 
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    onClick={() => window.open('https://t.me/AstrodevIoT_bot', '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Buka Bot di Telegram
                  </Button>
                </div>

                {/* BOT 2: PantauSungai */}
                <div className="border rounded-xl p-5 bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-cyan-100 rounded-lg text-cyan-600">
                        <Waves className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">River Monitoring Bot</h3>
                        <p className="text-sm text-cyan-600 font-medium">@PantauSungai_bot</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3 mb-5">
                    <p className="text-sm text-gray-600">
                      Bot ini fokus memberikan peringatan dini (Early Warning System) terkait kondisi sungai:
                    </p>
                    <ul className="text-sm text-gray-500 space-y-1 list-disc pl-4">
                      <li>Status Level Air (Waspada/Bahaya)</li>
                      <li>Data Curah Hujan Realtime</li>
                      <li>Peringatan Banjir</li>
                    </ul>
                  </div>

                  <Button 
                    className="w-full bg-cyan-600 hover:bg-cyan-700"
                    onClick={() => window.open('https://t.me/PantauSungai_bot', '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Buka Bot di Telegram
                  </Button>
                </div>
              </div>

              <div className="bg-yellow-50 p-4 rounded-md border border-yellow-100">
                <h4 className="font-medium text-yellow-800 text-sm mb-1">Cara Mengaktifkan:</h4>
                <p className="text-sm text-yellow-700">
                  Klik tombol di atas, lalu tekan tombol <strong>START</strong> di aplikasi Telegram Anda untuk mulai menerima notifikasi.
                </p>
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>Konfigurasi API keys untuk konektivitas ESP32 dan integrasi eksternal</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="esp32Key">ESP32 API Key</Label>
                  <Input
                    id="esp32Key"
                    type="password"
                    placeholder="Masukkan API key untuk ESP32"
                    value={apiSettings.esp32ApiKey}
                    onChange={(e) => setApiSettings({...apiSettings, esp32ApiKey: e.target.value})}
                  />
                  <p className="text-sm text-gray-500">API key ini akan digunakan oleh ESP32 untuk autentikasi</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="supabaseUrl">Supabase URL</Label>
                  <Input
                    id="supabaseUrl"
                    placeholder="https://your-project.supabase.co"
                    value={apiSettings.supabaseUrl}
                    onChange={(e) => setApiSettings({...apiSettings, supabaseUrl: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="supabaseKey">Supabase Anon Key</Label>
                  <Input
                    id="supabaseKey"
                    type="password"
                    placeholder="Masukkan Supabase anon key"
                    value={apiSettings.supabaseKey}
                    onChange={(e) => setApiSettings({...apiSettings, supabaseKey: e.target.value})}
                  />
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">ESP32 Connection Guide</h4>
                <div className="text-sm text-blue-700 space-y-1">
                  <p>1. Gunakan endpoint: <code className="bg-blue-100 px-1 rounded">https://yourapp.com/api/data</code></p>
                  <p>2. Kirim data dengan header: <code className="bg-blue-100 px-1 rounded">Authorization: Bearer [API_KEY]</code></p>
                  <p>3. Format data: <code className="bg-blue-100 px-1 rounded">JSON {`{"temperature": 25.5, "humidity": 60}`}</code></p>
                </div>
              </div>

              <Button onClick={handleSaveApiKeys}>Save API Configuration</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="admin" className="space-y-6">
            <AdminUserTable />
          </TabsContent>
        )}

        {isSuperAdmin && (
          <TabsContent value="access" className="space-y-6">
            <UserDeviceAccessManager />
          </TabsContent>
        )}

        {isSuperAdmin && (
          <TabsContent value="accounts" className="space-y-6">
            <SuperAdminAccountManager />
          </TabsContent>
        )}

        {isSuperAdmin && (
          <TabsContent value="api-management" className="space-y-6">
            <ApiKeyManager />
          </TabsContent>
        )}

        {/* Tab Protocol dihapus */}
      </Tabs>
    </div>
  );
};

export default Settings;