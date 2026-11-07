/**
 * Всплывающие уведомления вместо alert().
 * Legacy-интерфейс открыт в iframe с sandbox без allow-modals,
 * поэтому alert() игнорируется браузером. Toast рисуется прямо в DOM.
 */

let host = null

function ensureHost() {
  if (host && document.body.contains(host)) return host
  host = document.createElement('div')
  host.setAttribute('data-wintozo-toast', '')
  Object.assign(host.style, {
    position: 'fixed',
    left: '50%',
    bottom: '84px',
    transform: 'translateX(-50%)',
    zIndex: '99999',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    alignItems: 'center',
    pointerEvents: 'none',
    maxWidth: '90vw'
  })
  document.body.appendChild(host)
  return host
}

/**
 * @param {string} message
 * @param {'info'|'success'|'error'} [type]
 */
export function toast(message, type = 'info') {
  if (!message) return
  const h = ensureHost()
  const el = document.createElement('div')
  const color = type === 'error' ? 'var(--error, #f87171)'
    : type === 'success' ? 'var(--success, #4ade80)'
    : 'var(--text, #fff)'
  Object.assign(el.style, {
    background: 'var(--bg-secondary, #1e293b)',
    color,
    border: '1px solid var(--border, rgba(255,255,255,0.15))',
    borderRadius: '12px',
    padding: '10px 16px',
    fontSize: '13px',
    fontWeight: '600',
    lineHeight: '1.4',
    boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
    maxWidth: '90vw',
    textAlign: 'center',
    transition: 'opacity 0.2s ease, transform 0.2s ease'
  })
  el.textContent = message
  h.appendChild(el)

  setTimeout(() => {
    el.style.opacity = '0'
    el.style.transform = 'translateY(6px)'
    setTimeout(() => el.remove(), 220)
  }, 2800)
}
