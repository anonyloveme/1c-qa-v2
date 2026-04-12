// scripts/keepalive.js
// Chạy trực tiếp với Node.js — không cần Next.js runtime
// Dùng bởi Render cron job để ping Supabase mỗi 3 ngày

const { createClient } = require("@supabase/supabase-js");

const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("[keepalive] Thiếu SUPABASE_URL hoặc SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function keepAlive() {
  console.log(`[keepalive] ${new Date().toISOString()} — pinging Supabase...`);

  const { error, count } = await supabase
    .from("chunks")
    .select("id", { count: "exact", head: true })
    .limit(1);

  if (error) {
    console.error("[keepalive] Lỗi:", error.message);
    process.exit(1);
  }

  console.log(`[keepalive] OK — Supabase active (chunks: ${count ?? "?"})`);
  process.exit(0);
}

keepAlive();
