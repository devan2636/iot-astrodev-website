import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { Separator } from '@/components/ui/separator';
import { Building2, Code2, Globe, Mail, ShieldCheck } from 'lucide-react';

interface AboutProps {
  user: User | null;
}

interface AboutData {
  title: string;
  description: string;
  version: string;
  developer: string;
  company: string;
  contact_email: string;
  website: string;
  copyright: string;
}

const About = ({ user }: AboutProps) => {
  // --- DEFAULT STATE (Hardcoded Data) ---
  // Data ini akan muncul langsung meskipun database belum disetting
  const [aboutData, setAboutData] = useState<AboutData>({
    title: 'Astrodev IoT Dashboard',
    description: 'Sistem Monitoring Cerdas untuk perangkat IoT dengan visualisasi data real-time, prediksi cuaca, dan peringatan dini banjir.',
    version: '1.0.0',
    developer: 'Devandri Suherman & Firdaus',
    company: 'School of Electrical Engineering and Informatics',
    contact_email: 'devandrisuherman9@gmail.com',
    website: 'https://astrodev.cloud',
    copyright: 'Copyright © 2025 Astrodev. All rights reserved.'
  });
  
  const [isEditing, setIsEditing] = useState(false);
  const [userRole, setUserRole] = useState<string>('user');
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchUserRole();
      fetchAboutData();
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

  const fetchAboutData = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'about_info')
        .single();

      if (error) {
        // Jika error/kosong, biarkan menggunakan default state di atas
        console.log('Using default about data');
        return;
      }

      if (data && data.value) {
        setAboutData(data.value as unknown as AboutData);
      }
    } catch (error) {
      console.error('Error fetching about data:', error);
    }
  };

  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          key: 'about_info',
          value: aboutData as any,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

      if (error) throw error;

      setIsEditing(false);
      toast({
        title: "Berhasil Disimpan",
        description: "Informasi About berhasil diperbarui",
      });
    } catch (error) {
      console.error('Error saving about data:', error);
      toast({
        title: "Error",
        description: "Gagal menyimpan informasi About",
        variant: "destructive",
      });
    }
  };

  const isSuperAdmin = userRole === 'superadmin';

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">About</h1>
          <p className="text-gray-600">Informasi Sistem & Pengembang</p>
        </div>
        {isSuperAdmin && (
          <div className="space-x-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  Save Changes
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)}>
                Edit Information
              </Button>
            )}
          </div>
        )}
      </div>

      <Card className="shadow-md overflow-hidden border-slate-200">
        {/* HEADER GAMBAR LOGO */}
        <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-8 border-b flex justify-center items-center">
             <img 
               src="/logo-astrodev.png" 
               alt="Astrodev Logo" 
               className="h-32 w-auto object-contain drop-shadow-sm transition-transform hover:scale-105 duration-300"
             />
        </div>

        <CardContent className="p-6 md:p-8 space-y-8">
          {isEditing && isSuperAdmin ? (
            /* --- FORM EDIT MODE (Hanya Admin) --- */
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Application Title</Label>
                  <Input
                    id="title"
                    value={aboutData.title}
                    onChange={(e) => setAboutData({...aboutData, title: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="version">Version</Label>
                  <Input
                    id="version"
                    value={aboutData.version}
                    onChange={(e) => setAboutData({...aboutData, version: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="developer">Developers</Label>
                  <Input
                    id="developer"
                    value={aboutData.developer}
                    onChange={(e) => setAboutData({...aboutData, developer: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company">Affiliation / Company</Label>
                  <Input
                    id="company"
                    value={aboutData.company}
                    onChange={(e) => setAboutData({...aboutData, company: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact_email">Contact Email</Label>
                  <Input
                    id="contact_email"
                    type="email"
                    value={aboutData.contact_email}
                    onChange={(e) => setAboutData({...aboutData, contact_email: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={aboutData.website}
                    onChange={(e) => setAboutData({...aboutData, website: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={aboutData.description}
                  onChange={(e) => setAboutData({...aboutData, description: e.target.value})}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="copyright">Copyright Text</Label>
                <Input
                  id="copyright"
                  value={aboutData.copyright}
                  onChange={(e) => setAboutData({...aboutData, copyright: e.target.value})}
                />
              </div>
            </div>
          ) : (
            /* --- VIEW MODE (Tampilan Default/Public) --- */
            <div className="space-y-8 text-center md:text-left">
              
              {/* Judul & Deskripsi */}
              <div className="text-center space-y-4">
                <h2 className="text-3xl font-bold text-slate-800 tracking-tight">{aboutData.title}</h2>
                <Badge variant="secondary" className="px-3 py-1 text-sm bg-slate-100 text-slate-600 hover:bg-slate-200">
                  Version {aboutData.version}
                </Badge>
                <p className="text-slate-600 max-w-3xl mx-auto leading-relaxed text-base">
                  {aboutData.description}
                </p>
              </div>

              <Separator />

              {/* Grid Informasi */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:px-12">
                
                {/* Tim Pengembang */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 justify-center md:justify-start">
                    <Code2 className="w-5 h-5 text-blue-600" />
                    Development Team
                  </h3>
                  <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 shadow-sm text-left">
                    <div className="mb-4">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Developers</span>
                      <p className="text-slate-800 font-semibold text-base">{aboutData.developer}</p>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Affiliation</span>
                      <div className="flex items-start gap-2">
                        <Building2 className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                        <p className="text-slate-700 font-medium text-sm leading-snug">{aboutData.company}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Kontak & Lisensi */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 justify-center md:justify-start">
                    <ShieldCheck className="w-5 h-5 text-green-600" />
                    Contact & License
                  </h3>
                  <div className="space-y-4 bg-white p-2 rounded-xl">
                    <div className="flex items-center gap-4 justify-center md:justify-start group">
                      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors">
                        <Mail className="w-5 h-5" />
                      </div>
                      <span className="text-slate-600 font-medium">{aboutData.contact_email}</span>
                    </div>
                    <div className="flex items-center gap-4 justify-center md:justify-start group">
                      <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 group-hover:bg-purple-100 transition-colors">
                        <Globe className="w-5 h-5" />
                      </div>
                      <a 
                        href={aboutData.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 font-medium hover:underline hover:text-blue-700 transition-colors"
                      >
                        {aboutData.website}
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="text-center pt-2">
                <p className="text-sm text-slate-400 font-medium">
                  {aboutData.copyright}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default About_awlr;