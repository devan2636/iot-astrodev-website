import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { Button } from '@/components/ui/button';

interface Props {
  sensor: any;
  device: any;
  expanded?: boolean;
  onOpenFull?: (sensor: any) => void;
}

const InlineSensorPanel: React.FC<Props> = ({ sensor, device, expanded = false, onOpenFull }) => {
  const [data, setData] = useState<any[]>([]);
  const [latest, setLatest] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sensor, device]);

  const getField = (type: string) => {
    const t = (type || '').toLowerCase();
    if (t.includes('temp')) return 'temperature';
    if (t.includes('humid')) return 'humidity';
    if (t.includes('press')) return 'pressure';
    if (t.includes('co2')) return 'co2';
    if (t.includes('ph')) return 'ph';
    if (t.includes('batt')) return 'battery';
    if (t.includes('light') || t.includes('lux')) return 'light';
    return t.replace(/[^a-z0-9_]/g, '_');
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const start = new Date();
      start.setHours(start.getHours() - 24);
      const { data: rows, error } = await supabase
        .from('sensor_readings')
        .select('*')
        .eq('device_id', sensor.device_id)
        .gte('timestamp', start.toISOString())
        .order('timestamp', { ascending: true });

      if (error) throw error;

      const field = getField(sensor.type);
      const chartRows = (rows || []).map((r: any) => {
        const jsonVal = r.sensor_data?.[field];
        const legacy = r[field];
        const value = jsonVal !== undefined ? jsonVal : legacy !== undefined ? legacy : null;
        return {
          t: new Date(r.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          value: value !== null ? Number(value) : null,
        };
      }).filter((r: any) => r.value !== null);

      setData(chartRows);
      setLatest(chartRows.length ? chartRows[chartRows.length - 1].value : null);
    } catch (err) {
      console.error('InlineSensorPanel fetch error', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className={`p-2 ${expanded ? 'col-span-2' : ''}`}>
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="text-sm">{sensor.name}</CardTitle>
        <div className="text-right text-xs">
          <div className="text-gray-500">{sensor.type}</div>
          <div className="font-semibold">{loading ? '–' : latest !== null ? `${latest} ${sensor.unit || ''}` : 'No data'}</div>
        </div>
      </CardHeader>
      <CardContent>
        <div style={{ height: 120 }} className="w-full">
          {loading ? (
            <div className="flex items-center justify-center h-full">Memuat…</div>
          ) : data.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-gray-400">Tidak ada data</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="t" tick={{ fontSize: 10 }} />
                <YAxis domain={["dataMin", "dataMax"]} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="mt-2 flex justify-end">
          <Button size="sm" variant="ghost" onClick={() => onOpenFull?.(sensor)}>Buka penuh</Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default InlineSensorPanel;
