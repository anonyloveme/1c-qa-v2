import { createClient } from "@supabase/supabase-js";

let cachedClient;

export function createSupabaseServerClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Thiếu SUPABASE_URL hoặc SUPABASE_ANON_KEY trong môi trường server.");
  }

  cachedClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedClient;
}