
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Login from '../pages/Login';
import Dashboard from '../components/Dashboard';
import Devices from '../components/Devices';
import Sensors from '../components/Sensors';
import Monitoring from '../components/Monitoring';
import Settings from '../components/Settings';
import WeatherPrediction from '../components/WeatherPrediction';
import About from '../components/About';
import Sidebar from '../components/Sidebar';
import Auth from './Auth';
import WeatherStation from './WeatherStation';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { useToast } from '@/hooks/use-toast';

const Index = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const user = session?.user ?? null;
        setCurrentUser(user);
        setIsLoggedIn(!!user);
        
        if (event === 'SIGNED_IN') {
          toast({
            title: 'Login berhasil',
            description: 'Anda telah berhasil masuk',
          });
        } else if (event === 'SIGNED_OUT') {
          navigate('/auth');
        }
      }
    );

    // Check for existing session
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user ?? null;
        setCurrentUser(user);
        setIsLoggedIn(!!user);
      } catch (error) {
        console.error('Error checking session:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Set up device status update interval - update every 30 seconds for more responsive detection
    const updateDeviceStatus = async () => {
      try {
        console.log('Updating device status...');
        const { data, error } = await supabase.functions.invoke('update-device-status');
        
        if (error) {
          console.error('Error invoking update-device-status:', error);
        } else {
          console.log('Device status update result:', data);
        }
      } catch (error) {
        console.error('Error updating device status:', error);
      }
    };

    // Run immediately and then every 30 seconds
    updateDeviceStatus();
    const statusInterval = setInterval(updateDeviceStatus, 30000);

    return () => {
      subscription?.unsubscribe();
      clearInterval(statusInterval);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setCurrentUser(null);
      setIsLoggedIn(false);
      setCurrentPage('dashboard');
      navigate('/auth');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'devices':
        return <Devices />;
      case 'sensors':
        return <Sensors />;
      case 'monitoring':
        return <Monitoring />;
      case 'weather-station':
        return <WeatherStation />;
      case 'prediction':
        return <WeatherPrediction />;
      case 'settings':
        return <Settings user={currentUser} />;
      case 'about':
        return <About user={currentUser} />;
      default:
        return <Dashboard />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Auth />;
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="flex flex-1">
        <Sidebar
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          user={currentUser}
          onLogout={handleLogout}
        />
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            {renderCurrentPage()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;
