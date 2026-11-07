import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'
import { BackIcon, TerminalIcon } from '../components/Icons.jsx'

/**
 * Админ-терминал старого Wintozo.
 * Команды и RPC — те же, что в новом WinChat (src/components/AdminTerminal.tsx).
 * Доступен только аккаунту admin.
 */

const s = {
  layout: {
    display: 'flex', flexDirection: 'column', height: '100dvh',
    background: '#0d1117', color: '#e6edf3', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  },
  header: {
    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
    background: '#161b22', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0
  },
  backBtn: {
    width: '36px', height: '36px', borderRadius: '10px', display: 'flex',
    alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    color: '#e6edf3', background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0
  },
  title: { fontWeight: 700, fontSize: '15px', flex: 1, display: 'flex', alignItems: 'center', gap: '8px' },
  badge: {
    fontSize: '10px', fontWeight: 700, color: '#3fb950',
    background: 'rgba(63,185,80,0.15)', borderRadius: '999px', padding: '3px 8px'
  },
  log: { flex: 1, overflowY: 'auto', padding: '14px 16px', fontSize: '13px', lineHeight: 1.65 },
  line: { marginBottom: '2px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  inputBar: {
    display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px',
    background: '#0d1117', borderTop: '1px solid rgba(255,255,255,0.1)', flexShrink: 0
  },
  prompt: { color: '#3fb950', fontWeight: 700, fontSize: '14px' },
  input: {
    flex: 1, background: 'transparent', border: 'none', outline: 'none',
    color: '#e6edf3', fontFamily: 'inherit', fontSize: '14px'
  },
  send: {
    background: 'rgba(255,255,255,0.1)', color: '#e6edf3', border: 'none',
    borderRadius: '8px', padding: '7px 12px', fontFamily: 'inherit',
    fontSize: '12px', fontWeight: 700, cursor: 'pointer'
  },
  denied: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    height: '100dvh', gap: '12px', padding: '24px', textAlign: 'center',
    background: 'var(--bg)', color: 'var(--text)'
  }
}

const COLORS = { input: '#e6edf3', success: '#3fb950', error: '#f85149', info: '#79c0ff' }

function entryStyle(type) {
  return { ...s.line, color: COLORS[type] || COLORS.info }
}

