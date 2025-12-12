import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

interface ExcelReportProps {
  devices: any[];
}

const ExcelReport: React.FC<ExcelReportProps> = ({ devices }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const { toast } = useToast();

  const generateExcel = async () => {
    try {
      if (!selectedDevice) {
        toast({
          title: "Error",
          description: "Please select a device",
          variant: "destructive",
        });
        return;
      }

      if (!startDate || !endDate) {
        toast({
          title: "Error",
          description: "Please select date range",
          variant: "destructive",
        });
        return;
      }

      // Fetch sensor data
      let query = supabase
        .from('sensor_readings')
        .select('*')
        .eq('device_id', selectedDevice)
        .gte('timestamp', startDate)
        .lte('timestamp', endDate)
        .order('timestamp', { ascending: true });

      const { data, error } = await query;

      if (error) throw error;

      // Process data for Excel
      const excelData = data.map(reading => ({
        Timestamp: format(new Date(reading.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        Temperature: reading.temperature,
        Humidity: reading.humidity,
        Pressure: reading.pressure,
        Battery: reading.battery,
        DeviceID: reading.device_id,
        ...(reading.sensor_data && typeof reading.sensor_data === 'object' ? reading.sensor_data : {})
      }));

      // Create workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, "Sensor Data");

      // Generate Excel file
      const selectedDeviceName = devices.find(d => d.id === selectedDevice)?.name || 'device';
      const fileName = `${selectedDeviceName}_${format(new Date(startDate), 'yyyyMMdd')}_${format(new Date(endDate), 'yyyyMMdd')}.xlsx`;
      XLSX.writeFile(wb, fileName);

      setIsOpen(false);
      toast({
        title: "Success",
        description: "Excel report has been generated",
      });
    } catch (error) {
      console.error('Error generating Excel:', error);
      toast({
        title: "Error",
        description: "Failed to generate Excel report",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          Download Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Excel Report</DialogTitle>
          <DialogDescription>
            Select device and date range for the report
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="device">Select Device</Label>
            <Select value={selectedDevice} onValueChange={setSelectedDevice}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a device" />
              </SelectTrigger>
              <SelectContent>
                {devices.map((device) => (
                  <SelectItem key={device.id} value={device.id}>
                    {device.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <Button onClick={generateExcel} className="w-full">
            Generate Excel Report
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExcelReport;
