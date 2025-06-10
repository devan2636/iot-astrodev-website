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
import AdminUserTable from './AdminUserTable';
import UserDeviceAccessManager from './UserDeviceAccessManager';
import SuperAdminAccountManager from './SuperAdminAccountManager';
import ApiKeyManager from './ApiKeyManager';
import CommunicationProtocols from './CommunicationProtocols';

interface SettingsProps {
  user: any;
}

const Settings = ({ user }: SettingsProps) => {
  const [userSettings, setUserSettings] = useState({
    username: '',
    email: user?.email || '',
    role: 'user',
    darkMode: false,
    autoUpdate: true,
  });

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
    }
  }, [user]);

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
          role: data.role || 'user',
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

  const handleSaveNotifications = () => {
    toast({
      title: "Notifikasi Disimpan",
      description: "Pengaturan notifikasi berhasil diperbarui",
    });
  };

  const handleSaveApiKeys = () => {
    toast({
      title: "API Keys Disimpan",
      description: "Konfigurasi API berhasil diperbarui",
    });
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
        <TabsList className={`grid w-full ${isSuperAdmin ? 'grid-cols-8' : isAdmin ? 'grid-cols-4' : 'grid-cols-3'}`}>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="api">API Keys</TabsTrigger>
          {isAdmin && <TabsTrigger value="admin">Admin</TabsTrigger>}
          {isSuperAdmin && <TabsTrigger value="access">Device Access</TabsTrigger>}
          {isSuperAdmin && <TabsTrigger value="accounts">Account Management</TabsTrigger>}
          {isSuperAdmin && <TabsTrigger value="api-management">API Management</TabsTrigger>}
          {isSuperAdmin && <TabsTrigger value="protocols">Protocols</TabsTrigger>}
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
                    <Label>Dark Mode</Label>
                    <p className="text-sm text-gray-500">Aktifkan tema gelap untuk interface</p>
                  </div>
                  <Switch
                    checked={userSettings.darkMode}
                    onCheckedChange={(checked) => setUserSettings({...userSettings, darkMode: checked})}
                  />
                </div>
                
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
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>Konfigurasi pengiriman notifikasi untuk alert dan update</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-gray-500">Terima notifikasi melalui email</p>
                  </div>
                  <Switch
                    checked={apiSettings.emailNotifications}
                    onCheckedChange={(checked) => setApiSettings({...apiSettings, emailNotifications: checked})}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>WhatsApp Notifications</Label>
                    <p className="text-sm text-gray-500">Terima notifikasi melalui WhatsApp</p>
                  </div>
                  <Switch
                    checked={apiSettings.whatsappNotifications}
                    onCheckedChange={(checked) => setApiSettings({...apiSettings, whatsappNotifications: checked})}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Email Provider Configuration</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih email provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="smtp">SMTP Custom</SelectItem>
                      <SelectItem value="sendgrid">SendGrid</SelectItem>
                      <SelectItem value="mailgun">Mailgun</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>WhatsApp API Configuration</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih WhatsApp provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="twilio">Twilio</SelectItem>
                      <SelectItem value="whatsapp-business">WhatsApp Business API</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={handleSaveNotifications}>Save Notification Settings</Button>
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

        {isSuperAdmin && (
          <TabsContent value="protocols" className="space-y-6">
            <CommunicationProtocols />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default Settings;
