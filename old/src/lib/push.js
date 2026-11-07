/**
 * Пуш-уведомления для старого Wintozo (legacy).
 * Тот же Push API, что и в новом WinChat — подписка хранится в
 * public.push_subscriptions на сервере core Supabase.
 */

import { supabase } from './supabase.js'

const PUBLIC_VAPID_KEY = (() => {
  try {
    const env = typeof import.meta !== 'undefined' && import.meta.env
    if (env && env.VITE_PUBLIC_VAPID_KEY) return env.VITE_PUBLIC_VAPID_KEY
  } catch { /* no-op */ }
  return null
})()

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

export function getPlatform() {
  const ua = navigator.userAgent
  if (/android/i.test(ua)) return 'android'
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  return 'web'
}

export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    !!PUBLIC_VAPID_KEY
  )
}

export async function isSubscribed() {
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    if (!registration) return false
    const sub = await registration.pushManager.getSubscription()
    return !!sub
  } catch {
    return false
  }
}

export async function subscribe() {
  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    const applicationServerKey = urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey
    })
  }
  return {
    endpoint: subscription.endpoint,
    p256dh: btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(subscription.getKey('p256dh'))))),
    auth: btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(subscription.getKey('auth')))))
  }
}

export async function saveSub(endpoint, p256dh, auth) {
  const { error } = await supabase.rpc('save_push_subscription', {
    _endpoint: endpoint,
    _p256dh: p256dh,
    _auth: auth,
    _user_agent: getPlatform()
  })
  if (error) throw error
}

export async function removeSub(endpoint) {
  const { error } = await supabase.rpc('remove_push_subscription', { _endpoint: endpoint })
  if (error) throw error
}

export async function unsubscribe() {
  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration) return
  const subscription = await registration.pushManager.getSubscription()
  if (subscription) {
    await subscription.unsubscribe()
    await removeSub(subscription.endpoint)
  }
}
