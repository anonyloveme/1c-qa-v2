import { createSupabaseServerClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = { ok: true, supabase: false, ts: new Date().toISOString() };

  try {
    const supabase = createSupabaseServerClient();
    // Lightweight ping: count 1 row — chỉ đủ để keep Supabase awake
    const { error } = await supabase
      .from("chunks")
      .select("id", { count: "exact", head: true })
      .limit(1);

    status.supabase = !error;
    if (error) status.supabaseError = error.message;
  } catch (err) {
    status.ok = false;
    status.supabaseError = err?.message ?? "unknown";
  }

  return Response.json(status, { status: status.ok ? 200 : 503 });
}
