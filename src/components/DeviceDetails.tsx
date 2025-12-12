import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { QRCodeCanvas } from 'qrcode.react'; 
import html2canvas from 'html2canvas'; 
import { Download, Edit, Activity, Wifi, Battery, Clock, Database, Save, BellRing, ScanLine, QrCode } from 'lucide-react';

const DeviceDetails = ({ device, open, onOpenChange, onEdit }) => {
  const [statusData, setStatusData] = useState([]);
  const [deviceStatus, setDeviceStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const stickerRef = useRef(null);

  useEffect(() => {
    if (device && open) {
      fetchDeviceStatusHistory();
      fetchLatestDeviceStatus();
    }
  }, [device, open]);

  // Link untuk Scan di Layar (Telegram Bot)
  const telegramDeepLink = device ? `https://t.me/AstrodevIoT_bot?start=${device.id}` : '';

  // --- LOGIC: DOWNLOAD STICKER ---
  const handleDownloadSticker = async () => {
    if (stickerRef.current) {
      try {
        const canvas = await html2canvas(stickerRef.current, {
          scale: 6, 
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
        });

        const image = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = image;
        link.download = `Label-${device.name.replace(/\s+/g, '_')}-${device.serial}.png`;
        link.click();
      } catch (error) {
        console.error("Error generating sticker:", error);
      }
    }
  };

  const fetchLatestDeviceStatus = async () => {
    if (!device) return;
    try {
      const { data, error } = await supabase
        .from('device_status')
        .select('wifi_rssi, uptime, free_heap, ota_update, timestamp')
        .eq('device_id', device.id)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return;
      setDeviceStatus(data || null);
    } catch (error) { console.error(error); }
  };
  
  const fetchDeviceStatusHistory = async () => {
    if (!device) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('device_status')
        .select('battery, wifi_rssi, timestamp')
        .eq('device_id', device.id)
        .order('timestamp', { ascending: true })
        .limit(20);
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        const sampleData = [];
        const baseTime = new Date();
        for (let i = 9; i >= 0; i--) {
          const time = new Date(baseTime);
          time.setMinutes(baseTime.getMinutes() - i * 5);
          sampleData.push({
            timestamp: time.toISOString(),
            battery: device.battery - Math.floor(i * 0.5),
            wifi_rssi: -75 + Math.floor(Math.random() * 10),
          });
        }
        setStatusData(sampleData);
      } else {
        setStatusData(data);
      }
    } catch (error) { console.error(error); } 
    finally { setLoading(false); }
  };
  
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
  };

  const formatUptime = (seconds) => {
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (parts.length === 0) return `${Math.floor(seconds / 60)}m`;
    return parts.join(' ');
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };
  
  if (!device) return null;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] h-[90vh] flex flex-col">
        <DialogHeader className="pb-4 border-b">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-2xl">{device.name}</DialogTitle>
            <Badge variant={device.status === 'online' ? 'default' : 'secondary'} className={device.status === 'online' ? 'bg-green-500' : 'bg-gray-400'}>
              {device.status}
            </Badge>
          </div>
          <DialogDescription>
            ID: <span className="font-mono text-xs">{device.id}</span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto px-2 py-4">
          
          {/* ================================================================================== */}
          {/* TEMPLATE STIKER (HIDDEN) - TETAP SAMA (SERIAL + DEVICE ID) */}
          {/* ================================================================================== */}
          <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
            <div 
              ref={stickerRef}
              style={{
                width: '9cm',
                height: '4cm',
                backgroundColor: 'white',
                display: 'flex',
                flexDirection: 'row',
                padding: '8px 12px', 
                border: '1px solid #000',
                boxSizing: 'border-box',
                fontFamily: 'Arial, sans-serif',
                alignItems: 'center',
                justifyContent: 'space-between',
                letterSpacing: '0.3px' 
              }}
            >
              {/* BAGIAN KIRI: Informasi Teks */}
              <div style={{ flex: 1, paddingRight: '5px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <h2 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '900', color: '#000', lineHeight: '1' }}>
                  {device.name}
                </h2>
                <div style={{ fontSize: '11px', marginBottom: '4px', color: '#000', fontWeight: 'bold' }}>
                  SN: {device.serial}
                </div>
                <div style={{ fontSize: '9px', marginBottom: '6px', lineHeight: '1.2', color: '#000', fontFamily: 'Courier New, monospace', fontWeight: '600', wordBreak: 'break-all' }}>
                  ID: {device.id}
                </div>
              </div>

              {/* BAGIAN KANAN: 2 QR Codes (Serial & ID) */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {/* QR Serial */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '80px' }}>
                  <QRCodeCanvas 
                    value={device.serial} 
                    size={90} 
                    level={"H"} 
                    includeMargin={false}
                    style={{ width: '100%', height: 'auto' }} 
                  />
                  <span style={{ fontSize: '8px', marginTop: '3px', fontWeight: 'bold', color: '#000' }}>SERIAL</span>
                </div>
                
                {/* QR Device ID */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '80px' }}>
                  <QRCodeCanvas 
                    value={device.id} 
                    size={90} 
                    level={"H"}
                    includeMargin={false} 
                    style={{ width: '100%', height: 'auto' }}
                  />
                  <span style={{ fontSize: '8px', marginTop: '3px', fontWeight: 'bold', color: '#000' }}>DEV ID</span>
                </div>
              </div>
            </div>
          </div>
          {/* ================================================================================== */}

          {/* INFORMASI DETAIL (UI VISUAL) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Kolom 1: Info Dasar & QR Telegram */}
            <div className="space-y-4 md:col-span-1">
              {/* Device Info Card */}
              <div className="bg-slate-50 p-4 rounded-lg border">
                <h4 className="font-semibold mb-3 flex items-center text-slate-700">
                  <Database className="w-4 h-4 mr-2" /> Device Info
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Type:</span>
                    <span className="font-medium">{device.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Serial:</span>
                    <span className="font-medium">{device.serial}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Location:</span>
                    <span className="font-medium text-right">{device.location || '-'}</span>
                  </div>
                  <div className="pt-2 border-t mt-2">
                    <span className="text-gray-500 block mb-1">MAC Address:</span>
                    <code className="bg-gray-200 px-1 rounded text-xs">{device.mac || '-'}</code>
                  </div>
                </div>
              </div>

              {/* Live Status Card */}
              <div className="bg-slate-50 p-4 rounded-lg border">
                <h4 className="font-semibold mb-3 flex items-center text-slate-700">
                  <Activity className="w-4 h-4 mr-2" /> Live Status
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 flex items-center"><Battery className="w-3 h-3 mr-1"/> Battery</span>
                    <span className={`font-bold ${device.battery < 20 ? 'text-red-500' : 'text-green-600'}`}>
                      {device.battery}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 flex items-center"><Wifi className="w-3 h-3 mr-1"/> Signal</span>
                    <span className="font-medium">
                      {deviceStatus?.wifi_rssi ? `${deviceStatus.wifi_rssi} dBm` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 flex items-center"><Clock className="w-3 h-3 mr-1"/> Uptime</span>
                    <span className="font-medium">
                      {deviceStatus?.uptime ? formatUptime(deviceStatus.uptime) : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 flex items-center"><Save className="w-3 h-3 mr-1"/> Memory</span>
                    <span className="font-medium">
                      {deviceStatus?.free_heap ? formatBytes(deviceStatus.free_heap) : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Telegram Alert Setup */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex flex-col items-center text-center">
                <div className="flex items-center gap-2 mb-3 text-blue-800 font-semibold text-sm">
                  <BellRing className="w-4 h-4" /> Telegram Alert Setup
                </div>
                <div className="bg-white p-2 rounded border border-blue-200 mb-2">
                  <QRCodeCanvas 
                    value={telegramDeepLink} 
                    size={120} 
                    level={"H"} 
                    includeMargin={false}
                  />
                </div>
                <p className="text-xs text-blue-700 mt-1 flex items-center gap-1">
                  <ScanLine className="w-3 h-3" />
                  Scan untuk subscribe notifikasi
                </p>
              </div>

            </div>

            {/* Kolom 2 & 3: Grafik Monitoring */}
            <div className="md:col-span-2 space-y-6">
              <div className="bg-white p-4 rounded-lg border shadow-sm">
                <h4 className="font-semibold mb-4 text-sm text-gray-600">Battery History (Last 20 Readings)</h4>
                {loading ? (
                  <div className="h-[200px] flex items-center justify-center text-gray-400">Loading charts...</div>
                ) : (
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={statusData}>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                         <XAxis 
                            dataKey="timestamp" 
                            tickFormatter={(t) => new Date(t).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} 
                            tick={{fontSize: 10}}
                            interval="preserveStartEnd"
                         />
                         <YAxis domain={[0, 100]} tick={{fontSize: 10}} />
                         <Tooltip 
                            contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'}}
                            labelFormatter={formatTimestamp} 
                         />
                         <Line 
                            type="monotone" 
                            dataKey="battery" 
                            stroke="#10b981" 
                            strokeWidth={2}
                            dot={{r: 2, fill: "#10b981"}} 
                            activeDot={{r: 4}} 
                         />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="bg-white p-4 rounded-lg border shadow-sm">
                <h4 className="font-semibold mb-4 text-sm text-gray-600">WiFi Signal Strength (RSSI)</h4>
                {loading ? (
                  <div className="h-[200px] flex items-center justify-center text-gray-400">Loading charts...</div>
                ) : (
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={statusData}>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                         <XAxis 
                            dataKey="timestamp" 
                            tickFormatter={(t) => new Date(t).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} 
                            tick={{fontSize: 10}}
                            interval="preserveStartEnd"
                         />
                         <YAxis domain={[-100, -30]} tick={{fontSize: 10}} />
                         <Tooltip 
                            contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'}}
                            labelFormatter={formatTimestamp} 
                         />
                         <Line 
                            type="monotone" 
                            dataKey="wifi_rssi" 
                            stroke="#6366f1" 
                            strokeWidth={2}
                            dot={{r: 2, fill: "#6366f1"}}
                            activeDot={{r: 4}} 
                         />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <p className="mt-3 text-xs text-gray-500 italic border-t pt-2">
                  *Untuk Sensor Node (SN atau CH) maka RSSI adalah nilai RSSI LoRa
                </p>
              </div>

              {/* --- NEW: KOTAK QR IDENTITY (Serial & ID) --- */}
              {/* Ini ditambahkan di bawah grafik RSSI sesuai permintaan */}
              <div className="bg-white p-4 rounded-lg border shadow-sm">
                <h4 className="font-semibold mb-4 text-sm text-gray-600 flex items-center gap-2">
                  <QrCode className="w-4 h-4" /> Device Identity Code
                </h4>
                <div className="flex flex-col sm:flex-row justify-around items-center gap-6 py-2">
                  
                  {/* Serial Number QR */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-2 bg-slate-50 border rounded-md">
                      <QRCodeCanvas 
                        value={device.serial} 
                        size={100} 
                        level={"H"} 
                        includeMargin={false}
                      />
                    </div>
                    <div className="text-center">
                      <span className="text-xs font-bold text-gray-700 block">SERIAL NUMBER</span>
                      <span className="text-xs font-mono text-gray-500">{device.serial}</span>
                    </div>
                  </div>

                  {/* Divider Vertical (Desktop) / Horizontal (Mobile) */}
                  <div className="hidden sm:block h-24 w-px bg-gray-200"></div>
                  <div className="block sm:hidden w-full h-px bg-gray-200"></div>

                  {/* Device ID QR */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-2 bg-slate-50 border rounded-md">
                      <QRCodeCanvas 
                        value={device.id} 
                        size={100} 
                        level={"H"} 
                        includeMargin={false}
                      />
                    </div>
                    <div className="text-center">
                      <span className="text-xs font-bold text-gray-700 block">DEVICE ID</span>
                      <span className="text-[10px] font-mono text-gray-500 block max-w-[150px] truncate" title={device.id}>
                        {device.id}
                      </span>
                    </div>
                  </div>

                </div>
              </div>

            </div>

          </div>
        </div>
        
        <div className="flex justify-between items-center pt-4 border-t mt-auto bg-white">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <div className="flex gap-2">
            <Button 
              onClick={handleDownloadSticker} 
              className="bg-slate-800 hover:bg-slate-900 text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              Print Sticker (QR)
            </Button>
            <Button 
              onClick={() => { onOpenChange(false); onEdit(device); }}
              variant="secondary"
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit Device
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeviceDetails;