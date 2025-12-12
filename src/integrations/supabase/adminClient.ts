import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Vite exposes env vars via `import.meta.env`. `process` is not defined in the browser,
// which caused the runtime error "process is not defined". We prefer `import.meta.env`
// and avoid creating a service-role admin client on the client-side (browser).

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || (import.meta.env.SUPABASE_URL as string) || (
  typeof process !== 'undefined' && (process.env?.REACT_APP_SUPABASE_URL || process.env?.SUPABASE_URL)
) || '';

const SUPABASE_SERVICE_ROLE_KEY = (import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY as string) || (import.meta.env.SUPABASE_SERVICE_ROLE_KEY as string) || (
  typeof process !== 'undefined' && (process.env?.REACT_APP_SUPABASE_SERVICE_ROLE_KEY || process.env?.SUPABASE_SERVICE_ROLE_KEY)
) || '';

const isClient = typeof window !== 'undefined';

if (isClient) {
  // Prevent accidental exposure of the service role key in browser bundles.
  // If client code imports this module, return `null` and warn instead of throwing,
  // so the app can continue to run (but without admin privileges).
  // NOTE: Admin operations should run on a secure server environment only.
  // eslint-disable-next-line no-console
  console.warn('supabaseAdmin: service-role client is not created in browser. Use server-side code for admin operations.');
}

export const supabaseAdmin: any = isClient
  ? null
  : createClient<Database>(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
