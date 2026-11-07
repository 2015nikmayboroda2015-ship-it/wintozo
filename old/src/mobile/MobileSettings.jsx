import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'
import { toast } from '../lib/toast.js'
import AvatarPicker from '../components/AvatarPicker.jsx'
import {
  BackIcon, PaletteIcon, PhoneIcon, ComputerIcon,
  LogoutIcon, CrownIcon, EditIcon, ChevronRightIcon, TerminalIcon
} from '../components/Icons.jsx'

const s = {
  layout: { display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--bg)', color: 'var(--text)' },
  header: { display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', gap: '12px', flexShrink: 0 },
  backBtn: { width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text)', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', flexShrink: 0 },
  title: { fontWeight: 700, fontSize: '17px', flex: 1 },
  profileCard: { display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 16px' }
}

const THEMES = [
  { id: 'light', name: 'Светлая', colors: ['#f8fafc', '#3b82f6'] },
  { id: 'dark', name: 'Тёмная', colors: ['#0f172a', '#8b5cf6'] },
  { id: 'midnight', name: 'Полночь', colors: ['#050816', '#06b6d4'] },
  { id: 'sunset', name: 'Закат', colors: ['#1a0f1e', '#f97316'] }
]

export default function MobileSettings() {
  const navigate = useNavigate()
  const { user, setUser, signOut } = useAuth()
  const [showAvatar, setShowAvatar] = useState(false)
  const [showTheme, setShowTheme] = useState(false)
  const [showDesc, setShowDesc] = useState(false)
  const [desc, setDesc] = useState(user?.description || '')
  const theme = localStorage.getItem('wintozo_theme') || 'light'

  const setTheme = (t) => {
    localStorage.setItem('wintozo_theme', t)
    document.documentElement.setAttribute('data-theme', t)
    setShowTheme(false)
  }

  const saveDescription = async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ bio: desc.trim() || null })
        .eq('id', user?.id)
      if (error) throw error
      setUser({ ...user, description: desc.trim(), bio: desc.trim() || null })
      setShowDesc(false)
    } catch (err) {
      toast('Не удалось сохранить описание', 'error')
    }
  }

  const switchDevice = (device) => {
    localStorage.setItem('wintozo_device', device)
    navigate(`/messenger/${device}/chat`, { replace: true })
  }

  const renderAvatar = (u, size = '64px') => {
    if (u?.avatar_url && !String(u.avatar_url).startsWith('#')) {
      return <div className="chat-avatar" style={{ width: size, height: size }}><img src={u.avatar_url} alt="" /></div>
    }
    if (u?.avatar_url && String(u.avatar_url).startsWith('#')) {
      return <div className="chat-avatar" style={{ width: size, height: size, background: u.avatar_url, fontSize: '26px' }}>{(u?.nickname || '?')[0]?.toUpperCase()}</div>
    }
    if (u?.avatar) {
      return <div className="chat-avatar" style={{ width: size, height: size, fontSize: '30px' }}>{u.avatar}</div>
    }
    return <div className="chat-avatar" style={{ width: size, height: size, fontSize: '26px' }}>{(u?.nickname || '?')[0]?.toUpperCase()}</div>
  }

  return (
    <div style={s.layout}>
      <div style={s.header}>
        <div style={s.backBtn} onClick={() => navigate('/messenger/phone/chat')}>
          <BackIcon size={18} />
        </div>
        <div style={s.title}>Настройки</div>
      </div>

      <div className="settings-body">
        {/* Профиль */}
        <div className="settings-card" style={{ animationDelay: '0s' }}>
          <div style={s.profileCard} onClick={() => setShowAvatar(true)}>
            {renderAvatar(user)}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 750, fontSize: '16.5px' }}>{user?.nickname}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>@{user?.username}</div>
              <div style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '3px' }}>Изменить аватарку</div>
            </div>
            <ChevronRightIcon size={18} />
          </div>
        </div>

        {/* Описание */}
        <div className="settings-card" style={{ animationDelay: '0.03s' }}>
          <div className="settings-row" onClick={() => { setDesc(user?.description || ''); setShowDesc(true) }}>
            <EditIcon size={19} style={{ color: 'var(--text-secondary)' }} />
            <div className="settings-label">
              Описание профиля
              <div className="settings-sub">{user?.description || 'Не задано'}</div>
            </div>
            <ChevronRightIcon size={17} />
          </div>
        </div>

        {/* Тема */}
        <div className="settings-card" style={{ animationDelay: '0.06s' }}>
          <div className="settings-row" onClick={() => setShowTheme(!showTheme)}>
            <PaletteIcon size={19} style={{ color: 'var(--text-secondary)' }} />
            <div className="settings-label">
              Тема оформления
              <div className="settings-sub">{THEMES.find(t => t.id === theme)?.name}</div>
            </div>
            <ChevronRightIcon size={17} />
          </div>
          {showTheme && (
            <div className="theme-menu" style={{ animation: 'fadeIn 0.25s ease' }}>
              {THEMES.map(t => (
                <div
                  key={t.id}
                  className={`theme-option ${theme === t.id ? 'theme-option-active' : ''}`}
                  onClick={() => setTheme(t.id)}
                >
                  <div className="theme-dot" style={{ background: `linear-gradient(135deg, ${t.colors[0]}, ${t.colors[1]})` }} />
                  {t.name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Устройство */}
        <div className="settings-card" style={{ animationDelay: '0.09s' }}>
          <div className="settings-row" onClick={() => switchDevice('phone')}>
            <PhoneIcon size={19} style={{ color: 'var(--text-secondary)' }} />
            <div className="settings-label">Режим телефона</div>
            <ChevronRightIcon size={17} />
          </div>
          <div className="settings-row" onClick={() => switchDevice('computer')}>
            <ComputerIcon size={19} style={{ color: 'var(--text-secondary)' }} />
            <div className="settings-label">Режим компьютера</div>
            <ChevronRightIcon size={17} />
          </div>
        </div>

        {/* WintozoPro — есть в новой версии WinChat */}
        <div className="settings-card" style={{ animationDelay: '0.12s' }}>
          <div className="settings-row" onClick={() => navigate('/messenger/status/pro')}>
            <CrownIcon size={19} style={{ color: 'var(--warning)' }} />
            <div className="settings-label">
              WintozoPro
              <div className="settings-sub">Статус подписки</div>
            </div>
            <ChevronRightIcon size={17} />
          </div>
        </div>

        {/* Админ-терминал — только для аккаунта admin */}
        {String(user?.username || '').toLowerCase() === 'admin' && (
          <div className="settings-card" style={{ animationDelay: '0.13s' }}>
            <div className="settings-row" onClick={() => navigate('/messenger/admin/terminal')}>
              <TerminalIcon size={19} style={{ color: 'var(--text-secondary)' }} />
              <div className="settings-label">
                Админ-терминал
                <div className="settings-sub">Команды управления</div>
              </div>
              <ChevronRightIcon size={17} />
            </div>
          </div>
        )}

        <div className="section-title">Аккаунт</div>
        <div className="settings-card" style={{ animationDelay: '0.15s' }}>
          <div className="settings-row" onClick={() => { signOut(); navigate('/messenger/login', { replace: true }) }}>
            <LogoutIcon size={19} style={{ color: 'var(--error)' }} />
            <div className="settings-label" style={{ color: 'var(--error)' }}>Выйти из аккаунта</div>
          </div>
        </div>

        <div style={{ textAlign: 'center', fontSize: '11.5px', color: 'var(--text-secondary)', opacity: 0.7, padding: '8px 0 20px' }}>
          Wintozo · версия 2.0
        </div>
      </div>

      {showAvatar && (
        <AvatarPicker
          currentAvatar={user?.avatar_url ? { type: 'url', value: user.avatar_url } : null}
          onSelect={(sel) => setUser({ ...user, avatar_url: sel?.type === 'url' ? sel.value : null })}
          onClose={() => setShowAvatar(false)}
        />
      )}

      {showDesc && (
        <div className="modal-overlay" onClick={() => setShowDesc(false)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: '17px', marginBottom: '14px' }}>Описание профиля</div>
            <textarea
              className="input-field"
              style={{ minHeight: '100px', resize: 'vertical', padding: '12px 14px' }}
              placeholder="Расскажи о себе..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              maxLength={200}
            />
            <button className="btn-primary" style={{ marginTop: '14px', animation: 'none' }} onClick={saveDescription}>
              Сохранить
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
