/**
 * Обёртка над нативным плагином WinChatStorage (Android).
 *
 * Плагин умеет:
 *  - создавать DCIM/WinChat/Photos, DCIM/WinChat/Video и /winchat/account_settings/;
 *  - сохранять фото/видео из чата в общую галерею;
 *  - хранить зашифрованный снимок настроек аккаунта (AES-GCM + Android Keystore).
 */
import { Capacitor, registerPlugin } from "@capacitor/core";

export interface StoredFolderInfo {
  photos: string;
  videos: string;
  settings: string;
  native: boolean;
}

export interface SaveMediaResult {
  saved: boolean;
  path?: string;
  uri?: string;
  fileName?: string;
}

interface WinChatStoragePlugin {
  ensureFolders(): Promise<StoredFolderInfo>;
  saveMedia(options: {
    url?: string;
    base64?: string;
    kind: "photo" | "video";
    fileName?: string;
  }): Promise<SaveMediaResult>;
  saveSettings(options: { data: string }): Promise<{ saved: boolean; path?: string }>;
  loadSettings(): Promise<{ data: string | null; exists: boolean; path?: string; error?: string }>;
  clearSettings(): Promise<{ cleared: boolean }>;
}

const WinChatStorage = registerPlugin<WinChatStoragePlugin>("WinChatStorage");

export function isNativeStorageAvailable(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  } catch {
    return false;
  }
}

export async function ensureWinChatFolders(): Promise<StoredFolderInfo | null> {
  if (!isNativeStorageAvailable()) return null;
  try {
    return await WinChatStorage.ensureFolders();
  } catch {
    return null;
  }
}

export async function saveMediaNative(
  url: string,
  kind: "photo" | "video",
  fileName: string
): Promise<SaveMediaResult | null> {
  if (!isNativeStorageAvailable()) return null;
  try {
    return await WinChatStorage.saveMedia({ url, kind, fileName });
  } catch {
    return null;
  }
}

export async function saveSettingsNative(data: string): Promise<boolean> {
  if (!isNativeStorageAvailable()) return false;
  try {
    const res = await WinChatStorage.saveSettings({ data });
    return !!res.saved;
  } catch {
    return false;
  }
}

export async function loadSettingsNative(): Promise<string | null> {
  if (!isNativeStorageAvailable()) return null;
  try {
    const res = await WinChatStorage.loadSettings();
    return res?.data ?? null;
  } catch {
    return null;
  }
}

export async function clearSettingsNative(): Promise<boolean> {
  if (!isNativeStorageAvailable()) return false;
  try {
    const res = await WinChatStorage.clearSettings();
    return !!res.cleared;
  } catch {
    return false;
  }
}
