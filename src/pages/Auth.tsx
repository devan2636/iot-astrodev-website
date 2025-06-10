
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast({
        title: 'Login berhasil',
        description: 'Anda telah berhasil masuk',
      });
      
      navigate('/');
    } catch (error: any) {
      console.error('Login error:', error);
      toast({
        title: 'Login gagal',
        description: error.message || 'Terjadi kesalahan saat login',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;

      // Send custom verification email
      try {
        await fetch('/functions/v1/send-verification-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            email,
            name: username || email.split('@')[0],
            confirmationUrl: `${window.location.origin}/auth/confirm`,
          }),
        });
      } catch (emailError) {
        console.error('Error sending custom verification email:', emailError);
      }

      toast({
        title: 'Registrasi berhasil',
        description: 'Silakan periksa email Anda untuk verifikasi akun',
      });
      
      // Reset form
      setEmail('');
      setPassword('');
      setUsername('');
    } catch (error: any) {
      console.error('Registration error:', error);
      toast({
        title: 'Registrasi gagal',
        description: error.message || 'Terjadi kesalahan saat registrasi',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-gradient-to-br from-blue-50 to-cyan-100 flex overflow-hidden">
      {/* Left Side - IoT Concept Illustration */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-500 to-cyan-600 relative">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative z-10 flex flex-col justify-center items-center p-8 text-white">
          <div className="max-w-lg text-center">
            <h1 className="text-3xl font-bold mb-4">Astrodev-IoT</h1>
            <h2 className="text-xl font-semibold mb-3">Smart IoT Management Platform</h2>
            <p className="text-base mb-6 opacity-90">
              Platform manajemen IoT yang menghubungkan sensor, gateway, dan cloud dalam satu ekosistem terintegrasi
            </p>
            
            {/* IoT Concept Visualization - Compact */}
            <div className="relative mb-6">
              {/* Central Gateway */}
              <div className="mx-auto w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-6 border-2 border-white/30">
                <div className="w-10 h-10 bg-white/30 rounded-lg flex items-center justify-center">
                  <span className="text-xl">🌐</span>
                </div>
              </div>
              
              {/* Sensors around Gateway */}
              <div className="flex justify-center space-x-6 mb-4">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-1 border border-white/30">
                    <span className="text-lg">🌡️</span>
                  </div>
                  <span className="text-xs">Temperature</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-1 border border-white/30">
                    <span className="text-lg">💧</span>
                  </div>
                  <span className="text-xs">Humidity</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-1 border border-white/30">
                    <span className="text-lg">💡</span>
                  </div>
                  <span className="text-xs">Smart Device</span>
                </div>
              </div>
              
              {/* Cloud Connection */}
              <div className="flex flex-col items-center">
                <div className="w-16 h-12 bg-white/20 rounded-lg flex items-center justify-center border border-white/30">
                  <span className="text-xl">☁️</span>
                </div>
                <span className="text-xs mt-1">Cloud Platform</span>
              </div>
              
              {/* Connection Lines */}
              <svg className="absolute inset-0 w-full h-full" style={{ zIndex: -1 }}>
                <defs>
                  <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{ stopColor: 'rgba(255,255,255,0.3)' }} />
                    <stop offset="100%" style={{ stopColor: 'rgba(255,255,255,0.1)' }} />
                  </linearGradient>
                </defs>
                <line x1="50%" y1="20%" x2="20%" y2="60%" stroke="url(#connectionGradient)" strokeWidth="2" strokeDasharray="5,5">
                  <animate attributeName="stroke-dashoffset" values="0;10" dur="2s" repeatCount="indefinite" />
                </line>
                <line x1="50%" y1="20%" x2="50%" y2="60%" stroke="url(#connectionGradient)" strokeWidth="2" strokeDasharray="5,5">
                  <animate attributeName="stroke-dashoffset" values="0;10" dur="2s" repeatCount="indefinite" />
                </line>
                <line x1="50%" y1="20%" x2="80%" y2="60%" stroke="url(#connectionGradient)" strokeWidth="2" strokeDasharray="5,5">
                  <animate attributeName="stroke-dashoffset" values="0;10" dur="2s" repeatCount="indefinite" />
                </line>
                <line x1="50%" y1="35%" x2="50%" y2="75%" stroke="url(#connectionGradient)" strokeWidth="2" strokeDasharray="5,5">
                  <animate attributeName="stroke-dashoffset" values="0;10" dur="2s" repeatCount="indefinite" />
                </line>
              </svg>
            </div>
          </div>
          
          {/* Developer Info */}
          <div className="text-center">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
              <p className="text-xs opacity-90 mb-1">Developed by</p>
              <p className="font-semibold text-sm">Astrodev Team</p>
              <p className="text-xs opacity-75">Lovable x Astrodev</p>
              <p className="text-xs opacity-60 mt-1">info@astrodev.com</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Astrodev-IoT</h1>
            <p className="text-gray-600 text-sm">Smart IoT Management Platform</p>
          </div>
          
          <Card className="shadow-xl border-0">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl text-center">Welcome Back</CardTitle>
              <CardDescription className="text-center text-sm">
                Masuk atau daftar untuk mengelola perangkat IoT Anda
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-4">
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Login</TabsTrigger>
                  <TabsTrigger value="register">Register</TabsTrigger>
                </TabsList>
                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="email" className="text-sm">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="email@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-sm">Password</Label>
                        <Button variant="link" className="p-0 h-auto text-xs" type="button">
                          Lupa password?
                        </Button>
                      </div>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="h-9"
                      />
                    </div>
                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-9" disabled={loading}>
                      {loading ? 'Memuat...' : 'Login'}
                    </Button>
                  </form>
                </TabsContent>
                <TabsContent value="register">
                  <form onSubmit={handleSignUp} className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="register-username" className="text-sm">Username</Label>
                      <Input
                        id="register-username"
                        type="text"
                        placeholder="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="register-email" className="text-sm">Email</Label>
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="email@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="register-password" className="text-sm">Password</Label>
                      <Input
                        id="register-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        className="h-9"
                      />
                    </div>
                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-9" disabled={loading}>
                      {loading ? 'Memuat...' : 'Register'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
            <CardFooter className="flex flex-col space-y-3 pt-0">
              <p className="text-xs text-center text-gray-500">
                Dengan melanjutkan, Anda menyetujui Syarat Penggunaan dan Kebijakan Privasi kami.
              </p>
              
              {/* Developer Info for Mobile */}
              <div className="lg:hidden text-center">
                <div className="bg-gray-50 rounded-lg p-2 border">
                  <p className="text-xs text-gray-600 mb-1">Developed by</p>
                  <p className="text-sm font-semibold text-gray-800">Astrodev Team</p>
                  <p className="text-xs text-gray-500">Lovable x Astrodev</p>
                  <p className="text-xs text-gray-400 mt-1">info@astrodev.com</p>
                </div>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Auth;
