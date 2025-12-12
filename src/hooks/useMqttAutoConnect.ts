import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import mqtt, { MqttClient } from 'mqtt';

// UUID validation function
const isValidUUID = (uuid: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// Default MQTT settings
const DEFAULT_MQTT_SETTINGS = {
  enabled: true,
  broker: 'wss://mqtt.astrodev.cloud:443',
  username: 'astrodev',
  password: 'Astroboy26@',
  clientId: `iot-web-client-${Math.random().toString(16).substring(2, 8)}`,
  topics: {
    data: 'iot/devices/+/data',
    status: 'iot/devices/+/status',
    commands: 'iot/devices/+/commands'
  }
};

export const useMqttAutoConnect = () => {
  const clientRef = useRef<MqttClient | null>(null);
  const isConnectedRef = useRef(false);

  useEffect(() => {
    let reconnectTimer: NodeJS.Timeout;

    const connectMqtt = async () => {
      // Don't connect if already connected
      if (isConnectedRef.current || clientRef.current?.connected) {
        return;
      }

      try {
        console.log('[MQTT Auto-Connect] Attempting to connect...');

        // Try to fetch settings from database, fallback to defaults
        let mqttSettings = DEFAULT_MQTT_SETTINGS;
        try {
          const { data } = await supabase
            .from('protocol_settings')
            .select('settings')
            .single();
          
          if (data?.settings && typeof data.settings === 'object') {
            const settings = data.settings as any;
            if (settings.mqtt) {
              mqttSettings = { ...DEFAULT_MQTT_SETTINGS, ...settings.mqtt };
            }
          }
        } catch (error) {
          console.log('[MQTT Auto-Connect] Using default settings');
        }

        // Skip if MQTT is disabled
        if (!mqttSettings.enabled) {
          console.log('[MQTT Auto-Connect] MQTT is disabled');
          return;
        }

        // Disconnect existing client
        if (clientRef.current) {
          clientRef.current.end(true);
          clientRef.current = null;
        }

        // Create new MQTT client
        const client = mqtt.connect(mqttSettings.broker, {
          clientId: mqttSettings.clientId,
          username: mqttSettings.username || undefined,
          password: mqttSettings.password || undefined,
          clean: true,
          connectTimeout: 30000,
          reconnectPeriod: 5000,
          keepalive: 60,
          protocolVersion: 4,
          rejectUnauthorized: false
        });

        // Set up event handlers
        client.on('connect', () => {
          console.log('[MQTT Auto-Connect] Connected successfully');
          isConnectedRef.current = true;
          clientRef.current = client;

          // Subscribe to topics
          const topics = Object.values(mqttSettings.topics);
          topics.forEach(topic => {
            client.subscribe(topic, { qos: 1 }, (err) => {
              if (err) {
                console.error(`[MQTT Auto-Connect] Failed to subscribe to ${topic}:`, err);
              } else {
                console.log(`[MQTT Auto-Connect] Subscribed to ${topic}`);
              }
            });
          });
        });

        client.on('reconnect', () => {
          console.log('[MQTT Auto-Connect] Attempting to reconnect...');
        });

        client.on('close', () => {
          console.log('[MQTT Auto-Connect] Connection closed');
          isConnectedRef.current = false;
          
          // Schedule reconnect after 10 seconds
          reconnectTimer = setTimeout(() => {
            connectMqtt();
          }, 10000);
        });

        client.on('error', (err) => {
          console.error('[MQTT Auto-Connect] Connection error:', err);
          isConnectedRef.current = false;
          
          // Schedule reconnect after 15 seconds on error
          reconnectTimer = setTimeout(() => {
            connectMqtt();
          }, 15000);
        });

        // Handle incoming messages
        client.on('message', async (topic, message) => {
          const payload = message.toString();
          console.log(`[MQTT Auto-Connect] Received: ${topic} - ${payload.substring(0, 100)}...`);
          
          // Extract device_id from topic
          const topicParts = topic.split('/');
          const deviceId = topicParts.length >= 3 ? topicParts[2] : null;
          
          // Skip processing if deviceId is not valid UUID format
          if (!deviceId || deviceId === 'unknown-device' || !isValidUUID(deviceId)) {
            console.warn(`[MQTT Auto-Connect] Invalid device ID in topic: ${topic}`);
            return;
          }
          
          // Handle sensor data topics
          if (topic.includes('/data')) {
            try {
              const data = JSON.parse(payload);
              
              // Check if this is sensor data
              if (data.temperature !== undefined || data.humidity !== undefined || data.pressure !== undefined) {
                const { error } = await supabase
                  .from('sensor_readings')
                  .insert({
                    device_id: deviceId,
                    temperature: data.temperature?.toString() || null,
                    humidity: data.humidity?.toString() || null,
                    pressure: data.pressure?.toString() || null,
                    battery: data.battery?.toString() || null,
                    sensor_data: data,
                    timestamp: new Date().toISOString()
                  });

                if (error) {
                  console.error('[MQTT Auto-Connect] Error saving sensor data:', error);
                } else {
                  console.log(`[MQTT Auto-Connect] Sensor data saved for device: ${deviceId}`);
                }
              }
            } catch (parseError) {
              console.log(`[MQTT Auto-Connect] Non-JSON sensor data: ${payload.substring(0, 50)}...`);
            }
          }
          
          // Handle device status topics
          else if (topic.includes('/status')) {
            try {
              const statusData = JSON.parse(payload);
              
              // Check if this is device status data
              if (statusData.status !== undefined || statusData.battery !== undefined) {
                const { error: statusError } = await supabase
                  .from('device_status')
                  .insert({
                    device_id: deviceId,
                    status: statusData.status || 'unknown',
                    battery: statusData.battery || null,
                    wifi_rssi: statusData.wifi_rssi || null,
                    uptime: statusData.uptime || null,
                    free_heap: statusData.free_heap || null,
                    ota_update: statusData.ota_update || null,
                    timestamp: statusData.timestamp || new Date().toISOString()
                  });

                if (statusError) {
                  console.error('[MQTT Auto-Connect] Error saving device status:', statusError);
                } else {
                  console.log(`[MQTT Auto-Connect] Device status saved for device: ${deviceId}`);
                  
                  // Update devices table with latest status
                  await supabase
                    .from('devices')
                    .update({
                      status: statusData.status,
                      battery: statusData.battery,
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', deviceId);
                }
              }
            } catch (parseError) {
              // Handle simple status messages like "online" or "offline"
              if (payload === 'online' || payload === 'offline') {
                const { error: statusError } = await supabase
                  .from('device_status')
                  .insert({
                    device_id: deviceId,
                    status: payload,
                    timestamp: new Date().toISOString()
                  });

                if (statusError) {
                  console.error('[MQTT Auto-Connect] Error saving simple status:', statusError);
                } else {
                  console.log(`[MQTT Auto-Connect] Device status saved for device: ${deviceId}`);
                  
                  // Update devices table
                  await supabase
                    .from('devices')
                    .update({
                      status: payload,
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', deviceId);
                }
              }
            }
          }
        });

      } catch (error) {
        console.error('[MQTT Auto-Connect] Setup error:', error);
        isConnectedRef.current = false;
        
        // Schedule reconnect after 20 seconds on setup error
        reconnectTimer = setTimeout(() => {
          connectMqtt();
        }, 20000);
      }
    };

    // Initial connection attempt after 2 seconds
    const initialTimer = setTimeout(() => {
      connectMqtt();
    }, 2000);

    // Cleanup function
    return () => {
      clearTimeout(initialTimer);
      clearTimeout(reconnectTimer);
      
      if (clientRef.current) {
        clientRef.current.end(true);
        clientRef.current = null;
      }
      isConnectedRef.current = false;
    };
  }, []);

  return {
    isConnected: isConnectedRef.current,
    client: clientRef.current
  };
};
