/**
 * Пуш-уведомления WinChat — веб (Push API) и Android (Capacitor).
 *
 * Подписка хранится в таблице public.push_subscriptions.
 * Для отправки пуш-сообщений используется VAPID-ключ (серверная часть —
 * Edge Function или отдельный сервер; здесь только клиентская подписка
 * и получение сообщений через Service Worker).
 *
 * Перед использованием нужно:
 *   1. Применить winchat_update_10_push.sql в Supabase.
 *   2. Сгенерировать VAPID-ключ и положить PUBLIC_VAPID_KEY в .env.local.
 *   3. Зарегистрировать service worker (публичному пути /sw.js).
 */

import { supabase } from "./supabase";

/** Публичный VAPID-ключ (из переменных окружения Vite). */
const PUBLIC_VAPID_KEY = import.meta.env.VITE_PUBLIC_VAPID_KEY || null;

/** Текущая платформа. */
export function getPlatform(): string {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  return "web";
}

/** URL-safe base64 кодирование массива байт. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

/** Получить текущие подписки пользователя из Supabase. */
export async function getMyPushSubscriptions() {
  const { data, error } = await supabase.rpc("get_my_push_subscriptions");
  if (error) throw error;
  return (data || []) as Array<{
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    user_agent: string | null;
    created_at: string;
  }>;
}

/** Сохранить подписку в Supabase. */
export async function savePushSubscription(
  endpoint: string,
  p256dh: string,
  auth: string,
  userAgent?: string
) {
  const { data, error } = await supabase.rpc("save_push_subscription", {
    _endpoint: endpoint,
    _p256dh: p256dh,
    _auth: auth,
    _user_agent: userAgent || getPlatform()
  });
  if (error) throw error;
  return data;
}

/** Удалить подписку по endpoint. */
export async function removePushSubscription(endpoint: string) {
  const { data, error } = await supabase.rpc("remove_push_subscription", {
    _endpoint: endpoint
  });
  if (error) throw error;
  return data;
}

/** Оформить подписку на веб-пуш (Push API). */
export async function subscribeWebPush(): Promise<{
  endpoint: string;
  p256dh: string;
  auth: string;
}> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service Worker не поддерживается браузером");
  }
  if (!("PushManager" in window)) {
    throw new Error("Push API не поддерживается браузером");
  }
  if (!PUBLIC_VAPID_KEY) {
    throw new Error("VITE_PUBLIC_VAPID_KEY не задан — пуш-уведомления отключены");
  }

  // Регистрируем service worker
  const registration = await navigator.serviceWorker.register("/sw.js", {
    scope: "/"
  });

  // Проверяем existing подписку
  let subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    return {
      endpoint: subscription.endpoint,
      p256dh: btoa(
        String.fromCharCode.apply(
          null,
          Array.from(new Uint8Array(subscription.getKey("p256dh") as any))
        )
      ),
      auth: btoa(
        String.fromCharCode.apply(
          null,
          Array.from(new Uint8Array(subscription.getKey("auth") as any))
        )
      )
    };
  }

  // Оформляем новую подписку
  const applicationServerKey = urlBase64ToUint8Array(PUBLIC_VAPID_KEY) as unknown as BufferSource;
  subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey
  });

  return {
    endpoint: subscription.endpoint,
    p256dh: btoa(
      String.fromCharCode.apply(
        null,
        Array.from(new Uint8Array(subscription.getKey("p256dh") as any))
      )
    ),
    auth: btoa(
      String.fromCharCode.apply(
        null,
        Array.from(new Uint8Array(subscription.getKey("auth") as any))
      )
    )
  };
}

/** Отписаться от веб-пуша и удалить из Supabase. */
export async function unsubscribeWebPush(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;

  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await removePushSubscription(endpoint);
  }
}

/** Проверка: оформлена ли веб-подписка сейчас. */
export async function isWebPushSubscribed(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return false;
    const sub = await registration.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

/** Android: Capacitor Push Notifications (требуется @capacitor/push-notifications + FCM). */
export async function registerAndroidPush() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PushNotifications } = require("@capacitor/push-notifications");

  await PushNotifications.requestPermissions();
  const perm = await PushNotifications.checkPermissions();

  if (perm.receive !== "granted") {
    throw new Error("Разрешение на_push не получено");
  }

  // Регистрация в FCM
  await PushNotifications.register();

  return { platform: "android" };
}

/** Инициализация push при старте приложения. */
export async function initPush() {
  const platform = getPlatform();

  if (platform === "web" && PUBLIC_VAPID_KEY) {
    try {
      const already = await isWebPushSubscribed();
      if (!already) {
        // Не подписываем автоматически — пользователь должен нажать кнопку
        return { subscribed: false, platform: "web" };
      }
      // Синхронизируем существующую подписку с Supabase
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const sub = await registration.pushManager.getSubscription();
        if (sub) {
          await savePushSubscription(
            sub.endpoint,
            btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(sub.getKey("p256dh") as any)))),
            btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(sub.getKey("auth") as any)))),
            navigator.userAgent
          );
        }
      }
      return { subscribed: true, platform: "web" };
    } catch (err) {
      console.error("Push init error:", err);
      return { subscribed: false, platform: "web", error: String(err) };
    }
  }

  if (platform === "android") {
    try {
      await registerAndroidPush();
      return { subscribed: true, platform: "android" };
    } catch (err) {
      console.error("Android push init error:", err);
      return { subscribed: false, platform: "android", error: String(err) };
    }
  }

  return { subscribed: false, platform };
}
