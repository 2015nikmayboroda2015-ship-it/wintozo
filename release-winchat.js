/**
 * WinChat Cleanup — «release-winchat.js»
 * Чистит ВСЕ три Supabase-проекта:
 *   1) основной  — таблицы messages/chat_members/chats + его storage;
 *   2) files1    — storage liprykmtennsmjtfpbuw (attachments/video-attachments);
 *   3) files2    — storage ahikheicrjrocnlpurpw (attachments/video-attachments).
 * Сохраняет: аватарки (bucket «avatars»), группу KEPT_GROUP_ID и официальный канал OFFICIAL_CHANNEL_ID.
 */

import { createClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";

const PROJECTS = {
  main: {
    url: "https://iksgubxxxspkjwsazrwq.supabase.co", // ← сверь с supabase.ts!
    key: "sb_publishable_uEwTj3pmRCCbVg4HaQFeOg_GFmVoaHl",
  },
  files1: {
    url: "https://liprykmtennsmjtfpbuw.supabase.co",
    key: "sb_publishable_ZYjFzVYy0VkaUTGDW9uHow_-u9HnbFn",
  },
  files2: {
    url: "https://ahikheicrjrocnlpurpw.supabase.co",
    key: "sb_publishable_9d7c7yQ1BQO_UFVhlEOWJw_RDry7zuu",
  },
};

export const KEPT_GROUP_ID = "a7296d8e-f687-422b-886f-68a8f792af92";
export const OFFICIAL_CHANNEL_ID = "00000000-0000-4000-8000-000000000001";
const KEPT_CHAT_IDS = new Set([KEPT_GROUP_ID, OFFICIAL_CHANNEL_ID]);
const KEPT_BUCKETS = new Set(["avatars"]);
const MEDIA_BUCKETS = ["attachments", "video-attachments"];
const PAGE_SIZE = 100;
const REMOVE_CHUNK = 100;

const t0 = Date.now();
const ts = () => `[+${String(Date.now() - t0).padStart(5, " ")}ms]`;
const log = (...a) => console.log(ts(), ...a);
function logSection(t) {
  console.log("\n" + "=".repeat(70));
  console.log(`${ts()} ${t}`);
  console.log("=".repeat(70));
}

function describeError(err) {
  if (!err) return "null";
  if (typeof err === "string") return err;
  const parts = [];
  if (err.message) parts.push(`message="${err.message}"`);
  if (err.code) parts.push(`code=${err.code}`);
  if (err.details) parts.push(`details=${JSON.stringify(err.details)}`);
  if (err.hint) parts.push(`hint=${JSON.stringify(err.hint)}`);
  if (err.statusCode) parts.push(`status=${err.statusCode}`);
  return parts.join(" | ") || JSON.stringify(err);
}

async function runQuery(label, fn) {
  const start = Date.now();
  log(`→ ${label}`);
  let res;
  try {
    res = await fn();
  } catch (e) {
    log(`✖ ${label} — exception: ${describeError(e)}`);
    throw e;
  }
  const ms = Date.now() - start;
  const { data, error } = res || {};
  if (error) {
    log(`✖ ${label} — ошибка (${ms}ms): ${describeError(error)}`);
    return { data: null, error };
  }
  const size = Array.isArray(data) ? `rows=${data.length}` : "data=null";
  log(`✓ ${label} — ok (${ms}ms, ${size})`);
  return { data, error: null };
}

function makeClient({ url, key }) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/* ============ Storage: рекурсивный обход ============ */

async function listAllFiles(client, bucket, prefix = "") {
  const out = [];
  let offset = 0;
  const displayPrefix = prefix === "" ? "<root>" : prefix;

  while (true) {
    const { data, error } = await runQuery(
      `storage.list(${bucket}, prefix=${displayPrefix}, offset=${offset})`,
      () =>
        client.storage.from(bucket).list(prefix, {
          limit: PAGE_SIZE,
          offset,
          sortBy: { column: "name", order: "asc" },
        })
    );
    if (error) throw error;
    const list = data || [];
    if (!list.length) break;

    for (const entry of list) {
      const name = entry?.name;
      if (!name) continue;
      const fullPath = prefix ? `${prefix}/${name}` : name;
      const isFolder = !entry?.id && !entry?.metadata;
      if (isFolder) {
        log(`  📁 папка: ${fullPath}`);
        out.push(...(await listAllFiles(client, bucket, fullPath)));
      } else {
        const size = entry?.metadata?.size ?? "?";
        const mime = entry?.metadata?.mimetype ?? "?";
        log(`  📄 файл: ${fullPath}  (${size} b, ${mime})`);
        out.push(fullPath);
      }
    }

    if (list.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return out;
}

function shouldKeep(path) {
  for (const id of KEPT_CHAT_IDS) {
    if (path === id) return true;
    if (path.startsWith(`${id}/`)) return true;
    if (path.includes(`/${id}/`)) return true;
  }
  return false;
}

async function releaseMedia(client, projectLabel) {
  const summary = {};

  for (const bucket of MEDIA_BUCKETS) {
    logSection(`${projectLabel} · Bucket: ${bucket}`);
    if (KEPT_BUCKETS.has(bucket)) {
      log(`⏭  пропущен (KEPT_BUCKETS)`);
      summary[bucket] = { total: 0, removed: 0, skipped: true };
      continue;
    }

    let allFiles = [];
    try {
      allFiles = await listAllFiles(client, bucket, "");
    } catch (e) {
      log(`✖ не удалось получить список: ${describeError(e)}`);
      summary[bucket] = { total: 0, removed: 0, error: describeError(e) };
      continue;
    }

    log(`Итого файлов в "${bucket}": ${allFiles.length}`);
    const toRemove = allFiles.filter((p) => !shouldKeep(p));
    const kept = allFiles.length - toRemove.length;
    log(`К удалению: ${toRemove.length}, сохранено (keep-группа): ${kept}`);

    if (toRemove.length === 0) {
      log(`✓ нечего удалять`);
      summary[bucket] = { total: allFiles.length, removed: 0, kept };
      continue;
    }

    let removed = 0;
    for (let i = 0; i < toRemove.length; i += REMOVE_CHUNK) {
      const chunk = toRemove.slice(i, i + REMOVE_CHUNK);
      const { error: rmError } = await runQuery(
        `storage.remove(${bucket}, ${chunk.length} файлов, батч #${i / REMOVE_CHUNK + 1})`,
        () => client.storage.from(bucket).remove(chunk)
      );
      if (rmError) {
        summary[bucket] = { total: allFiles.length, removed, kept, error: describeError(rmError) };
        break;
      }
      removed += chunk.length;
      log(`  удалено ${removed}/${toRemove.length} (${bucket})`);
    }
    if (!summary[bucket]) summary[bucket] = { total: allFiles.length, removed, kept };
  }
  return summary;
}

/* ============ Очистка основного проекта ============ */

async function cleanupMainProject() {
  logSection("Проект MAIN — таблицы + storage");
  const client = makeClient(PROJECTS.main);
  const report = { steps: {} };

  const msg = await runQuery(
    `messages.delete().neq("chat_id", ${KEPT_GROUP_ID}).neq("chat_id", ${OFFICIAL_CHANNEL_ID})`,
    () =>
      client
        .from("messages")
        .delete()
        .neq("chat_id", KEPT_GROUP_ID)
        .neq("chat_id", OFFICIAL_CHANNEL_ID)
  );
  report.steps.messages = { ok: !msg.error, error: msg.error ? describeError(msg.error) : null };
  if (msg.error) throw msg.error;

  const mem = await runQuery(
    `chat_members.delete().neq("chat_id", ${KEPT_GROUP_ID}).neq("chat_id", ${OFFICIAL_CHANNEL_ID})`,
    () =>
      client
        .from("chat_members")
        .delete()
        .neq("chat_id", KEPT_GROUP_ID)
        .neq("chat_id", OFFICIAL_CHANNEL_ID)
  );
  report.steps.chat_members = { ok: !mem.error, error: mem.error ? describeError(mem.error) : null };
  if (mem.error) throw mem.error;

  const chat = await runQuery(
    `chats.delete().neq("id", ${KEPT_GROUP_ID}).neq("id", ${OFFICIAL_CHANNEL_ID})`,
    () =>
      client
        .from("chats")
        .delete()
        .neq("id", KEPT_GROUP_ID)
        .neq("id", OFFICIAL_CHANNEL_ID)
  );
  report.steps.chats = { ok: !chat.error, error: chat.error ? describeError(chat.error) : null };
  if (chat.error) throw chat.error;

  log(`✓ группы/каналы ${KEPT_GROUP_ID}, ${OFFICIAL_CHANNEL_ID} сохранены`);
  report.steps.media = await releaseMedia(client, "MAIN");
  return report;
}

async function cleanupFilesProject(label, cfg) {
  logSection(`Проект ${label} — только storage`);
  const client = makeClient(cfg);
  const media = await releaseMedia(client, label);
  return { steps: { media } };
}

/* ============ Точка входа ============ */

export async function releaseCleanup() {
  logSection("release-winchat: СТАРТ (3 проекта)");
  log(`KEPT_GROUP_ID: ${KEPT_GROUP_ID}`);
  log(`OFFICIAL_CHANNEL_ID: ${OFFICIAL_CHANNEL_ID}`);
  log(`MAIN:    ${PROJECTS.main.url}`);
  log(`FILES1:  ${PROJECTS.files1.url}`);
  log(`FILES2:  ${PROJECTS.files2.url}`);

  const out = { ok: false, projects: {} };

  out.projects.main = await cleanupMainProject();
  out.projects.files1 = await cleanupFilesProject("FILES1", PROJECTS.files1);
  out.projects.files2 = await cleanupFilesProject("FILES2", PROJECTS.files2);

  logSection("ИТОГ");
  for (const [name, r] of Object.entries(out.projects)) {
    log(`— ${name}:`);
    for (const [bucket, s] of Object.entries(r.steps.media || {})) {
      if (s.skipped) log(`    ${bucket}: пропущен`);
      else if (s.error) log(`    ${bucket}: ОШИБКА — ${s.error} (удалено ${s.removed}/${s.total})`);
      else log(`    ${bucket}: ${s.removed}/${s.total} удалено (keep: ${s.kept ?? 0})`);
    }
    if (r.steps.messages) log(`    messages: ${r.steps.messages.ok ? "ok" : "ОШИБКА"}`);
    if (r.steps.chat_members) log(`    chat_members: ${r.steps.chat_members.ok ? "ok" : "ОШИБКА"}`);
    if (r.steps.chats) log(`    chats: ${r.steps.chats.ok ? "ok" : "ОШИБКА"}`);
  }
  out.ok = true;
  out.keptGroupId = KEPT_GROUP_ID;
  out.keptChannelId = OFFICIAL_CHANNEL_ID;
  log(`✓ всё завершено`);
  return out;
}

export default releaseCleanup;

const isDirectRun = (() => {
  try {
    return !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  releaseCleanup()
    .then((r) => {
      console.log("\n" + JSON.stringify(r, null, 2));
      process.exit(0);
    })
    .catch((e) => {
      console.error("\n▶ release-winchat: фатальная ошибка:", describeError(e));
      process.exit(1);
    });
}