export default function AdminTerminalPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [history, setHistory] = useState([
    { type: 'info', text: 'Wintozo Admin Terminal' },
    { type: 'info', text: 'Введите /help для списка команд' }
  ])
  const [input, setInput] = useState('')
  const endRef = useRef(null)
  const inputRef = useRef(null)

  const isAdmin = String(user?.username || '').toLowerCase() === 'admin'

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  useEffect(() => {
    if (isAdmin) inputRef.current?.focus()
  }, [isAdmin])

  const push = (type, text) => setHistory((prev) => [...prev, { type, text }])

  async function runCommand(raw) {
    const trimmed = raw.trim()
    if (!trimmed) return

    push('input', trimmed)
    setInput('')

    if (!trimmed.startsWith('/')) {
      push('error', 'Команды начинаются с / . Введите /help для справки')
      return
    }

    const parts = trimmed.toLowerCase().split(/\s+/)
    const cmd = parts[0]

    try {
      switch (cmd) {
        case '/help': {
          push('info', '=== Команды админ-терминала ===')
          push('info', '/addverify <username> grey  - Серая галочка (1 этап)')
          push('info', '/addverify <username> green - Зелёная галочка (2 этап)')
          push('info', '/addverify <username> true  - Синяя галочка (полная верификация)')
          push('info', '/disverify <username>       - Снять галочку')
          push('info', '/ban <username> <причина>   - Заблокировать')
          push('info', '/unban <username>           - Разблокировать')
          push('info', '/status <username>          - Статус пользователя')
          push('info', '/get winpass @username      - WinPass аккаунта (восстановление)')
          push('info', '/give wintozopro @username X - Выдать WintozoPro на X дней')
          push('info', '/delete wintozopro @username - Удалить WintozoPro')
          push('info', '/set version <X.Y.Z>        - Установить версию приложения')
          push('info', '/get version                - Текущая версия приложения')
          push('info', '/clear                      - Очистить терминал')
          push('info', '/help                       - Эта справка')
          break
        }

        case '/clear': {
          setHistory([{ type: 'info', text: 'Wintozo Admin Terminal' }])
          break
        }

        case '/addverify': {
          const username = parts[1]?.replace('@', '')
          const level = parts[2]
          if (!username || !level) {
            push('error', 'Использование: /addverify <username> <grey|green|true>')
            return
          }
          const mappedLevel = level === 'true' ? 'full' : level
          if (!['grey', 'green', 'full'].includes(mappedLevel)) {
            push('error', 'Неверный уровень. Доступные: grey, green, true')
            return
          }
          const { data, error } = await supabase.rpc('add_verify_status', {
            _admin_id: user.id,
            _target_username: username,
            _level: mappedLevel
          })
          if (error) { push('error', 'Ошибка: ' + error.message); return }
          const res = data || {}
          push(res.ok ? 'success' : 'error', (res.ok ? '[OK] ' : '[ERR] ') + (res.message || res.error))
          break
        }

        case '/disverify': {
          const username = parts[1]?.replace('@', '')
          if (!username) { push('error', 'Использование: /disverify <username>'); return }
          const { data, error } = await supabase.rpc('disverify_status', {
            _admin_id: user.id,
            _target_username: username
          })
          if (error) { push('error', 'Ошибка: ' + error.message); return }
          const res = data || {}
          push(res.ok ? 'success' : 'error', (res.ok ? '[OK] ' : '[ERR] ') + (res.message || res.error))
          break
        }

        case '/ban': {
          const username = parts[1]?.replace('@', '')
          const reason = parts.slice(2).join(' ') || 'Без указания причины'
          if (!username) { push('error', 'Использование: /ban <username> [причина]'); return }
          const { data, error } = await supabase.rpc('ban_user_by_username', {
            _admin_id: user.id,
            _target_username: username,
            _reason: reason
          })
          if (error) { push('error', 'Ошибка: ' + error.message); return }
          const res = data || {}
          push(res.ok ? 'success' : 'error', (res.ok ? '[OK] ' : '[ERR] ') + (res.message || res.error))
          break
        }

        case '/unban': {
          const username = parts[1]?.replace('@', '')
          if (!username) { push('error', 'Использование: /unban <username>'); return }
          const { data, error } = await supabase.rpc('unban_user_by_username', {
            _admin_id: user.id,
            _target_username: username
          })
          if (error) { push('error', 'Ошибка: ' + error.message); return }
          const res = data || {}
          push(res.ok ? 'success' : 'error', (res.ok ? '[OK] ' : '[ERR] ') + (res.message || res.error))
          break
        }

        case '/status': {
          const username = parts[1]?.replace('@', '')
          if (!username) { push('error', 'Использование: /status <username>'); return }
          const { data, error } = await supabase.rpc('get_verify_status', {
            _admin_id: user.id,
            _target_username: username
          })
          if (error) { push('error', 'Ошибка: ' + error.message); return }
          const res = data || {}
          if (res.ok) {
            const badge = res.verify_status === 'full' ? 'Синяя'
              : res.verify_status === 'green' ? 'Зелёная'
              : res.verify_status === 'grey' ? 'Серая' : 'Нет'
            push('info', 'Пользователь: ' + res.nickname + ' (@' + res.username + ')')
            push('info', 'Галочка: ' + badge)
            push('info', 'Заблокирован: ' + (res.banned ? 'да' : 'нет'))
          } else {
            push('error', '[ERR] ' + res.error)
          }
          break
        }

        case '/set': {
          const what = parts[1]
          if (what !== 'version') { push('error', 'Использование: /set version <X.Y.Z>'); return }
          const rawVersion = trimmed.split(/\s+/).slice(2).join('').trim()
          if (!rawVersion || !/^\d+\.\d+(\.\d+)?$/.test(rawVersion)) {
            push('error', 'Неверный формат версии. Пример: /set version 3.0.1')
            return
          }
          const { data, error } = await supabase.rpc('set_wintozo_version', {
            _admin_id: user.id,
            _version: rawVersion
          })
          if (error) { push('error', 'Ошибка: ' + error.message); return }
          const res = data || {}
          push(res.ok ? 'success' : 'error', (res.ok ? '[OK] ' : '[ERR] ') + (res.message || res.error))
          break
        }

        case '/get': {
          const what = parts[1]

          if (what === 'winpass') {
            const username = parts[2]?.replace('@', '')
            if (!username) { push('error', 'Использование: /get winpass @username'); return }
            const { data, error } = await supabase.rpc('admin_get_winpass', {
              _admin_id: user.id,
              _target_username: username
            })
            if (error) { push('error', 'Ошибка: ' + error.message); return }
            const res = data || {}
            if (!res.ok) { push('error', '[ERR] ' + res.error); return }
            if (!res.winpass) {
              push('info', 'У @' + res.username + ' WinPass ещё нет — выдаю новый...')
              const { data: newCode, error: genErr } = await supabase.rpc('generate_winpass')
              if (genErr || !newCode) {
                push('error', 'Не удалось сгенерировать WinPass: ' + (genErr?.message || 'пустой ответ'))
                return
              }
              const { error: setErr } = await supabase
                .from('profiles')
                .update({ winpass: newCode })
                .eq('username', username)
              if (setErr) { push('error', 'Не удалось выдать WinPass: ' + setErr.message); return }
              push('success', '[OK] WinPass выдан: ' + newCode)
              return
            }
            push('info', res.nickname + ' (@' + res.username + ')')
            push('success', 'WinPass: ' + res.winpass)
            return
          }

          if (what === 'version') {
            const { data, error } = await supabase.rpc('get_wintozo_version')
            if (error) { push('error', 'Ошибка: ' + error.message); return }
            push('success', '[OK] Текущая версия приложения: ' + data)
            return
          }

          push('error', 'Использование: /get winpass @username | /get version')
          break
        }

        case '/give': {
          const feature = parts[1]
          if (feature !== 'wintozopro') {
            push('error', 'Использование: /give wintozopro @username X')
            return
          }
          const username = parts[2]?.replace('@', '')
          const days = parseInt(parts[3] || '0', 10)
          if (!username || !days || days < 1) {
            push('error', 'Использование: /give wintozopro @username X (X — число дней)')
            return
          }
          const { data, error } = await supabase.rpc('give_winpro', {
            _admin_id: user.id,
            _target_username: username,
            _days: days
          })
          if (error) { push('error', 'Ошибка: ' + error.message); return }
          const res = data || {}
          push(res.ok ? 'success' : 'error', (res.ok ? '[OK] ' : '[ERR] ') + (res.message || res.error))
          break
        }

        case '/delete': {
          const feature = parts[1]
          if (feature !== 'wintozopro') {
            push('error', 'Использование: /delete wintozopro @username')
            return
          }
          const username = parts[2]?.replace('@', '')
          if (!username) { push('error', 'Использование: /delete wintozopro @username'); return }
          const { data, error } = await supabase.rpc('delete_winpro', {
            _admin_id: user.id,
            _target_username: username
          })
          if (error) { push('error', 'Ошибка: ' + error.message); return }
          const res = data || {}
          push(res.ok ? 'success' : 'error', (res.ok ? '[OK] ' : '[ERR] ') + (res.message || res.error))
          break
        }

        default:
          push('error', 'Неизвестная команда: ' + cmd + '. Введите /help для списка')
      }
    } catch (err) {
      push('error', 'Непредвиденная ошибка: ' + (err?.message || String(err)))
    }
  }

  if (!isAdmin) {
    return (
      <div style={s.denied}>
        <TerminalIcon size={40} />
        <div style={{ fontSize: '18px', fontWeight: 800 }}>Доступ запрещён</div>
        <div style={{ fontSize: '13px', opacity: 0.7 }}>Админ-терминал доступен только аккаунту admin.</div>
        <button className="btn-secondary" style={{ maxWidth: '220px' }} onClick={() => navigate(-1)}>
          Назад
        </button>
      </div>
    )
  }

  return (
    <div style={s.layout}>
      <div style={s.header}>
        <div style={s.backBtn} onClick={() => navigate(-1)}><BackIcon size={18} /></div>
        <div style={s.title}>
          <TerminalIcon size={18} /> Админ-терминал
        </div>
        <span style={s.badge}>@{user.username}</span>
      </div>

      <div style={s.log}>
        {history.map((entry, i) => (
          <div key={i} style={entryStyle(entry.type)}>
            {entry.type === 'input' ? (
              <span>
                <span style={{ color: '#3fb950' }}>$ </span>
                {entry.text}
              </span>
            ) : entry.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form
        style={s.inputBar}
        onSubmit={(e) => {
          e.preventDefault()
          runCommand(input)
        }}
      >
        <span style={s.prompt}>$</span>
        <input
          ref={inputRef}
          style={s.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Введите команду..."
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" style={s.send}>Enter</button>
      </form>
    </div>
  )
}
