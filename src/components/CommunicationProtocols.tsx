import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Wifi, Database, Smartphone, Send } from 'lucide-react';

interface ProtocolSettings {
  mqtt: {
    enabled: boolean;
    broker: string;
    username: string;
    password: string;
    clientId: string;
    topics: {
      data: string;
      status: string;
      commands: string;
    };
  };
  firebase: {
    enabled: boolean;
    projectId: string;
    apiKey: string;
    authDomain: string;
    databaseURL: string;
    messagingSenderId: string;
    appId: string;
  };
  api: {
    enabled: boolean;
    baseUrl: string;
    rateLimitPerMinute: number;
    enableCors: boolean;
    enableWebhooks: boolean;
    webhookUrl: string;
  };
}

interface ProtocolSettingsRow {
  id: number;
  settings: any;
  updated_by: string;
  updated_at: string;
  created_at: string;
}

const CommunicationProtocols = () => {
  const [protocolSettings, setProtocolSettings] = useState<ProtocolSettings>({
    mqtt: {
      enabled: false,
      broker: 'mqtt://localhost:1883',
      username: '',
      password: '',
      clientId: 'iot-web-client',
      topics: {
        data: 'iot/devices/+/data',
        status: 'iot/devices/+/status',
        commands: 'iot/devices/+/commands'
      }
    },
    firebase: {
      enabled: false,
      projectId: '',
      apiKey: '',
      authDomain: '',
      databaseURL: '',
      messagingSenderId: '',
      appId: ''
    },
    api: {
      enabled: true,
      baseUrl: 'https://gdmvqskgtdpsktuhsnal.supabase.co/functions/v1',
      rateLimitPerMinute: 60,
      enableCors: true,
      enableWebhooks: false,
      webhookUrl: ''
    }
  });

  const [connectionStatus, setConnectionStatus] = useState({
    mqtt: 'disconnected',
    firebase: 'disconnected',
    api: 'active'
  });

  const { toast } = useToast();

  useEffect(() => {
    fetchProtocolSettings();
  }, []);

  const fetchProtocolSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('protocol_settings')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      const settingsData = data as ProtocolSettingsRow;
      if (settingsData && settingsData.settings) {
        setProtocolSettings(JSON.parse(JSON.stringify(settingsData.settings)));
      }
    } catch (error) {
      console.error('Error fetching protocol settings:', error);
    }
  };

  const saveProtocolSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('protocol_settings')
        .upsert({
          id: 1, // Single row for all settings
          settings: JSON.parse(JSON.stringify(protocolSettings)),
          updated_by: user.id,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      toast({
        title: 'Berhasil',
        description: 'Pengaturan protokol berhasil disimpan',
      });
    } catch (error) {
      console.error('Error saving protocol settings:', error);
      toast({
        title: 'Error',
        description: 'Gagal menyimpan pengaturan protokol',
        variant: 'destructive',
      });
    }
  };

  const testConnection = async (protocol: string) => {
    setConnectionStatus(prev => ({ ...prev, [protocol]: 'connecting' }));
    
    try {
      let response;
      
      if (protocol === 'firebase') {
        // Test Firebase connection
        response = await supabase.functions.invoke('firebase-sync', {
          body: { type: 'test_connection' }
        });
      } else if (protocol === 'mqtt') {
        // Test MQTT connection
        response = await supabase.functions.invoke('mqtt-bridge', {
          body: { 
            type: 'test_connection',
            config: protocolSettings.mqtt
          }
        });
      } else if (protocol === 'api') {
        // Test API Gateway by making a simple request
        try {
          const testResponse = await fetch(`${protocolSettings.api.baseUrl}/esp32-data`, {
            method: 'OPTIONS',
            headers: {
              'Content-Type': 'application/json',
            }
          });
          
          response = {
            data: { 
              success: testResponse.status === 200 || testResponse.status === 204,
              message: 'API Gateway is accessible'
            },
            error: null
          };
        } catch (apiError) {
          response = {
            data: { success: false, error: 'API Gateway not accessible' },
            error: apiError
          };
        }
      }

      console.log(`${protocol} test response:`, response);

      // Check if the response indicates success
      const success = response?.data?.success !== false && 
                     !response?.error && 
                     response?.data?.error === undefined;
      
      setConnectionStatus(prev => ({ 
        ...prev, 
        [protocol]: success ? 'connected' : 'error' 
      }));

      toast({
        title: success ? 'Berhasil' : 'Error',
        description: success 
          ? `Koneksi ${protocol.toUpperCase()} berhasil`
          : `Gagal menghubungkan ke ${protocol.toUpperCase()}: ${response?.data?.error || response?.error?.message || 'Connection failed'}`,
        variant: success ? 'default' : 'destructive',
      });
    } catch (error) {
      console.error(`${protocol} connection test error:`, error);
      setConnectionStatus(prev => ({ ...prev, [protocol]: 'error' }));
      toast({
        title: 'Error',
        description: `Gagal menghubungkan ke ${protocol.toUpperCase()}: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  const sendTestData = async () => {
    try {
      // Send test sensor data to check data flow
      const testData = {
        device_id: 'test-device-123',
        temperature: 25.5,
        humidity: 60,
        pressure: 1013.25,
        battery: 85,
        timestamp: new Date().toISOString()
      };

      // Test data flow through different protocols
      const promises = [];
      const enabledProtocols = [];

      if (protocolSettings.mqtt.enabled) {
        enabledProtocols.push('mqtt');
        promises.push(
          supabase.functions.invoke('mqtt-bridge', {
            body: { 
              type: 'sensor_data',
              ...testData
            }
          })
        );
      }

      if (protocolSettings.firebase.enabled) {
        enabledProtocols.push('firebase');
        promises.push(
          supabase.functions.invoke('firebase-sync', {
            body: { 
              type: 'sync_sensor_data',
              device_id: testData.device_id,
              data: {
                temperature: testData.temperature,
                humidity: testData.humidity,
                pressure: testData.pressure,
                battery: testData.battery
              }
            }
          })
        );
      }

      if (protocolSettings.api.enabled) {
        enabledProtocols.push('api');
        promises.push(
          fetch(`${protocolSettings.api.baseUrl}/esp32-data`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(testData)
          })
        );
      }

      if (promises.length === 0) {
        toast({
          title: 'No Protocols Enabled',
          description: 'Tidak ada protokol yang aktif untuk mengirim test data',
          variant: 'destructive',
        });
        return;
      }

      const results = await Promise.allSettled(promises);
      
      const successCount = results.filter(result => {
        if (result.status === 'fulfilled') {
          // For API calls, check response status
          if (result.value?.status) {
            return result.value.status >= 200 && result.value.status < 300;
          }
          // For Supabase function calls, check for errors
          return !result.value?.error;
        }
        return false;
      }).length;
      
      const totalCount = results.length;

      console.log('Test data results:', results);

      toast({
        title: 'Test Data Sent',
        description: `${successCount}/${totalCount} protokol berhasil menerima test data`,
        variant: successCount === totalCount ? 'default' : (successCount > 0 ? 'default' : 'destructive'),
      });

    } catch (error) {
      console.error('Test data send error:', error);
      toast({
        title: 'Error',
        description: 'Gagal mengirim test data',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'connected':
        return 'default' as const;
      case 'connecting':
        return 'secondary' as const;
      case 'error':
        return 'destructive' as const;
      default:
        return 'outline' as const;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'error':
        return 'Error';
      default:
        return 'Disconnected';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Communication Protocols</CardTitle>
        <CardDescription>
          Konfigurasi protokol komunikasi untuk pengiriman data dan integrasi eksternal
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="mqtt" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="mqtt" className="flex items-center space-x-2">
              <Wifi className="w-4 h-4" />
              <span>MQTT</span>
            </TabsTrigger>
            <TabsTrigger value="firebase" className="flex items-center space-x-2">
              <Database className="w-4 h-4" />
              <span>Firebase</span>
            </TabsTrigger>
            <TabsTrigger value="api" className="flex items-center space-x-2">
              <Smartphone className="w-4 h-4" />
              <span>API Gateway</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mqtt" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">MQTT Configuration</h3>
                <p className="text-sm text-gray-500">Konfigurasi broker MQTT untuk komunikasi real-time</p>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant={getStatusBadgeVariant(connectionStatus.mqtt)}>
                  {getStatusText(connectionStatus.mqtt)}
                </Badge>
                <Switch
                  checked={protocolSettings.mqtt.enabled}
                  onCheckedChange={(checked) => setProtocolSettings(prev => ({
                    ...prev,
                    mqtt: { ...prev.mqtt, enabled: checked }
                  }))}
                />
              </div>
            </div>

            {protocolSettings.mqtt.enabled && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="mqttBroker">Broker URL</Label>
                    <Input
                      id="mqttBroker"
                      value={protocolSettings.mqtt.broker}
                      onChange={(e) => setProtocolSettings(prev => ({
                        ...prev,
                        mqtt: { ...prev.mqtt, broker: e.target.value }
                      }))}
                      placeholder="mqtt://broker.hivemq.com:1883"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="mqttClientId">Client ID</Label>
                    <Input
                      id="mqttClientId"
                      value={protocolSettings.mqtt.clientId}
                      onChange={(e) => setProtocolSettings(prev => ({
                        ...prev,
                        mqtt: { ...prev.mqtt, clientId: e.target.value }
                      }))}
                      placeholder="iot-web-client"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="mqttUsername">Username</Label>
                    <Input
                      id="mqttUsername"
                      value={protocolSettings.mqtt.username}
                      onChange={(e) => setProtocolSettings(prev => ({
                        ...prev,
                        mqtt: { ...prev.mqtt, username: e.target.value }
                      }))}
                      placeholder="Username (opsional)"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="mqttPassword">Password</Label>
                    <Input
                      id="mqttPassword"
                      type="password"
                      value={protocolSettings.mqtt.password}
                      onChange={(e) => setProtocolSettings(prev => ({
                        ...prev,
                        mqtt: { ...prev.mqtt, password: e.target.value }
                      }))}
                      placeholder="Password (opsional)"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Topics Configuration</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <Input
                      value={protocolSettings.mqtt.topics.data}
                      onChange={(e) => setProtocolSettings(prev => ({
                        ...prev,
                        mqtt: { 
                          ...prev.mqtt, 
                          topics: { ...prev.mqtt.topics, data: e.target.value }
                        }
                      }))}
                      placeholder="Data topic"
                    />
                    <Input
                      value={protocolSettings.mqtt.topics.status}
                      onChange={(e) => setProtocolSettings(prev => ({
                        ...prev,
                        mqtt: { 
                          ...prev.mqtt, 
                          topics: { ...prev.mqtt.topics, status: e.target.value }
                        }
                      }))}
                      placeholder="Status topic"
                    />
                    <Input
                      value={protocolSettings.mqtt.topics.commands}
                      onChange={(e) => setProtocolSettings(prev => ({
                        ...prev,
                        mqtt: { 
                          ...prev.mqtt, 
                          topics: { ...prev.mqtt.topics, commands: e.target.value }
                        }
                      }))}
                      placeholder="Commands topic"
                    />
                  </div>
                </div>

                <Button onClick={() => testConnection('mqtt')}>
                  Test MQTT Connection
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="firebase" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Firebase Configuration</h3>
                <p className="text-sm text-gray-500">Konfigurasi Firebase untuk real-time database dan messaging</p>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant={getStatusBadgeVariant(connectionStatus.firebase)}>
                  {getStatusText(connectionStatus.firebase)}
                </Badge>
                <Switch
                  checked={protocolSettings.firebase.enabled}
                  onCheckedChange={(checked) => setProtocolSettings(prev => ({
                    ...prev,
                    firebase: { ...prev.firebase, enabled: checked }
                  }))}
                />
              </div>
            </div>

            {protocolSettings.firebase.enabled && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firebaseProjectId">Project ID</Label>
                    <Input
                      id="firebaseProjectId"
                      value={protocolSettings.firebase.projectId}
                      onChange={(e) => setProtocolSettings(prev => ({
                        ...prev,
                        firebase: { ...prev.firebase, projectId: e.target.value }
                      }))}
                      placeholder="your-project-id"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="firebaseApiKey">API Key</Label>
                    <Input
                      id="firebaseApiKey"
                      type="password"
                      value={protocolSettings.firebase.apiKey}
                      onChange={(e) => setProtocolSettings(prev => ({
                        ...prev,
                        firebase: { ...prev.firebase, apiKey: e.target.value }
                      }))}
                      placeholder="AIza..."
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="firebaseAuthDomain">Auth Domain</Label>
                    <Input
                      id="firebaseAuthDomain"
                      value={protocolSettings.firebase.authDomain}
                      onChange={(e) => setProtocolSettings(prev => ({
                        ...prev,
                        firebase: { ...prev.firebase, authDomain: e.target.value }
                      }))}
                      placeholder="your-project.firebaseapp.com"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="firebaseDatabaseURL">Database URL</Label>
                    <Input
                      id="firebaseDatabaseURL"
                      value={protocolSettings.firebase.databaseURL}
                      onChange={(e) => setProtocolSettings(prev => ({
                        ...prev,
                        firebase: { ...prev.firebase, databaseURL: e.target.value }
                      }))}
                      placeholder="https://your-project.firebaseio.com"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="firebaseMessagingSenderId">Messaging Sender ID</Label>
                    <Input
                      id="firebaseMessagingSenderId"
                      value={protocolSettings.firebase.messagingSenderId}
                      onChange={(e) => setProtocolSettings(prev => ({
                        ...prev,
                        firebase: { ...prev.firebase, messagingSenderId: e.target.value }
                      }))}
                      placeholder="123456789"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="firebaseAppId">App ID</Label>
                    <Input
                      id="firebaseAppId"
                      value={protocolSettings.firebase.appId}
                      onChange={(e) => setProtocolSettings(prev => ({
                        ...prev,
                        firebase: { ...prev.firebase, appId: e.target.value }
                      }))}
                      placeholder="1:123456789:web:abc123"
                    />
                  </div>
                </div>

                <Button onClick={() => testConnection('firebase')}>
                  Test Firebase Connection
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="api" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">API Gateway Configuration</h3>
                <p className="text-sm text-gray-500">Konfigurasi API untuk komunikasi dengan aplikasi eksternal</p>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant={getStatusBadgeVariant(connectionStatus.api)}>
                  {getStatusText(connectionStatus.api)}
                </Badge>
                <Switch
                  checked={protocolSettings.api.enabled}
                  onCheckedChange={(checked) => setProtocolSettings(prev => ({
                    ...prev,
                    api: { ...prev.api, enabled: checked }
                  }))}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="apiBaseUrl">Base URL</Label>
                  <Input
                    id="apiBaseUrl"
                    value={protocolSettings.api.baseUrl}
                    onChange={(e) => setProtocolSettings(prev => ({
                      ...prev,
                      api: { ...prev.api, baseUrl: e.target.value }
                    }))}
                    placeholder="https://your-domain.com/api"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="apiRateLimit">Rate Limit (per minute)</Label>
                  <Input
                    id="apiRateLimit"
                    type="number"
                    value={protocolSettings.api.rateLimitPerMinute}
                    onChange={(e) => setProtocolSettings(prev => ({
                      ...prev,
                      api: { ...prev.api, rateLimitPerMinute: parseInt(e.target.value) }
                    }))}
                    placeholder="60"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable CORS</Label>
                    <p className="text-sm text-gray-500">Izinkan akses cross-origin untuk web apps</p>
                  </div>
                  <Switch
                    checked={protocolSettings.api.enableCors}
                    onCheckedChange={(checked) => setProtocolSettings(prev => ({
                      ...prev,
                      api: { ...prev.api, enableCors: checked }
                    }))}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Webhooks</Label>
                    <p className="text-sm text-gray-500">Kirim notifikasi otomatis ke URL eksternal</p>
                  </div>
                  <Switch
                    checked={protocolSettings.api.enableWebhooks}
                    onCheckedChange={(checked) => setProtocolSettings(prev => ({
                      ...prev,
                      api: { ...prev.api, enableWebhooks: checked }
                    }))}
                  />
                </div>

                {protocolSettings.api.enableWebhooks && (
                  <div className="space-y-2">
                    <Label htmlFor="webhookUrl">Webhook URL</Label>
                    <Input
                      id="webhookUrl"
                      value={protocolSettings.api.webhookUrl}
                      onChange={(e) => setProtocolSettings(prev => ({
                        ...prev,
                        api: { ...prev.api, webhookUrl: e.target.value }
                      }))}
                      placeholder="https://external-app.com/webhook"
                    />
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6 flex justify-between">
          <Button onClick={sendTestData} variant="outline" className="flex items-center space-x-2">
            <Send className="w-4 h-4" />
            <span>Send Test Data</span>
          </Button>
          <Button onClick={saveProtocolSettings}>
            Save Configuration
          </Button>
        </div>

        <div className="mt-6 p-4 bg-green-50 rounded-lg">
          <h4 className="font-medium text-green-900 mb-2">Integration Examples</h4>
          <div className="text-sm text-green-700 space-y-2">
            <p><strong>MQTT:</strong> Ideal untuk komunikasi real-time dengan ESP32/Arduino</p>
            <p><strong>Firebase:</strong> Perfect untuk mobile apps dan web apps real-time</p>
            <p><strong>API Gateway:</strong> Standard REST API untuk integrasi dengan sistem lain</p>
            <p><strong>Mobile Integration:</strong> Gunakan API keys untuk autentikasi mobile apps</p>
            <p><strong>Data Flow:</strong> Data otomatis diteruskan ke semua protokol yang aktif</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CommunicationProtocols;
