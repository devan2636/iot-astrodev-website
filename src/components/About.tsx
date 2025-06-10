
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
  const [aboutData, setAboutData] = useState<AboutData>({
    title: 'IoT Dashboard',
    description: 'Smart Monitoring System untuk monitoring IoT devices dengan real-time data visualization dan weather prediction.',
    version: '1.0.0',
    developer: 'Astrodev Team',
    company: 'Lovable x Astrodev',
    contact_email: 'info@astrodev.com',
    website: 'https://astrodev.com',
    copyright: 'Copyright © 2025 Lovable x Astrodev. All rights reserved.'
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
        console.error('Error fetching about data:', error);
        return;
      }

      if (data && data.value) {
        // Cast through unknown first to satisfy TypeScript
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
        .update({
          value: aboutData as any, // Cast to any to satisfy Json type requirement
          updated_at: new Date().toISOString()
        })
        .eq('key', 'about_info');

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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">About</h1>
          <p className="text-gray-600">Informasi tentang aplikasi dan pengembang</p>
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

      <Card>
        <CardHeader>
          <CardTitle>{aboutData.title}</CardTitle>
          <CardDescription>Smart IoT Monitoring System</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isEditing && isSuperAdmin ? (
            <div className="space-y-4">
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
                  <Label htmlFor="developer">Developer</Label>
                  <Input
                    id="developer"
                    value={aboutData.developer}
                    onChange={(e) => setAboutData({...aboutData, developer: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company">Company</Label>
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
                <Label htmlFor="copyright">Copyright</Label>
                <Input
                  id="copyright"
                  value={aboutData.copyright}
                  onChange={(e) => setAboutData({...aboutData, copyright: e.target.value})}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Deskripsi</h3>
                <p className="text-gray-600">{aboutData.description}</p>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Informasi Aplikasi</h3>
                  <div className="space-y-2">
                    <div>
                      <span className="font-medium">Version:</span>
                      <span className="ml-2 text-gray-600">{aboutData.version}</span>
                    </div>
                    <div>
                      <span className="font-medium">Developer:</span>
                      <span className="ml-2 text-gray-600">{aboutData.developer}</span>
                    </div>
                    <div>
                      <span className="font-medium">Company:</span>
                      <span className="ml-2 text-gray-600">{aboutData.company}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Kontak</h3>
                  <div className="space-y-2">
                    <div>
                      <span className="font-medium">Email:</span>
                      <span className="ml-2 text-gray-600">{aboutData.contact_email}</span>
                    </div>
                    <div>
                      <span className="font-medium">Website:</span>
                      <a 
                        href={aboutData.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="ml-2 text-blue-600 hover:underline"
                      >
                        {aboutData.website}
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="text-center">
                <p className="text-sm text-gray-500">{aboutData.copyright}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default About;
