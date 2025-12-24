import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { X, TrendingUp, Clock, BarChart3 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import DevicePagination from './DevicePagination';

interface SensorChartProps {
  sensor: any;
  onClose: () => void;
}

const SensorChart: React.FC<SensorChartProps> = ({ sensor, onClose }) => {
  const [chartData, setChartData] = useState([]);
  const [rawReadings, setRawReadings] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('24h');
  const [stats, setStats] = useState({
    latest: null,
    average: null,
    min: null,
    max: null,
    trend: null
  });

  const itemsPerPage = 10;
  const totalPages = Math.ceil(rawReadings.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentReadings = rawReadings.slice(startIndex, endIndex);

  useEffect(() => {
    fetchSensorData();
  }, [sensor, timeRange]);

  const fetchSensorData = async () => {
    setLoading(true);
    try {
      const hoursBack = timeRange === '1h' ? 1 : timeRange === '6h' ? 6 : timeRange === '24h' ? 24 : 168;
      const startTime = new Date();
      startTime.setHours(startTime.getHours() - hoursBack);

      const { data, error } = await supabase
        .from('sensor_readings')
        .select('*')
        .eq('device_id', sensor.device_id)
        .gte('timestamp', startTime.toISOString())
        .order('timestamp', { ascending: true }); // Ambil data urut dari Lama -> Baru

      if (error) throw error;

      const sensorFieldName = getSensorFieldFromType(sensor.type);
      
      const filteredData = data
        .filter(reading => {
          const jsonValue = reading.sensor_data?.[sensorFieldName];
          const legacyValue = reading[sensorFieldName];
          const value = jsonValue !== undefined ? jsonValue : legacyValue;
          return value !== null && value !== undefined;
        })
        .map(reading => {
          const jsonValue = reading.sensor_data?.[sensorFieldName];
          const legacyValue = reading[sensorFieldName];
          const value = jsonValue !== undefined ? jsonValue : legacyValue;
          
          const date = new Date(reading.timestamp);
          // FIX TIMEZONE: Paksa UTC agar sesuai database (16:30)
          const formattedTime = date.toLocaleString('id-ID', {
            timeZone: 'UTC',
            hour: '2-digit',
            minute: '2-digit',
            ...(timeRange === '7d' ? {
              day: '2-digit',
              month: '2-digit'
            } : {})
          });
          
          return {
            timestamp: formattedTime,
            value: parseFloat(value),
            rawTimestamp: reading.timestamp,
            fullReading: reading
          };
        });

      // 1. Set Data Grafik (Tetap Ascending: Kiri=Lama, Kanan=Baru)
      setChartData(filteredData);
      
      // 2. Set Data Tabel (Descending: Atas=Baru)
      // FIX MUTASI: Gunakan [...filteredData] agar array asli tidak rusak
      setRawReadings([...filteredData].reverse()); 
      
      // 3. Hitung Statistik (Butuh Ascending)
      calculateStats(filteredData);
      
    } catch (error) {
      console.error('Error fetching sensor data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSensorFieldFromType = (sensorType: string) => {
    const normalizedType = (sensorType || '').toLowerCase().trim();
    if (normalizedType.includes('temp')) return 'temperature';
    if (normalizedType.includes('humid')) return 'humidity';
    if (normalizedType.includes('press')) return 'pressure';
    if (normalizedType.includes('rain') || normalizedType.includes('curah')) return 'curah_hujan';
    if (normalizedType.includes('batt')) return 'battery';
    if (normalizedType.includes('light') || normalizedType.includes('lux')) return 'light';
    if (normalizedType.includes('tinggi') || normalizedType.includes('water') || normalizedType.includes('level')) return 'ketinggian_air';
    return normalizedType.replace(/[^a-z0-9_]/g, '_');
  };

  const calculateStats = (data: any[]) => {
    if (data.length === 0) {
      setStats({ latest: null, average: null, min: null, max: null, trend: null });
      return;
    }

    const values = data.map(d => d.value);
    const latest = values[values.length - 1]; // Data terakhir di array ascending adalah yang terbaru
    const average = values.reduce((sum, val) => sum + val, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    const midPoint = Math.floor(values.length / 2);
    const firstHalf = values.slice(0, midPoint);
    const secondHalf = values.slice(midPoint);
    
    let trend = 'stable';
    if (firstHalf.length > 0 && secondHalf.length > 0) {
      const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
      trend = secondAvg > firstAvg ? 'increasing' : secondAvg < firstAvg ? 'decreasing' : 'stable';
    }
    setStats({ latest, average, min, max, trend });
  };

  const getTrendColor = (trend: any) => {
    switch (trend) {
      case 'increasing': return 'text-red-500';
      case 'decreasing': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  };

  const getTrendText = (trend: any) => {
    switch (trend) {
      case 'increasing': return 'Naik';
      case 'decreasing': return 'Turun';
      default: return 'Stabil';
    }
  };

  const chartConfig = {
    value: {
      label: sensor.unit,
      color: '#3b82f6',
    },
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-auto">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Grafik Data Sensor: {sensor.name}
              </CardTitle>
              <CardDescription>
                Sensor {sensor.type} • Device: {sensor.devices?.name} • {sensor.devices?.location}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            {['1h', '6h', '24h', '7d'].map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRange(range)}
              >
                {range}
              </Button>
            ))}
          </div>

          {stats.latest !== null && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">Terbaru</p>
                <p className="text-lg font-bold text-blue-600">
                  {typeof stats.latest === 'number' ? stats.latest.toFixed(2) : '-'} {sensor.unit}
                </p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-gray-600">Rata-rata</p>
                <p className="text-lg font-bold text-green-600">
                  {typeof stats.average === 'number' ? stats.average.toFixed(2) : '-'} {sensor.unit}
                </p>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <p className="text-sm text-gray-600">Minimum</p>
                <p className="text-lg font-bold text-orange-600">
                  {typeof stats.min === 'number' ? stats.min.toFixed(2) : '-'} {sensor.unit}
                </p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <p className="text-sm text-gray-600">Maksimum</p>
                <p className="text-lg font-bold text-red-600">
                  {typeof stats.max === 'number' ? stats.max.toFixed(2) : '-'} {sensor.unit}
                </p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Trend</p>
                <p className={`text-lg font-bold ${getTrendColor(stats.trend)}`}>
                  {getTrendText(stats.trend)}
                </p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <p>Memuat data...</p>
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Clock className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">Tidak ada data untuk periode ini</p>
              </div>
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-64 mb-6 w-full">
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                {/* CONFIG X-AXIS YANG BENAR: Rata, Jelas, Tidak Miring */}
                <XAxis 
                  dataKey="timestamp" 
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd" // Memastikan label awal dan akhir muncul
                  minTickGap={30} // Jarak antar label agar tidak numpuk
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  domain={['auto', 'auto']}
                  width={40}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ChartContainer>
          )}

          {/* Table */}
          {rawReadings.length > 0 && (
            <div className="mt-6">
              <h4 className="font-medium mb-4">Data Readings (Terbaru)</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Unit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentReadings.map((reading: any, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        {/* FORMAT WAKTU TABEL UTC */}
                        {new Date(reading.rawTimestamp).toLocaleString('id-ID', {
                          timeZone: 'UTC', 
                          hour: '2-digit',
                          minute: '2-digit',
                          day: '2-digit',
                          month: '2-digit'
                        })}
                      </TableCell>
                      <TableCell className="font-mono">
                        {typeof reading.value === 'number' ? reading.value.toFixed(2) : reading.value}
                      </TableCell>
                      <TableCell>{sensor.unit}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <DevicePagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SensorChart;