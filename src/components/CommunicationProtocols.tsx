import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Wifi, Database, Smartphone, Send, Terminal, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import mqtt, { MqttClient } from 'mqtt';

// UUID validation function
const isValidUUID = (uuid: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

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
  const { toast } = useToast();
  const clientRef = useRef<MqttClient | null>(null);
  const logContainerRef = useRef<HTMLDivElement | null>(null);
  
  const [protocolSettings, setProtocolSettings] = useState<ProtocolSettings>({
    mqtt: {
      enabled: true, // Default enabled
      broker: 'wss://mqtt.astrodev.cloud:443',
      username: 'astrodev',
      password: 'Astroboy26@',
      clientId: `iot-web-client-${Math.random().toString(16).substring(2, 8)}`,
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

  const [connectionStatus, setConnectionStatus] = useState<Record<string, 'disconnected' | 'connecting' | 'connected' | 'error'>>({
    mqtt: 'disconnected',
    firebase: 'disconnected',
    api: 'disconnected'
  });

  const [logs, setLogs] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [userRole, setUserRole] = useState('user');

  useEffect(() => {
    setUserRole('admin');
    fetchProtocolSettings();

    const channel = supabase.channel('mqtt-log-channel');
    
    channel
      .on('broadcast', { event: 'log-message' }, (payload) => {
        setLogs((prevLogs) => [...prevLogs, payload.payload.log]);
        if (logContainerRef.current) {
          logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
      })
      .subscribe();

    // Auto-connect MQTT immediately with default settings
    setTimeout(() => {
      if (connectionStatus.mqtt === 'disconnected') {
        testConnection('mqtt');
      }
    }, 1000);

    // Don't disconnect MQTT client on component unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Auto connect/disconnect when MQTT is enabled/disabled via switch
  useEffect(() => {
    const handleMqttConnection = async () => {
      if (protocolSettings.mqtt.enabled) {
        if (connectionStatus.mqtt === 'disconnected' || connectionStatus.mqtt === 'error') {
          await testConnection('mqtt');
        }
      } else {
        if (connectionStatus.mqtt === 'connected') {
          await disconnect();
        }
      }
    };

    handleMqttConnection();
  }, [protocolSettings.mqtt.enabled]);

  // Auto connect when component mounts and settings are ready
  useEffect(() => {
    const autoConnect = () => {
      if (protocolSettings.mqtt.enabled && 
          connectionStatus.mqtt === 'disconnected' && 
          protocolSettings.mqtt.broker) {
        console.log('Auto-connecting MQTT...');
        testConnection('mqtt');
      }
    };

    // Delay to ensure settings are loaded
    const timer = setTimeout(autoConnect, 2000);
    return () => clearTimeout(timer);
  }, [protocolSettings.mqtt.broker, protocolSettings.mqtt.enabled]);

  // Handle MQTT client cleanup on window unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (clientRef.current) {
        clientRef.current.end(true);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
  const channel = supabase.channel('db-changes')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'sensor_readings' },
      (payload) => {
        const newData = payload.new;
        setLogs(prev => [
          ...prev,
          `[DB_UPDATE] Sensor data saved for ${newData.device_id}: T=${newData.temperature}°C`
        ]);
      }
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'device_status' },
      (payload) => {
        const newStatus = payload.new;
        setLogs(prev => [
          ...prev,
          `[DB_UPDATE] Device status saved for ${newStatus.device_id}: Bat=${newStatus.battery}%`
        ]);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
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
        const newSettings = JSON.parse(JSON.stringify(settingsData.settings));
        setProtocolSettings(newSettings);
        
        // Auto connect if MQTT is enabled in saved settings
        if (newSettings.mqtt?.enabled && connectionStatus.mqtt === 'disconnected') {
          // Small delay to ensure state is updated
          setTimeout(() => testConnection('mqtt'), 100);
        }
      }
    } catch (error) {
      console.error('Error fetching protocol settings:', error);
      // If error loading settings, use default settings and connect
      if (protocolSettings.mqtt.enabled && connectionStatus.mqtt === 'disconnected') {
        testConnection('mqtt');
      }
    }
  };

  const saveProtocolSettings = async () => {
    try {
      setIsSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('protocol_settings')
        .upsert({
          id: 1,
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
    } finally {
      setIsSaving(false);
    }
  };

  const disconnect = async () => {
    if (clientRef.current) {
      // Unsubscribe from all topics first
      const topics = Object.values(protocolSettings.mqtt.topics);
      for (const topic of topics) {
        await new Promise<void>((resolve) => {
          clientRef.current?.unsubscribe(topic, (err) => {
            if (err) {
              setLogs(prev => [...prev, `[WARNING] Failed to unsubscribe from ${topic}: ${err.message}`]);
            } else {
              setLogs(prev => [...prev, `[INFO] Unsubscribed from ${topic}`]);
            }
            resolve();
          });
        });
      }

      // Then end the connection
      clientRef.current.end(false, {}, () => {
        setLogs(prev => [...prev, '[INFO] Disconnected from MQTT broker']);
        setConnectionStatus(prev => ({ ...prev, mqtt: 'disconnected' }));
        clientRef.current = null;
      });
    }
  };

  const testConnection = async (protocol: string) => {
    try {
      // If already connected to MQTT, disconnect first
      if (protocol === 'mqtt') {
        if (connectionStatus.mqtt === 'connected') {
          await disconnect();
          return;
        }
        if (clientRef.current) {
          await disconnect();
        }
      }

      setConnectionStatus(prev => ({ ...prev, [protocol]: 'connecting' }));
      setLogs(prev => [...prev, `[INFO] Testing ${protocol.toUpperCase()} connection...`]);
    
      let response;
      
      if (protocol === 'firebase') {
        response = await supabase.functions.invoke('firebase-sync', {
          body: { type: 'test_connection' }
        });
      } else if (protocol === 'mqtt') {
        setLogs(prev => [...prev, `[INFO] Connecting to MQTT broker: ${protocolSettings.mqtt.broker}`]);
        
        if (!protocolSettings.mqtt.broker.startsWith('mqtt://') && 
            !protocolSettings.mqtt.broker.startsWith('ws://') && 
            !protocolSettings.mqtt.broker.startsWith('wss://')) {
          throw new Error('Invalid MQTT broker URL. Must start with mqtt://, ws:// or wss://');
        }

        // Disconnect existing client
        if (clientRef.current) {
          clientRef.current.end(true);
          clientRef.current = null;
        }

        // Create new MQTT client with optimized settings
        const client = mqtt.connect(protocolSettings.mqtt.broker, {
          clientId: protocolSettings.mqtt.clientId,
          username: protocolSettings.mqtt.username || undefined,
          password: protocolSettings.mqtt.password || undefined,
          clean: true,
          connectTimeout: 30000,
          reconnectPeriod: 5000,
          keepalive: 60,
          protocolVersion: 4,
          rejectUnauthorized: false
        });

        // Set up event handlers
        client.on('connect', () => {
          setLogs(prev => [...prev, '[SUCCESS] Connected to MQTT broker']);
          setConnectionStatus(prev => ({ ...prev, mqtt: 'connected' }));
        });

        client.on('reconnect', () => {
          if (connectionStatus.mqtt !== 'connecting') {
            setLogs(prev => [...prev, '[INFO] Attempting to reconnect...']);
            setConnectionStatus(prev => ({ ...prev, mqtt: 'connecting' }));
          }
        });

        client.on('close', () => {
          if (connectionStatus.mqtt === 'connected') {
            setLogs(prev => [...prev, '[INFO] MQTT connection closed']);
            setConnectionStatus(prev => ({ ...prev, mqtt: 'disconnected' }));
          }
        });

        client.on('error', (err) => {
          console.error('MQTT error:', err);
          if (err.message.includes('Not authorized') || err.message.includes('Authentication')) {
            setLogs(prev => [...prev, `[ERROR] Authentication failed: ${err.message}`]);
            setConnectionStatus(prev => ({ ...prev, mqtt: 'error' }));
            client.end(true);
          }
        });

        // Remove offline handler as it's causing unnecessary reconnects

        // Handle connection with longer timeout
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Connection timeout after 30 seconds'));
          }, 30000);

          const onConnect = () => {
            clearTimeout(timeout);
            clientRef.current = client;
            
            // Subscribe to topics after successful connection
            const topics = Object.values(protocolSettings.mqtt.topics);
            let subscriptionPromises = topics.map(topic => 
              new Promise<void>((subResolve, subReject) => {
                client.subscribe(topic, { qos: 1 }, (err) => {
                  if (err) {
                    setLogs(prev => [...prev, `[WARNING] Failed to subscribe to ${topic}: ${err.message}`]);
                    subResolve(); // Don't fail the whole connection for subscription errors
                  } else {
                    setLogs(prev => [...prev, `[INFO] Subscribed to ${topic}`]);
                    subResolve();
                  }
                });
              })
            );
            
            Promise.all(subscriptionPromises).then(() => {
              resolve(true);
            });
          };

          const onError = (err) => {
            clearTimeout(timeout);
            reject(err);
          };

          client.once('connect', onConnect);
          client.once('error', onError);
        });

        // Handle incoming messages
        // client.on('message', async (topic, message) => {
        //   const payload = message.toString();
          
        //   setLogs(prev => [...prev, `[RECEIVED] ${topic}: ${payload}`]);
          
        //   // Extract device_id from topic (format: iot/devices/DEVICE_ID/data or iot/devices/DEVICE_ID/status)
        //   const topicParts = topic.split('/');
        //   const deviceId = topicParts.length >= 3 ? topicParts[2] : null;
          
        //   // Skip processing if deviceId is not valid UUID format
        //   if (!deviceId || deviceId === 'unknown-device' || !isValidUUID(deviceId)) {
        //     setLogs(prev => [...prev, `[WARNING] Invalid or missing device ID in topic: ${topic}`]);
        //     return;
        //   }
          
        //   // Handle sensor data topics
        //   if (topic.includes('/data')) {
        //     try {
        //       const data = JSON.parse(payload);
              
        //       // Check if this is sensor data (has temperature, humidity, or other sensor values)
        //       if (data.temperature !== undefined || data.humidity !== undefined || data.pressure !== undefined) {
        //         // Save to Supabase sensor_readings table
        //         const { error } = await supabase
        //           .from('sensor_readings')
        //           .insert({
        //             device_id: deviceId,
        //             temperature: data.temperature?.toString() || null,
        //             humidity: data.humidity?.toString() || null,
        //             pressure: data.pressure?.toString() || null,
        //             battery: data.battery?.toString() || null,
        //             sensor_data: data,
        //             timestamp: new Date().toISOString()
        //           });

        //         if (error) {
        //           console.error('Error saving sensor data:', error);
        //           setLogs(prev => [...prev, `[ERROR] Failed to save data: ${error.message}`]);
        //         } else {
        //           setLogs(prev => [...prev, `[SAVED] Data saved to database for device: ${deviceId}`]);
        //         }
        //       }
        //     } catch (parseError) {
        //       setLogs(prev => [...prev, `[INFO] Non-JSON data: ${payload.substring(0, 50)}...`]);
        //     }
        //   }
          
        //   // Handle device status topics
        //   else if (topic.includes('/status')) {
        //     try {
        //       const statusData = JSON.parse(payload);
              
        //       // Check if this is device status data
        //       if (statusData.status !== undefined || statusData.battery !== undefined) {
        //         // Save to Supabase device_status table
        //         const { error: statusError } = await (supabase as any)
        //           .from('device_status')
        //           .insert({
        //             device_id: deviceId,
        //             status: statusData.status || 'unknown',
        //             battery: statusData.battery || null,
        //             wifi_rssi: statusData.wifi_rssi || null,
        //             uptime: statusData.uptime || null,
        //             free_heap: statusData.free_heap || null,
        //             ota_update: statusData.ota_update || null,
        //             timestamp: statusData.timestamp || new Date().toISOString()
        //           });

        //         if (statusError) {
        //           console.error('Error saving device status:', statusError);
        //           setLogs(prev => [...prev, `[ERROR] Failed to save status: ${statusError.message}`]);
        //         } else {
        //           setLogs(prev => [...prev, `[SAVED] Device status saved for device: ${deviceId}`]);
                  
        //           // Also update the devices table with latest status
        //           const { error: deviceUpdateError } = await supabase
        //             .from('devices')
        //             .update({
        //               status: statusData.status,
        //               battery: statusData.battery,
        //               updated_at: new Date().toISOString()
        //             })
        //             .eq('id', deviceId);

        //           if (deviceUpdateError) {
        //             console.error('Error updating device:', deviceUpdateError);
        //           }
        //         }
        //       }
        //     } catch (parseError) {
        //       // Handle simple status messages like "online" or "offline"
        //       if (payload === 'online' || payload === 'offline') {
        //         const { error: statusError } = await (supabase as any)
        //           .from('device_status')
        //           .insert({
        //             device_id: deviceId,
        //             status: payload,
        //             timestamp: new Date().toISOString()
        //           });

        //         if (statusError) {
        //           console.error('Error saving simple status:', statusError);
        //           setLogs(prev => [...prev, `[ERROR] Failed to save status: ${statusError.message}`]);
        //         } else {
        //           setLogs(prev => [...prev, `[SAVED] Device status saved for device: ${deviceId}`]);
                  
        //           // Update devices table
        //           const { error: deviceUpdateError } = await supabase
        //             .from('devices')
        //             .update({
        //               status: payload,
        //               updated_at: new Date().toISOString()
        //             })
        //             .eq('id', deviceId);

        //           if (deviceUpdateError) {
        //             console.error('Error updating device:', deviceUpdateError);
        //           }
        //         }
        //       } else {
        //         setLogs(prev => [...prev, `[INFO] Non-JSON status: ${payload.substring(0, 50)}...`]);
        //       }
        //     }
        //   }
        // });

        response = { data: { success: true } };
      } else if (protocol === 'api') {
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

      const success = response?.data?.success !== false && 
                     !response?.error && 
                     response?.data?.error === undefined;
      
      setConnectionStatus(prev => ({ 
        ...prev, 
        [protocol]: success ? 'connected' : 'error' 
      }));

      if (success) {
        setLogs(prev => [...prev, `[SUCCESS] ${protocol.toUpperCase()} connection successful`]);
        toast({
          title: 'Berhasil',
          description: `Koneksi ${protocol.toUpperCase()} berhasil`,
          variant: 'default',
        });
      } else {
        const errorMsg = response?.data?.error || response?.error?.message || 'Connection failed';
        setLogs(prev => [...prev, `[ERROR] ${protocol.toUpperCase()} connection failed: ${errorMsg}`]);
        toast({
          title: 'Error',
          description: `Gagal menghubungkan ke ${protocol.toUpperCase()}: ${errorMsg}`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error(`${protocol} connection test error:`, error);
      const errorMsg = error?.message || String(error);
      setLogs(prev => [...prev, `[ERROR] ${protocol.toUpperCase()} connection error: ${errorMsg}`]);
      setConnectionStatus(prev => ({ ...prev, [protocol]: 'error' }));
      toast({
        title: 'Error',
        description: `Gagal menghubungkan ke ${protocol.toUpperCase()}: ${errorMsg}`,
        variant: 'destructive',
      });
    }
  };

  const sendTestData = async () => {
    if (!clientRef.current) {
      toast({
        title: 'Error',
        description: 'MQTT client not connected. Please test connection first.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsTesting(true);
      
      // Generate random device ID for testing
      const testDeviceId = `test-device-${Math.random().toString(16).substring(2, 8)}`;
      
      // Send sensor data
      const sensorData = {
        temperature: Math.round((Math.random() * 15 + 20) * 10) / 10, // 20-35°C
        humidity: Math.round((Math.random() * 40 + 40) * 10) / 10,    // 40-80%
        pressure: Math.round((Math.random() * 50 + 1000) * 100) / 100, // 1000-1050 hPa
        battery: Math.round(Math.random() * 100),                      // 0-100%
        timestamp: new Date().toISOString()
      };

      // Send device status
      const statusData = {
        status: 'online',
        battery: sensorData.battery,
        wifi_rssi: Math.floor(Math.random() * 50) - 90, // -90 to -40 dBm
        uptime: Math.floor(Math.random() * 86400),      // 0-24 hours in seconds
        free_heap: Math.floor(Math.random() * 100000) + 50000, // 50KB-150KB
        ota_update: 'ready',
        timestamp: new Date().toISOString()
      };

      // Send sensor data
      const sensorTopic = `iot/devices/${testDeviceId}/data`;
      const sensorPayload = JSON.stringify(sensorData);
      clientRef.current.publish(sensorTopic, sensorPayload);
      setLogs(prev => [...prev, `[SENT] ${sensorTopic}: ${sensorPayload}`]);

      // Send status data
      const statusTopic = `iot/devices/${testDeviceId}/status`;
      const statusPayload = JSON.stringify(statusData);
      clientRef.current.publish(statusTopic, statusPayload);
      setLogs(prev => [...prev, `[SENT] ${statusTopic}: ${statusPayload}`]);
      
      toast({
        title: 'Test Data Sent',
        description: `Test data berhasil dikirim untuk device: ${testDeviceId}`,
      });
    } catch (error) {
      console.error('Test data send error:', error);
      toast({
        title: 'Error',
        description: 'Gagal mengirim test data',
        variant: 'destructive',
      });
    } finally {
      setIsTesting(false);
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
                      placeholder="wss://mqtt.astrodev.cloud:443"
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
                      placeholder="astrodev"
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
                      placeholder="iot/devices/+/data"
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
                      placeholder="iot/devices/+/status"
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
                      placeholder="iot/devices/+/commands"
                    />
                  </div>
                </div>

                <Button 
                  onClick={() => testConnection('mqtt')}
                  disabled={connectionStatus.mqtt === 'connecting'}
                  variant={connectionStatus.mqtt === 'connected' ? 'destructive' : 'default'}
                >
                  {connectionStatus.mqtt === 'connecting' ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : connectionStatus.mqtt === 'connected' ? (
                    'Disconnect MQTT'
                  ) : (
                    'Connect MQTT'
                  )}
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

              <Button onClick={() => testConnection('api')}>
                Test API Connection
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6 flex justify-between">
          <Button 
            onClick={sendTestData} 
            variant="outline" 
            className="flex items-center space-x-2"
            disabled={connectionStatus.mqtt !== 'connected' || isTesting}
          >
            {isTesting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Sending...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Send Test Data</span>
              </>
            )}
          </Button>
          <Button 
            onClick={saveProtocolSettings}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Configuration'
            )}
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

        {/* Terminal Display */}
        <div className="mt-6">
          <h4 className="font-medium text-gray-900 flex items-center space-x-2">
            <Terminal className="w-5 h-5" />
            <span>MQTT Terminal</span>
          </h4>
          <div
            ref={logContainerRef}
            className="bg-gray-800 text-green-400 p-3 rounded-md overflow-y-auto h-48 font-mono text-sm"
            style={{ whiteSpace: 'pre-wrap' }}
          >
            {logs.length === 0 ? (
              <div className="text-gray-500">No logs yet. Test MQTT connection to see logs...</div>
            ) : (
              logs.map((log, index) => (
                <div key={index}>{log}</div>
              ))
            )}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setLogs([])}
            className="mt-2"
          >
            Clear Logs
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default CommunicationProtocols;
