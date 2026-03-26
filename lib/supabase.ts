// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

// Get environment variables (these must be set in Vercel and your local .env)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// 1. Client‑side Supabase client (uses anon key, respects RLS)
// Use this in React components, but NOT in API routes if you want to bypass RLS.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 2. Server‑side admin client (uses service role key, bypasses RLS)
// Use this ONLY in API routes, never expose it to the client.
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);