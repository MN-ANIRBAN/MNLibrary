import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase configuration in .env file.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'mnlib_auth_v1',   // Custom key prevents collisions
  },
  realtime: {
    params: {
      eventsPerSecond: 10,          // Throttle realtime events — reduce server load
    },
  },
  global: {
    headers: {
      'x-app-version': '1.0.0',    // Helps Supabase logs identify your app
    },
  },
});

