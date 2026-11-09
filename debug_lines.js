import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://iksgubxxxspkjwsazrwq.supabase.co";
const SUPABASE_KEY = "sb_publishable_uEwTj3pmRCCbVg4HaQFeOg_GFmVoaHl";

const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function walk(bucket, prefix = "", depth = 0) {
  const pad = "  ".repeat(depth);
  const { data, error } = await client.storage.from(bucket).list(prefix, { limit: 100 });
  if (error) {
    console.log(`${pad}❌ ${prefix || "<root>"}: ${error.message}`);
    return;
  }
  for (const e of data || []) {
    const full = prefix ? `${prefix}/${e.name}` : e.name;
    const isFolder = !e.id && !e.metadata;
    console.log(`${pad}${isFolder ? "📁" : "📄"} ${full}${isFolder ? "" : `  (${e.metadata?.size ?? "?"} b)`}`);
    if (isFolder) await walk(bucket, full, depth + 1);
  }
}

for (const bucket of ["attachments", "video-attachments"]) {
  console.log(`\n=== ${bucket} ===`);
  await walk(bucket);
}