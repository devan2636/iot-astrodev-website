import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import { Bot, Waves, ExternalLink, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

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
  const [riverSubscribers, setRiverSubscribers] = useState<any[]>([]);
  const [deviceSubscribers, setDeviceSubscribers] = useState<any[]>([]);
  const [riverPage, setRiverPage] = useState(1);
  const [devicePage, setDevicePage] = useState(1);
  const itemsPerPage = 3;
  const [isEditingDevice, setIsEditingDevice] = useState(false);
  const [editingDeviceSubscription, setEditingDeviceSubscription] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchUserProfile();
      fetchUserSession();
      fetchRiverSubscribers();
      fetchDeviceSubscribers();
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
      console.log('Fetching user profile for user ID:', user.id);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Profile fetch error:', error);
        throw error;
      }

      console.log('User profile data:', data);
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

  const fetchRiverSubscribers = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('telegram_subscribers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('River fetch error:', error);
        throw error;
      }

      console.log('River subscribers data:', data);
      if (data) {
        setRiverSubscribers(data);
      }
    } catch (error) {
      console.error('Error fetching river subscribers:', error);
    }
  };

  const fetchDeviceSubscribers = async () => {
    try {
      console.log('Fetching device subscribers...');
      const { data, error } = await (supabase as any)
        .from('telegram_device_subscriptions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Device fetch error:', error);
        throw error;
      }

      console.log('Device subscribers raw data:', data);
      console.log('Device subscribers count:', data?.length || 0);
      
      if (!data || data.length === 0) {
        console.log('No device subscribers found, setting empty array');
        setDeviceSubscribers([]);
        return;
      }

      // Fetch device names separately
      const deviceIds = [...new Set(data.map((sub: any) => sub.device_id))];
      console.log('Device IDs to fetch:', deviceIds);
      
      if (deviceIds.length > 0) {
        const { data: devices, error: devError } = await supabase
          .from('devices')
          .select('id, name');
        
        console.log('Devices fetch result:', devices, devError);
        
        if (!devError && devices) {
          const deviceMap = new Map(devices.map((d: any) => [d.id, d]));
          const enrichedData = data.map((sub: any) => ({
            ...sub,
            devices: deviceMap.get(sub.device_id) || { id: sub.device_id, name: 'Unknown Device' },
          }));
          console.log('Enriched device subscribers:', enrichedData);
          setDeviceSubscribers(enrichedData);
        } else {
          console.log('Setting device subscribers without enrichment');
          setDeviceSubscribers(data);
        }
      } else {
        setDeviceSubscribers(data);
      }
    } catch (error) {
      console.error('Error fetching device subscribers:', error);
      setDeviceSubscribers([]);
    }
  };

  const handleDeleteSubscriber = async (subscriberId: any, botType: 'river' | 'device') => {
    const tableName = botType === 'river' ? 'telegram_subscribers' : 'telegram_device_subscriptions';
    const botName = botType === 'river' ? 'Pantau Sungai' : 'Device & System';

    if (!window.confirm(`Anda yakin ingin menghapus subscriber ini dari bot ${botName}? Pengguna tidak akan lagi menerima notifikasi.`)) {
      return;
    }

    try {
      const { error } = await (supabase as any).from(tableName).delete().eq('id', subscriberId);
      if (error) throw error;

      toast({ title: "Subscriber Dihapus", description: "Akses notifikasi untuk pengguna telah dicabut." });

      if (botType === 'river') {
        setRiverSubscribers(prev => prev.filter(sub => sub.id !== subscriberId));
      } else {
        setDeviceSubscribers(prev => prev.filter(sub => sub.id !== subscriberId));
      }
    } catch (error: any) {
      console.error(`Error deleting ${botType} subscriber:`, error);
      toast({ title: "Error", description: error.message || `Gagal menghapus subscriber.`, variant: "destructive" });
    }
  };

  const handleUpdateDeviceSubscription = async () => {
    if (!editingDeviceSubscription) return;

    try {
      const { error } = await (supabase as any)
        .from('telegram_device_subscriptions')
        .update({
          device_id: editingDeviceSubscription.device_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingDeviceSubscription.id);

      if (error) throw error;

      toast({ title: "Berhasil", description: "Device subscription berhasil diperbarui." });
      setIsEditingDevice(false);
      setEditingDeviceSubscription(null);
      fetchDeviceSubscribers();
    } catch (error: any) {
      console.error('Error updating device subscription:', error);
      toast({ title: "Error", description: error.message || "Gagal memperbarui subscription.", variant: "destructive" });
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

          {isSuperAdmin && (
            <>
          {/* River Monitoring Subscribers */}
          <Card className="border-l-4 border-l-blue-500 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-transparent pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Waves className="w-5 h-5 text-blue-600" />
                    River Monitoring Subscribers (@PantauSungai_bot)
                  </CardTitle>
                  <CardDescription className="mt-2">Daftar pengguna yang berlangganan notifikasi dari bot Pantau Sungai.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="rounded-lg border border-blue-100 overflow-hidden shadow-sm">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold">
                    <tr>
                      <th className="px-6 py-4">Chat ID</th>
                      <th className="px-6 py-4">Username</th>
                      <th className="px-6 py-4">Name</th>
                      <th className="px-6 py-4">Joined Date</th>
                      {userRole === 'superadmin' && <th className="px-6 py-4 text-center">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-100">
                    {riverSubscribers.length === 0 ? (
                      <tr>
                        <td colSpan={userRole === 'superadmin' ? 5 : 4} className="p-8 text-center text-slate-500">
                          <div className="flex flex-col items-center gap-2">
                            <Waves className="w-8 h-8 text-slate-300" />
                            <span>Belum ada data subscriber</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      riverSubscribers
                        .slice((riverPage - 1) * itemsPerPage, riverPage * itemsPerPage)
                        .map((sub) => (
                          <tr key={sub.id} className="hover:bg-blue-50 transition-colors duration-200">
                            <td className="px-6 py-4 font-mono text-xs bg-slate-50 rounded">{sub.chat_id}</td>
                            <td className="px-6 py-4">
                              {sub.username ? (
                                <span className="text-blue-600 font-semibold">@{sub.username}</span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 font-medium text-slate-800">
                              {sub.first_name} {sub.last_name}
                            </td>
                            <td className="px-6 py-4 text-slate-600">
                              {sub.created_at ? new Date(sub.created_at).toLocaleDateString('id-ID') : '-'}
                            </td>
                            {userRole === 'superadmin' && (
                              <td className="px-6 py-4">
                                <div className="flex items-center justify-center gap-2">
                                  <Button 
                                    variant="destructive" 
                                    size="sm" 
                                    onClick={() => handleDeleteSubscriber(sub.id, 'river')} 
                                    title="Delete subscriber"
                                    className="gap-2"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Delete
                                  </Button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
              {riverSubscribers.length > itemsPerPage && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-slate-600">
                    Halaman {riverPage} dari {Math.ceil(riverSubscribers.length / itemsPerPage)} ({riverSubscribers.length} total)
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRiverPage(prev => Math.max(1, prev - 1))}
                      disabled={riverPage === 1}
                      className="gap-2"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRiverPage(prev => Math.min(Math.ceil(riverSubscribers.length / itemsPerPage), prev + 1))}
                      disabled={riverPage === Math.ceil(riverSubscribers.length / itemsPerPage)}
                      className="gap-2"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
              {userRole !== 'superadmin' && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  <p className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 bg-amber-600 rounded-full"></span>
                    Hanya superadmin yang dapat mengelola subscriber.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Device & System Subscribers */}
          <Card className="border-l-4 border-l-purple-500 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-transparent pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-purple-600" />
                    Device & System Subscribers (@AstrodevIoT_bot)
                  </CardTitle>
                  <CardDescription className="mt-2">Daftar pengguna yang berlangganan notifikasi dari bot Device & System.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="rounded-lg border border-purple-100 overflow-hidden shadow-sm">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gradient-to-r from-purple-600 to-purple-700 text-white font-semibold">
                    <tr>
                      <th className="px-6 py-4">Chat ID</th>
                      <th className="px-6 py-4">Username</th>
                      <th className="px-6 py-4">Device</th>
                      <th className="px-6 py-4">Joined Date</th>
                      {userRole === 'superadmin' && <th className="px-6 py-4 text-center">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-100">
                    {deviceSubscribers.length === 0 ? (
                      <tr>
                        <td colSpan={userRole === 'superadmin' ? 5 : 4} className="p-8 text-center text-slate-500">
                          <div className="flex flex-col items-center gap-2">
                            <Bot className="w-8 h-8 text-slate-300" />
                            <span>Belum ada data subscriber</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      deviceSubscribers
                        .slice((devicePage - 1) * itemsPerPage, devicePage * itemsPerPage)
                        .map((sub) => (
                        <tr key={sub.id} className="hover:bg-purple-50 transition-colors duration-200">
                          <td className="px-6 py-4 font-mono text-xs bg-slate-50 rounded">{sub.chat_id}</td>
                          <td className="px-6 py-4">
                            {sub.username ? (
                              <span className="text-purple-600 font-semibold">@{sub.username}</span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              <span className="font-medium text-slate-800">{sub.devices?.name || 'Unknown Device'}</span>
                              <span className="text-xs text-slate-500 font-mono">{sub.device_id}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            {sub.created_at ? new Date(sub.created_at).toLocaleDateString('id-ID') : '-'}
                          </td>
                          {userRole === 'superadmin' && (
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-center gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => {
                                    setEditingDeviceSubscription(sub);
                                    setIsEditingDevice(true);
                                  }} 
                                  title="Edit subscription"
                                  className="gap-2"
                                >
                                  ✏️ Edit
                                </Button>
                                <Button 
                                  variant="destructive" 
                                  size="sm" 
                                  onClick={() => handleDeleteSubscriber(sub.id, 'device')} 
                                  title="Delete subscriber"
                                  className="gap-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {deviceSubscribers.length > itemsPerPage && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-slate-600">
                    Halaman {devicePage} dari {Math.ceil(deviceSubscribers.length / itemsPerPage)} ({deviceSubscribers.length} total)
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDevicePage(prev => Math.max(1, prev - 1))}
                      disabled={devicePage === 1}
                      className="gap-2"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDevicePage(prev => Math.min(Math.ceil(deviceSubscribers.length / itemsPerPage), prev + 1))}
                      disabled={devicePage === Math.ceil(deviceSubscribers.length / itemsPerPage)}
                      className="gap-2"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
              {userRole !== 'superadmin' && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  <p className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 bg-amber-600 rounded-full"></span>
                    Hanya superadmin yang dapat mengelola subscriber.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Edit Device Subscription Modal */}
          {isEditingDevice && editingDeviceSubscription && (
            <Card className="border-2 border-purple-200 bg-purple-50">
              <CardHeader>
                <CardTitle>Edit Device Subscription</CardTitle>
                <CardDescription>Ubah device untuk subscriber {editingDeviceSubscription.username}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-slate-600">Chat ID</Label>
                  <p className="mt-2 font-mono text-sm bg-slate-100 p-2 rounded">{editingDeviceSubscription.chat_id}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Username</Label>
                  <p className="mt-2 font-semibold text-purple-600">{editingDeviceSubscription.username}</p>
                </div>
                <div>
                  <Label htmlFor="device-select">Pilih Device</Label>
                  <Select 
                    value={editingDeviceSubscription.device_id} 
                    onValueChange={(value) => 
                      setEditingDeviceSubscription({...editingDeviceSubscription, device_id: value})
                    }
                  >
                    <SelectTrigger id="device-select">
                      <SelectValue placeholder="Pilih device..." />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Get unique devices from subscribers */}
                      {Array.from(
                        new Map(
                          deviceSubscribers
                            .filter(sub => sub.devices)
                            .map(sub => [sub.device_id, sub.devices])
                        ).values()
                      ).map((device: any) => (
                        <SelectItem key={device.id} value={device.id}>
                          {device.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 justify-end pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditingDevice(false);
                      setEditingDeviceSubscription(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpdateDeviceSubscription}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
            </>
          )}
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