// Supabase Admin Client
// Uses service_role key for full database access (backend only!)

import { createClient } from '@supabase/supabase-js';

// Works with both Railway (process.env) and local (.env file)
let supabaseUrl = process.env.SUPABASE_URL;
let supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// Only try to load dotenv if running locally (not on Railway)
if (!supabaseUrl || !supabaseServiceKey) {
  try {
    const dotenv = await import('dotenv');
    dotenv.config();
    supabaseUrl = process.env.SUPABASE_URL;
    supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  } catch (e) {
    // dotenv not available, that's fine on Railway
  }
}

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  console.error('   On Railway: Add these in the Variables tab');
  console.error('   Locally: Create .env file from .env.example');
  process.exit(1);
}

console.log('✅ Supabase URL:', supabaseUrl);

// Create admin client with service role key
// This bypasses Row Level Security - only use on backend!
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export default supabase;
