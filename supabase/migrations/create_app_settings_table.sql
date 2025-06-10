
-- Create app_settings table for storing application configuration
CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Allow everyone to read app settings
CREATE POLICY "Allow read access to app_settings" ON public.app_settings
  FOR SELECT USING (true);

-- Only superadmins can insert/update app settings
CREATE POLICY "Allow superadmins to insert app_settings" ON public.app_settings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

CREATE POLICY "Allow superadmins to update app_settings" ON public.app_settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

-- Insert default about information
INSERT INTO public.app_settings (key, value) 
VALUES (
  'about_info',
  '{
    "title": "IoT Dashboard",
    "description": "Smart Monitoring System untuk monitoring IoT devices dengan real-time data visualization dan weather prediction.",
    "version": "1.0.0",
    "developer": "Astrodev Team",
    "company": "Lovable x Astrodev",
    "contact_email": "info@astrodev.com",
    "website": "https://astrodev.com",
    "copyright": "Copyright © 2025 Lovable x Astrodev. All rights reserved."
  }'::jsonb
) ON CONFLICT (key) DO NOTHING;
