import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Второй сервер хранения медиа — ahikheicrjrocnlpurpw.supabase.co
 */
const FILES2_URL = "https://ahikheicrjrocnlpurpw.supabase.co";
const FILES2_KEY = "sb_publishable_9d7c7yQ1BQO_UFVhlEOWJw_RDry7zuu";

export const files2Client: SupabaseClient = createClient(FILES2_URL, FILES2_KEY);

const PUBLIC_BASE2 = `${FILES2_URL}/storage/v1/object/public`;

/** Публичный URL файла во втором хранилище. */
export function files2PublicUrl(bucket: string, path: string): string {
  return `${PUBLIC_BASE2}/${bucket}/${path}`;
}

/** Загрузить файл во второе хранилище. */
export async function files2Upload(
  bucket: string,
  path: string,
  data: Blob | File,
  contentType?: string
): Promise<string> {
  const { error } = await files2Client.storage.from(bucket).upload(path, data, {
    upsert: true,
    cacheControl: "31536000",
    contentType,
  });
  if (error) throw error;
  return files2PublicUrl(bucket, path);
}
