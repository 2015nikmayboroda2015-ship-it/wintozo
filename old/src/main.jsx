import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import './index.css'

/**
 * Legacy-мост: старый Wintozo подключён к серверам WinChat.
 * Данные аккаунта WinChat передаются сюда родителем через postMessage
 * (см. src/components/LegacyScreen.tsx). Вход/регистрация в этом
 * интерфейсе отключены — профиль берётся из WinChat.
 */
let bridgeResolve
const bridgeReady = new Promise((resolve) => { bridgeResolve = resolve })

function applyLegacySession(d) {
  if (d.username) localStorage.setItem('wintozo_username', d.username)
  if (d.passwordHash) localStorage.setItem('wintozo_password_hash', d.passwordHash)
  if (d.nickname) localStorage.setItem('wintozo_nickname', d.nickname)
  if (d.avatarUrl) localStorage.setItem('wintozo_avatar', d.avatarUrl)
  // Устройство всегда «phone»: на десктопе legacy-версия не тестировалась,
  // а старый ComputerChat тянет тяжёлые таблицы и подвешивает iframe.
  localStorage.setItem('wintozo_device', 'phone')
}

/**
 * Полный сброс bridge-сессии в localStorage. Вызывается при выходе из
 * legacy-экрана (см. LegacyScreen), чтобы при следующем входе не осталось
 * мусора от старого аккаунта, который может «вешать» загрузку вкладок.
 */
window.wintozoLegacyReset = () => {
  try {
    for (const key of [
      'wintozo_username',
      'wintozo_password_hash',
      'wintozo_nickname',
      'wintozo_avatar',
      'wintozo_device'
    ]) {
      localStorage.removeItem(key)
    }
  } catch { /* no-op */ }
}

// Если родительский документ уже прислал данные — используем их сразу.
window.addEventListener('message', (event) => {
  const d = event?.data
  if (!d || typeof d !== 'object') return
  if (d.type === 'wintozo-legacy-session') {
    applyLegacySession(d)
    bridgeResolve?.(true)
  } else if (d.type === 'wintozo-legacy-reset') {
    window.wintozoLegacyReset()
  }
})

// Сообщаем родителю, что legacy-документ готов принять сессию.
if (window.parent && window.parent !== window) {
  window.parent.postMessage({ type: 'wintozo-legacy-ready' }, '*')
  // Если мост уже прошёл раньше (localStorage) — рендерим сразу, не ждём:
  // иначе пользователь висит на splash до таймаута bridge.
  if (localStorage.getItem('wintozo_username')) {
    bridgeResolve?.(true)
  } else {
    // Ждём данные не дольше 2.5с, иначе рендерим обычный экран входа.
    setTimeout(() => bridgeResolve?.(false), 2500)
  }
} else {
  // Не в iframe: если сохранённая сессия уже есть, разблокируем мгновенно,
  // иначе ждём реальный вход через форму (см. AuthContext).
  if (localStorage.getItem('wintozo_username')) {
    bridgeResolve?.(true)
  } else {
    setTimeout(() => bridgeResolve?.(false), 300)
  }
}

function ErrorFallback() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: 'Inter',
      backgroundColor: '#1a1a2e',
      color: '#fff',
      flexDirection: 'column',
      gap: '16px',
      padding: '20px'
    }}>
      <div style={{ fontSize: '24px', fontWeight: 'bold' }}>Wintozo</div>
      <div style={{ fontSize: '14px', textAlign: 'center', opacity: 0.8 }}>
        Ошибка загрузки. Проверьте подключение к интернету.
      </div>
      <button
        onClick={() => window.location.reload()}
        style={{
          padding: '10px 24px',
          fontSize: '14px',
          backgroundColor: '#6c63ff',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer'
        }}
      >
        Перезагрузить
      </button>
    </div>
  )
}

try {
  bridgeReady.then(() => {
    ReactDOM.createRoot(document.getElementById('root')).render(
      <React.StrictMode>
        <HashRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </HashRouter>
      </React.StrictMode>
    )
  })
} catch (error) {
  console.error('App render error:', error)
  document.getElementById('root').innerHTML = ''
  const fallback = document.createElement('div')
  fallback.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:Arial,sans-serif;background-color:#1a1a2e;color:#fff;flex-direction:column;gap:16px;padding:20px;"><div style="font-size:24px;font-weight:bold;">Wintozo</div><div style="font-size:14px;text-align:center;opacity:0.8;">Ошибка загрузки. Проверьте подключение к интернету.</div><button onclick="location.reload()" style="padding:10px 24px;font-size:14px;background-color:#6c63ff;color:#fff;border:none;border-radius:8px;cursor:pointer;">Перезагрузить</button></div>'
  document.getElementById('root').appendChild(fallback)
}
