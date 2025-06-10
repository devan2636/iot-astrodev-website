
import React from 'react';
import WeatherStationGuide from '@/components/WeatherStationGuide';

const WeatherStation = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Weather Station</h1>
          <p className="text-gray-600">Program lengkap ESP32 untuk Weather Station IoT</p>
        </div>
        <WeatherStationGuide />
      </div>
    </div>
  );
};

export default WeatherStation;
