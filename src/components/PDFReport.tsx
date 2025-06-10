
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FileText, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface PDFReportProps {
  devices: any[];
}

const PDFReport: React.FC<PDFReportProps> = ({ devices }) => {
  const [selectedDevice, setSelectedDevice] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [reportData, setReportData] = useState<any[]>([]);
  const chartRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const handleGeneratePreview = async () => {
    if (!selectedDevice) {
      toast({
        title: "Error",
        description: "Please select a device",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsGenerating(true);
      
      // Fetch data for the selected device and date
      const startDate = new Date(selectedDate);
      const endDate = new Date(selectedDate);
      endDate.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('sensor_readings')
        .select('*')
        .eq('device_id', selectedDevice)
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .order('timestamp', { ascending: true });

      if (error) throw error;

      // Process data for chart
      const processedData = data.map(reading => ({
        time: format(new Date(reading.timestamp), 'HH:mm'),
        temperature: reading.temperature,
        humidity: reading.humidity,
        pressure: reading.pressure,
        battery: reading.battery,
        ...(reading.sensor_data && typeof reading.sensor_data === 'object' ? reading.sensor_data : {})
      }));

      setReportData(processedData);
      
      toast({
        title: "Preview Generated",
        description: "Report preview is ready",
      });
    } catch (error) {
      console.error('Error generating preview:', error);
      toast({
        title: "Error",
        description: "Failed to generate preview",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setIsGenerating(true);
      
      // Create a simple HTML string for the report
      const selectedDeviceData = devices.find(d => d.id === selectedDevice);
      const reportHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>IoT Device Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .device-info { background: #f5f5f5; padding: 15px; margin-bottom: 20px; }
            .stats { display: flex; justify-content: space-around; margin: 20px 0; }
            .stat { text-align: center; }
            .chart-placeholder { border: 1px solid #ddd; height: 300px; text-align: center; line-height: 300px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>IoT Device Daily Report</h1>
            <p>Date: ${format(new Date(selectedDate), 'dd MMMM yyyy')}</p>
          </div>
          
          <div class="device-info">
            <h2>Device Information</h2>
            <p><strong>Name:</strong> ${selectedDeviceData?.name}</p>
            <p><strong>Type:</strong> ${selectedDeviceData?.type}</p>
            <p><strong>Location:</strong> ${selectedDeviceData?.location}</p>
            <p><strong>Status:</strong> ${selectedDeviceData?.status}</p>
          </div>
          
          <div class="stats">
            <div class="stat">
              <h3>Total Readings</h3>
              <p>${reportData.length}</p>
            </div>
            <div class="stat">
              <h3>Avg Temperature</h3>
              <p>${reportData.length > 0 ? (reportData.reduce((sum, d) => sum + (d.temperature || 0), 0) / reportData.length).toFixed(1) : 0}°C</p>
            </div>
            <div class="stat">
              <h3>Avg Humidity</h3>
              <p>${reportData.length > 0 ? (reportData.reduce((sum, d) => sum + (d.humidity || 0), 0) / reportData.length).toFixed(1) : 0}%</p>
            </div>
            <div class="stat">
              <h3>Battery Level</h3>
              <p>${selectedDeviceData?.battery}%</p>
            </div>
          </div>
          
          <div class="chart-placeholder">
            Chart visualization would appear here<br>
            (${reportData.length} data points collected)
          </div>
          
          <div class="footer">
            <p>Generated on ${format(new Date(), 'dd MMMM yyyy HH:mm')}</p>
            <p>Copyright Lovable x Astrodev 2025</p>
          </div>
        </body>
        </html>
      `;

      // Create a blob and download
      const blob = new Blob([reportHTML], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `device-report-${selectedDeviceData?.name}-${selectedDate}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Report Downloaded",
        description: "HTML report has been downloaded",
      });
    } catch (error) {
      console.error('Error downloading report:', error);
      toast({
        title: "Error",
        description: "Failed to download report",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Generate Report
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Daily Device Report</DialogTitle>
          <DialogDescription>
            Generate a PDF report with daily sensor data charts for a specific device
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="device">Select Device</Label>
              <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a device" />
                </SelectTrigger>
                <SelectContent>
                  {devices.map((device) => (
                    <SelectItem key={device.id} value={device.id}>
                      {device.name} - {device.location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="date">Select Date</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={handleGeneratePreview}
              disabled={isGenerating || !selectedDevice}
            >
              {isGenerating ? 'Generating...' : 'Generate Preview'}
            </Button>
            
            <Button 
              onClick={handleDownloadPDF}
              disabled={isGenerating || !selectedDevice || reportData.length === 0}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download Report
            </Button>
          </div>
          
          {reportData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Data Preview</CardTitle>
                <CardDescription>
                  Showing {reportData.length} readings for {format(new Date(selectedDate), 'dd MMMM yyyy')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div ref={chartRef} className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={reportData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      {reportData.some(d => d.temperature) && (
                        <Line type="monotone" dataKey="temperature" stroke="#8884d8" name="Temperature (°C)" />
                      )}
                      {reportData.some(d => d.humidity) && (
                        <Line type="monotone" dataKey="humidity" stroke="#82ca9d" name="Humidity (%)" />
                      )}
                      {reportData.some(d => d.pressure) && (
                        <Line type="monotone" dataKey="pressure" stroke="#ffc658" name="Pressure (hPa)" />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PDFReport;
