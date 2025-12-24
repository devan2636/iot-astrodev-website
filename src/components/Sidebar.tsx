import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Home, 
  Smartphone, 
  Settings, 
  Activity,
  Gauge,
  LogOut,
  Cloud,
  Zap,
  ChevronLeft,
  ChevronRight,
  Info
} from 'lucide-react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface SidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  user: User | null;
  onLogout: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  readonly?: boolean;
}

const Sidebar = ({ currentPage, onPageChange, user, onLogout }: SidebarProps) => {
  const [userRole, setUserRole] = useState<string>('user');
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUserRole();
    }
  }, [user]);

  const fetchUserRole = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user?.id)
        .single();
      
      if (profile) {
        setUserRole(profile.role || 'user');
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
    }
  };

  const getMenuItems = (): MenuItem[] => {
    const baseItems: MenuItem[] = [
      { id: 'dashboard', label: 'Dashboard', icon: Home },
    ];

    if (userRole === 'user') {
      return [
        ...baseItems,
        { id: 'devices', label: 'Devices', icon: Smartphone, readonly: true },
        { id: 'sensors', label: 'Sensors', icon: Gauge, readonly: true },
        { id: 'settings', label: 'Settings', icon: Settings },
        { id: 'about', label: 'About', icon: Info },
      ];
    }

    // Admin and Superadmin have full access
    return [
      ...baseItems,
      { id: 'devices', label: 'Devices', icon: Smartphone },
      { id: 'sensors', label: 'Sensors', icon: Gauge },
      { id: 'monitoring', label: 'Monitoring', icon: Activity },
      { id: 'public-access', label: 'Public Access', icon: Info },
      // { id: 'weather-station', label: 'Weather Station', icon: Cloud },
      // { id: 'prediction', label: 'Weather Prediction', icon: Zap },
      { id: 'settings', label: 'Settings', icon: Settings },
      { id: 'about', label: 'About', icon: Info },
    ];
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'superadmin':
        return 'bg-red-100 text-red-600';
      case 'admin':
        return 'bg-blue-100 text-blue-600';
      default:
        return 'bg-green-100 text-green-600';
    }
  };

  const menuItems = getMenuItems();

  return (
    <div className={`${isMinimized ? 'w-16' : 'w-64'} bg-gradient-to-b from-blue-500 to-blue-800 shadow-lg min-h-screen flex flex-col transition-all duration-300`}>
      {/* Header */}
      <div className="p-6 border-b border-blue-400/30">
        <div className="flex items-center justify-between">
          {!isMinimized && (
            <div>
              <h1 className="text-xl font-bold text-white">IoT Dashboard</h1>
              <p className="text-sm text-blue-100">Smart Monitoring System</p>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMinimized(!isMinimized)}
            className="ml-auto text-white hover:bg-white/10"
          >
            {isMinimized ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* User Info */}
      <div className="p-4 border-b border-blue-400/30">
        <div className="flex items-center space-x-3">
          <Avatar>
            <AvatarFallback className="bg-blue-100 text-blue-600">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          {!isMinimized && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.email?.split('@')[0] || 'User'}
                </p>
                <p className="text-xs text-blue-100 truncate">{user?.email}</p>
              </div>
              <div className="flex flex-col space-y-1">
                <Badge variant="secondary" className="text-xs">Online</Badge>
                <Badge className={`text-xs ${getRoleBadgeColor(userRole)}`}>
                  {userRole}
                </Badge>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            const isReadonly = item.readonly || false;
            
            return (
              <li key={item.id}>
                <Button
                  variant={isActive ? "default" : "ghost"}
                  className={`w-full ${isMinimized ? 'justify-center px-3' : 'justify-start'} ${
                    isActive 
                      ? 'bg-white/20 text-white hover:bg-white/30' 
                      : 'text-white hover:bg-white/10'
                  } ${isReadonly ? 'opacity-75' : ''}`}
                  onClick={() => onPageChange(item.id)}
                  title={isMinimized ? item.label : undefined}
                >
                  <Icon className={`h-4 w-4 ${!isMinimized ? 'mr-3' : ''}`} />
                  {!isMinimized && (
                    <>
                      {item.label}
                      {isReadonly && <span className="ml-auto text-xs">(View)</span>}
                    </>
                  )}
                </Button>
              </li>
            );
          })}
        </ul>

        {/* Role Information */}
        {userRole === 'user' && !isMinimized && (
          <div className="mt-6 p-3 bg-white/10 rounded-lg">
            <p className="text-xs text-white font-medium mb-1">User Access</p>
            <p className="text-xs text-blue-100">
              Anda memiliki akses terbatas. Hubungi admin untuk akses lebih lanjut.
            </p>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-blue-400/30">
        <Button
          variant="ghost"
          className={`w-full ${isMinimized ? 'justify-center px-3' : 'justify-start'} text-white hover:bg-white/10`}
          onClick={onLogout}
          title={isMinimized ? "Logout" : undefined}
        >
          <LogOut className={`h-4 w-4 ${!isMinimized ? 'mr-3' : ''}`} />
          {!isMinimized && "Logout"}
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;
