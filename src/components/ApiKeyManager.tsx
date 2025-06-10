
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2, Copy, Eye, EyeOff } from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  key_value: string;
  permissions: string;
  expires_at: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const ApiKeyManager = () => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPermissions, setNewKeyPermissions] = useState('read');
  const [newKeyExpiry, setNewKeyExpiry] = useState('30');
  const [visibleKeys, setVisibleKeys] = useState(new Set<string>());
  const { toast } = useToast();

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApiKeys((data as ApiKey[]) || []);
    } catch (error) {
      console.error('Error fetching API keys:', error);
      toast({
        title: 'Error',
        description: 'Gagal memuat API keys',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const generateApiKey = () => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return `iot_${timestamp}_${random}`;
  };

  const handleCreateApiKey = async () => {
    if (!newKeyName.trim()) {
      toast({
        title: 'Error',
        description: 'Nama API key harus diisi',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const apiKey = generateApiKey();
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + parseInt(newKeyExpiry));

      const { error } = await supabase
        .from('api_keys')
        .insert({
          name: newKeyName,
          key_value: apiKey,
          permissions: newKeyPermissions,
          expires_at: expiryDate.toISOString(),
          created_by: user.id,
          is_active: true
        });

      if (error) throw error;

      await fetchApiKeys();
      setIsCreateDialogOpen(false);
      setNewKeyName('');
      setNewKeyPermissions('read');
      setNewKeyExpiry('30');

      toast({
        title: 'Berhasil',
        description: 'API key berhasil dibuat',
      });
    } catch (error) {
      console.error('Error creating API key:', error);
      toast({
        title: 'Error',
        description: 'Gagal membuat API key',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteApiKey = async (keyId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus API key ini?')) return;

    try {
      const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', keyId);

      if (error) throw error;

      await fetchApiKeys();
      toast({
        title: 'Berhasil',
        description: 'API key berhasil dihapus',
      });
    } catch (error) {
      console.error('Error deleting API key:', error);
      toast({
        title: 'Error',
        description: 'Gagal menghapus API key',
        variant: 'destructive',
      });
    }
  };

  const handleToggleKeyVisibility = (keyId: string) => {
    const newVisibleKeys = new Set(visibleKeys);
    if (visibleKeys.has(keyId)) {
      newVisibleKeys.delete(keyId);
    } else {
      newVisibleKeys.add(keyId);
    }
    setVisibleKeys(newVisibleKeys);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Berhasil',
      description: 'API key berhasil disalin',
    });
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return key;
    return key.substring(0, 8) + '*'.repeat(key.length - 12) + key.substring(key.length - 4);
  };

  const getPermissionBadgeVariant = (permission: string) => {
    switch (permission) {
      case 'admin':
        return 'destructive' as const;
      case 'write':
        return 'default' as const;
      default:
        return 'secondary' as const;
    }
  };

  const isExpired = (expiryDate: string) => {
    return new Date(expiryDate) < new Date();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>API Key Management</CardTitle>
            <CardDescription>
              Kelola API keys untuk akses eksternal dan komunikasi antar aplikasi
            </CardDescription>
          </div>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create API Key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New API Key</DialogTitle>
                <DialogDescription>
                  Buat API key baru untuk akses eksternal
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="keyName">Name</Label>
                  <Input
                    id="keyName"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="Nama API key (misal: Mobile App, External Service)"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="permissions">Permissions</Label>
                  <Select value={newKeyPermissions} onValueChange={setNewKeyPermissions}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="read">Read Only</SelectItem>
                      <SelectItem value="write">Read & Write</SelectItem>
                      <SelectItem value="admin">Admin Access</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="expiry">Expiry (days)</Label>
                  <Select value={newKeyExpiry} onValueChange={setNewKeyExpiry}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 Days</SelectItem>
                      <SelectItem value="30">30 Days</SelectItem>
                      <SelectItem value="90">90 Days</SelectItem>
                      <SelectItem value="365">1 Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Button onClick={handleCreateApiKey} className="w-full">
                  Create API Key
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <p>Loading API keys...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>API Key</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((apiKey) => (
                  <TableRow key={apiKey.id}>
                    <TableCell className="font-medium">
                      {apiKey.name}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      <div className="flex items-center space-x-2">
                        <span>
                          {visibleKeys.has(apiKey.id) ? apiKey.key_value : maskApiKey(apiKey.key_value)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleKeyVisibility(apiKey.id)}
                        >
                          {visibleKeys.has(apiKey.id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(apiKey.key_value)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getPermissionBadgeVariant(apiKey.permissions)}>
                        {apiKey.permissions}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        !apiKey.is_active ? 'destructive' :
                        isExpired(apiKey.expires_at) ? 'destructive' : 'default'
                      }>
                        {!apiKey.is_active ? 'Inactive' :
                         isExpired(apiKey.expires_at) ? 'Expired' : 'Active'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(apiKey.expires_at).toLocaleDateString('id-ID')}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteApiKey(apiKey.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        
        {apiKeys.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">
            Belum ada API key yang dibuat
          </div>
        )}

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">API Usage Instructions</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <p><strong>Authentication:</strong> Include header <code>Authorization: Bearer [API_KEY]</code></p>
            <p><strong>Base URL:</strong> <code>https://gdmvqskgtdpsktuhsnal.supabase.co/functions/v1</code></p>
            <p><strong>Endpoints:</strong></p>
            <ul className="ml-4 space-y-1">
              <li>• <code>POST /api-gateway</code> - Main API endpoint</li>
              <li>• <code>POST /mqtt-bridge</code> - MQTT communication bridge</li>
              <li>• <code>POST /firebase-sync</code> - Firebase synchronization</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ApiKeyManager;
