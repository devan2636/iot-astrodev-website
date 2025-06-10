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
        .order('timestamp', { ascending: true });

      if (error) throw error;

      const sensorFieldName = getSensorFieldFromType(sensor.type);
      console.log('Sensor type:', sensor.type, 'Field name:', sensorFieldName);
      
      const filteredData = data
        .filter(reading => {
          const jsonValue = reading.sensor_data?.[sensorFieldName];
          const legacyValue = reading[sensorFieldName];
          const value = jsonValue !== undefined ? jsonValue : legacyValue;
          
          console.log('Reading value for', sensorFieldName, ':', value);
          return value !== null && value !== undefined;
        })
        .map(reading => {
          const jsonValue = reading.sensor_data?.[sensorFieldName];
          const legacyValue = reading[sensorFieldName];
          const value = jsonValue !== undefined ? jsonValue : legacyValue;
          
          return {
            timestamp: new Date(reading.timestamp).toLocaleTimeString('id-ID', { 
              hour: '2-digit', 
              minute: '2-digit',
              month: 'short',
              day: 'numeric'
            }),
            value: parseFloat(value),
            rawTimestamp: reading.timestamp,
            fullReading: reading
          };
        });

      console.log('Filtered data:', filteredData);
      setChartData(filteredData);
      setRawReadings(filteredData.reverse()); // Show latest first in table
      calculateStats(filteredData);
    } catch (error) {
      console.error('Error fetching sensor data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSensorFieldFromType = (sensorType) => {
    const normalizedType = sensorType.toLowerCase().trim();
    
    const knownFields = {
      'temperature': 'temperature',
      'humidity': 'humidity', 
      'pressure': 'pressure',
      'battery': 'battery',
      'light': 'light',
      'motion': 'motion',
      'sound': 'sound',
      'co2': 'co2',
      'ph': 'ph',
      'voltage': 'voltage',
      'current': 'current',
      'distance': 'distance',
      'vibration': 'vibration'
    };
    
    if (knownFields[normalizedType]) {
      return knownFields[normalizedType];
    }
    
    if (normalizedType.includes('temp')) return 'temperature';
    if (normalizedType.includes('humid')) return 'humidity';
    if (normalizedType.includes('press')) return 'pressure';
    if (normalizedType.includes('batt')) return 'battery';
    if (normalizedType.includes('light') || normalizedType.includes('lux')) return 'light';
    if (normalizedType.includes('motion') || normalizedType.includes('pir')) return 'motion';
    if (normalizedType.includes('sound') || normalizedType.includes('audio')) return 'sound';
    if (normalizedType.includes('co2') || normalizedType.includes('carbon')) return 'co2';
    if (normalizedType.includes('ph')) return 'ph';
    if (normalizedType.includes('volt')) return 'voltage';
    if (normalizedType.includes('current') || normalizedType.includes('amp')) return 'current';
    if (normalizedType.includes('distance') || normalizedType.includes('ultrasonic')) return 'distance';
    if (normalizedType.includes('vibr') || normalizedType.includes('accel')) return 'vibration';
    
    const fieldName = normalizedType.replace(/[^a-z0-9_]/g, '_');
    
    console.log('Using field name for custom sensor:', fieldName);
    return fieldName;
  };

  const calculateStats = (data) => {
    if (data.length === 0) {
      setStats({ latest: null, average: null, min: null, max: null, trend: null });
      return;
    }

    const values = data.map(d => d.value);
    const latest = values[values.length - 1];
    const average = values.reduce((sum, val) => sum + val, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    const midPoint = Math.floor(values.length / 2);
    const firstHalf = values.slice(0, midPoint);
    const secondHalf = values.slice(midPoint);
    
    if (firstHalf.length > 0 && secondHalf.length > 0) {
      const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
      const trend = secondAvg > firstAvg ? 'increasing' : secondAvg < firstAvg ? 'decreasing' : 'stable';
      setStats({ latest, average, min, max, trend });
    } else {
      setStats({ latest, average, min, max, trend: 'stable' });
    }
  };

  const getTrendColor = (trend) => {
    switch (trend) {
      case 'increasing': return 'text-red-500';
      case 'decreasing': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  };

  const getTrendText = (trend) => {
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
          {/* Time Range Selector */}
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

          {/* Stats Cards */}
          {stats.latest !== null && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">Terbaru</p>
                <p className="text-lg font-bold text-blue-600">
                  {stats.latest?.toFixed(2)} {sensor.unit}
                </p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-gray-600">Rata-rata</p>
                <p className="text-lg font-bold text-green-600">
                  {stats.average?.toFixed(2)} {sensor.unit}
                </p>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <p className="text-sm text-gray-600">Minimum</p>
                <p className="text-lg font-bold text-orange-600">
                  {stats.min?.toFixed(2)} {sensor.unit}
                </p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <p className="text-sm text-gray-600">Maksimum</p>
                <p className="text-lg font-bold text-red-600">
                  {stats.max?.toFixed(2)} {sensor.unit}
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

          {/* Chart */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <p>Memuat data...</p>
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Clock className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">Tidak ada data untuk periode ini</p>
                <p className="text-sm text-gray-400">Coba pilih rentang waktu yang berbeda</p>
                <p className="text-xs text-gray-400 mt-2">
                  Sensor type: {sensor.type} | Field: {getSensorFieldFromType(sensor.type)}
                </p>
              </div>
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-64 mb-6">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  label={{ value: sensor.unit, angle: -90, position: 'insideLeft' }}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="var(--color-value)" 
                  strokeWidth={2}
                  dot={{ fill: 'var(--color-value)', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: 'var(--color-value)', strokeWidth: 2 }}
                />
              </LineChart>
            </ChartContainer>
          )}

          {/* Data Table with Pagination */}
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
                  {currentReadings.map((reading, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        {new Date(reading.rawTimestamp).toLocaleString('id-ID')}
                      </TableCell>
                      <TableCell className="font-mono">
                        {reading.value?.toFixed(2)}
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

          {/* Sensor Info */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-2">Informasi Sensor</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium">Nama:</span> {sensor.name}
              </div>
              <div>
                <span className="font-medium">Tipe:</span> {sensor.type}
              </div>
              <div>
                <span className="font-medium">Unit:</span> {sensor.unit}
              </div>
              <div>
                <span className="font-medium">Status:</span>{' '}
                <Badge variant={sensor.is_active ? 'default' : 'destructive'}>
                  {sensor.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              {sensor.min_value !== null && sensor.max_value !== null && (
                <div className="col-span-2">
                  <span className="font-medium">Range:</span> {sensor.min_value} - {sensor.max_value} {sensor.unit}
                </div>
              )}
              <div className="col-span-2">
                <span className="font-medium">JSON Field:</span> {getSensorFieldFromType(sensor.type)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SensorChart;
