import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import mqtt from "https://esm.sh/mqtt@4.3.7";

type MQTTConfig = {
  broker: string;
  username?: string;
  password?: string;
  clientId?: string;
  topics: {
    data: string;
    status: string;
    commands: string;
  };
};

type MQTTClientOptions = {
  username?: string;
  password?: string;
  clientId: string;
  connectTimeout: number;
  reconnectPeriod: number;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOG_CHANNEL = "mqtt-log-channel";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    process.env.SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  );

  const broadcastLog = async (
    type: "info" | "error" | "success",
    message: string,
  ) => {
    const logEntry = `[${type.toUpperCase()}] ${new Date().toISOString()} - ${message}`;
    console.log(logEntry);
    try {
      await supabaseClient.channel(LOG_CHANNEL).send({
        type: "broadcast",
        event: "log-message",
        payload: { log: logEntry },
      });
    } catch (e) {
      console.error("Failed to broadcast log:", e.message);
    }
  };

  try {
    const body = await req.json();
    console.log("MQTT Bridge received:", body);
    await broadcastLog("info", `Request received: ${JSON.stringify(body)}`);

    if (body.type === "test_connection") {
      const mqttConfig = body.config;
      if (!mqttConfig || !mqttConfig.broker) {
        await broadcastLog("error", "MQTT configuration not provided");
        return new Response(
          JSON.stringify({
            success: false,
            error: "MQTT configuration not provided",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Generate a random test client ID that won't be used for device status
      const testClientId = `mqtt_test_${Math.random().toString(16).substring(2, 10)}`;

      return new Promise(async (resolve) => {
        try {
          // Validate broker URL format
          const brokerUrl = mqttConfig.broker.toLowerCase();
          if (!brokerUrl.startsWith('mqtt://') && 
              !brokerUrl.startsWith('mqtts://') && 
              !brokerUrl.startsWith('ws://') && 
              !brokerUrl.startsWith('wss://')) {
            await broadcastLog("error", `Invalid broker URL format: ${mqttConfig.broker}`);
            return resolve(new Response(
              JSON.stringify({
                success: false,
                error: "Invalid broker URL. Must start with mqtt://, mqtts://, ws:// or wss://",
              }),
              {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            ));
          }

          // Validate broker URL hostname and port
          try {
            const url = new URL(mqttConfig.broker);
            if (!url.hostname || !url.port) {
              throw new Error("Missing hostname or port");
            }
          } catch (urlError) {
            await broadcastLog("error", `Invalid broker URL: ${urlError.message}`);
            return resolve(new Response(
              JSON.stringify({
                success: false,
                error: `Invalid broker URL: ${urlError.message}`,
              }),
              {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            ));
          }

          await broadcastLog(
            "info",
            `Testing MQTT connection to: ${mqttConfig.broker}`,
          );

          const connectOptions: MQTTClientOptions = {
            username: mqttConfig.username || undefined,
            password: mqttConfig.password || undefined,
            clientId: testClientId,
            connectTimeout: 10000,
            reconnectPeriod: 0, // Disable reconnection for test
          };

          // Remove undefined values to avoid MQTT client issues
          Object.keys(connectOptions).forEach(key => {
            if (connectOptions[key as keyof MQTTClientOptions] === undefined) {
              delete connectOptions[key as keyof MQTTClientOptions];
            }
          });

          await broadcastLog("info", `Connecting with options: ${JSON.stringify(connectOptions)}`);
          const mqttClient = mqtt.connect(mqttConfig.broker, connectOptions);

          let isResolved = false;

          const timeout = setTimeout(() => {
            if (!isResolved) {
              isResolved = true;
              mqttClient.end(true);
              broadcastLog("error", "MQTT connection timeout after 10 seconds");
              resolve(new Response(
                JSON.stringify({
                  success: false,
                  error: "Connection timeout after 10 seconds",
                }),
                {
                  status: 408,
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                },
              ));
            }
          }, 10000);

          mqttClient.on('connect', () => {
            if (!isResolved) {
              isResolved = true;
              clearTimeout(timeout);
              broadcastLog("success", "MQTT connection successful!");
              mqttClient.end();
              resolve(new Response(
                JSON.stringify({
                  success: true,
                  message: "MQTT connection successful!",
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } },
              ));
            }
          });

          mqttClient.on('error', (error) => {
            if (!isResolved) {
              isResolved = true;
              clearTimeout(timeout);
              console.error("MQTT connection test failed:", error.message);
              broadcastLog("error", `MQTT connection failed: ${error.message}`);
              mqttClient.end();
              resolve(new Response(
                JSON.stringify({
                  success: false,
                  error: `Connection failed: ${error.message}`,
                }),
                {
                  status: 500,
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                },
              ));
            }
          });

          mqttClient.on('offline', () => {
            if (!isResolved) {
              isResolved = true;
              clearTimeout(timeout);
              broadcastLog("error", "MQTT client went offline");
              mqttClient.end();
              resolve(new Response(
                JSON.stringify({
                  success: false,
                  error: "MQTT client went offline",
                }),
                {
                  status: 500,
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                },
              ));
            }
          });

          mqttClient.on('close', () => {
            if (!isResolved) {
              isResolved = true;
              clearTimeout(timeout);
              broadcastLog("error", "MQTT connection closed unexpectedly");
              resolve(new Response(
                JSON.stringify({
                  success: false,
                  error: "Connection closed unexpectedly",
                }),
                {
                  status: 500,
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                },
              ));
            }
          });

        } catch (e) {
          console.error("MQTT connection test failed:", e.message);
          broadcastLog("error", `MQTT connection test failed: ${e.message}`);
          resolve(new Response(
            JSON.stringify({
              success: false,
              error: `Connection failed: ${e.message}`,
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          ));
        }
      });
    }

    const { data: protocolSettings } = await supabaseClient
      .from("protocol_settings")
      .select("settings")
      .single();

    const settings = protocolSettings ? JSON.parse(protocolSettings.settings) : null;
    const mqttConfig = settings?.mqtt;

    if (body.type === "sensor_data") {
      const sensorData = { ...body };
      delete sensorData.type;
      delete sensorData.device_id;

      const insertData = {
        device_id: body.device_id,
        sensor_data: sensorData,
        timestamp: new Date().toISOString(),
        temperature: sensorData.temperature,
        humidity: sensorData.humidity,
        pressure: sensorData.pressure,
        battery: sensorData.battery,
      };

      const { data, error } = await supabaseClient
        .from("sensor_readings")
        .insert(insertData)
        .select();
      if (error) throw error;

      if (settings?.firebase?.enabled) {
        try {
          await supabaseClient.functions.invoke("firebase-sync", {
            body: {
              type: "sync_sensor_data",
              device_id: body.device_id,
              data: sensorData,
            },
          });
          console.log("Data forwarded to Firebase");
        } catch (firebaseError) {
          console.error("Firebase forwarding error:", firebaseError);
        }
      }

      await supabaseClient
        .channel("sensor-updates")
        .send({
          type: "broadcast",
          event: "sensor_data",
          payload: { device_id: body.device_id, data: data[0] },
        });

      if (mqttConfig?.enabled) {
        try {
          const bridgeClientId = `supabase_bridge_${Math.random().toString(16).substring(2, 10)}`;
          const mqttClient = mqtt.connect(mqttConfig.broker, {
            username: mqttConfig.username,
            password: mqttConfig.password,
            clientId: bridgeClientId
          });
          const topic = mqttConfig.topics.data.replace("+", body.device_id);
          mqttClient.publish(topic, JSON.stringify(sensorData));
          console.log(`Published to MQTT topic: ${topic}`);
          mqttClient.end();
        } catch (mqttError) {
          console.error("MQTT forwarding error:", mqttError.message);
          await broadcastLog("error", `MQTT forwarding error: ${mqttError.message}`);
        }
      }

      return new Response(
        JSON.stringify({
          message: "MQTT data processed and forwarded successfully",
          data,
          forwarded_protocols: [
            ...(settings?.firebase?.enabled ? ["firebase"] : []),
            ...(mqttConfig?.enabled ? ["mqtt"] : []),
          ],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (body.type === "device_status") {
      // Extract device_id from MQTT topic if not present in payload
      let deviceId = body.device_id;
      if (!deviceId && body.topic) {
        // Assuming topic format: iot/devices/{device_id}/status
        const topicParts = body.topic.split('/');
        if (topicParts.length >= 4) {
          deviceId = topicParts[2];
        }
      }

      if (!deviceId) {
        await broadcastLog("error", "Device ID not found in payload or topic");
        return new Response(
          JSON.stringify({
            success: false,
            error: "Device ID not found in payload or topic",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Update devices table first (this has working RLS)
      const timestamp = new Date().toISOString();
      const { data, error: deviceError } = await supabaseClient
        .from("devices")
        .update({
          status: body.status,
          battery: body.battery || null,
          wifi_rssi: body.wifi_rssi || null,
          uptime: body.uptime || null,
          free_heap: body.free_heap || null,
          ota_update: body.ota_update || null,
          updated_at: timestamp,
        })
        .eq("id", deviceId)
        .select();

      if (deviceError) {
        await broadcastLog("error", `Failed to update device: ${deviceError.message}`);
        throw deviceError;
      }

      await broadcastLog("success", `Device status updated for ${deviceId}: ${body.status}`);

      // Try to insert into device_status table (may fail due to RLS)
      const statusData = {
        device_id: deviceId,
        status: body.status,
        battery: body.battery,
        wifi_rssi: body.wifi_rssi,
        uptime: body.uptime,
        free_heap: body.free_heap,
        ota_update: body.ota_update || null,
        timestamp: timestamp
      };

      try {
        const { error: statusError } = await supabaseClient
          .from("device_status")
          .insert(statusData);

        if (statusError) {
          await broadcastLog("error", `Note: Device status history not saved (${statusError.message})`);
        } else {
          await broadcastLog("success", `Device status history saved for ${deviceId}`);
        }
      } catch (err) {
        // Log but don't throw error for device_status table
        await broadcastLog("error", `Note: Failed to save device status history: ${err.message}`);
      }

      // Broadcast status update
      await supabaseClient
        .channel("device-updates")
        .send({
          type: "broadcast",
          event: "device_status",
          payload: { device_id: deviceId, data: statusData },
        });

      return new Response(
        JSON.stringify({ 
          message: "Device status updated successfully", 
          data,
          status_data: statusData 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (body.type === "command") {
      if (mqttConfig?.enabled) {
        try {
          const commandClientId = `supabase_cmd_${Math.random().toString(16).substring(2, 10)}`;
          const mqttClient = await mqtt.connect({
            url: mqttConfig.broker,
            username: mqttConfig.username,
            password: mqttConfig.password,
            clientId: commandClientId,
          });
          // Use the command topic from the MQTT configuration
          const topic = mqttConfig.topics.command.replace("+", body.device_id);
          const commandPayload = JSON.stringify({
            device_id: body.device_id,
            command: body.command,
          });
          await mqttClient.publish(topic, commandPayload);
          console.log(`Published command to MQTT topic: ${topic}`);
          await broadcastLog("info", `Published command to MQTT topic: ${topic}`);
          await mqttClient.disconnect();
          return new Response(
            JSON.stringify({ message: "Command sent successfully via MQTT" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        } catch (mqttError) {
          console.error("MQTT command error:", mqttError.message);
          await broadcastLog("error", `MQTT command error: ${mqttError.message}`);
          return new Response(
            JSON.stringify({
              error: "Failed to send command via MQTT",
              details: mqttError.message,
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      } else {
        console.log("MQTT is not enabled, command not sent.");
        return new Response(
          JSON.stringify({ message: "MQTT is not enabled, command not sent." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    return new Response(JSON.stringify({ error: "Unknown message type" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("MQTT Bridge error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error",
        details: error.message,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
