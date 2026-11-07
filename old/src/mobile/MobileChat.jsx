import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useChatTurso } from '../hooks/useChatTurso.js'
import { useVoiceRecorder } from '../hooks/useVoiceRecorder.js'
import { MediaMessage } from '../components/MediaMessage.jsx'
import {
  BackIcon, SearchIcon, SendIcon, MicIcon, ImageIcon, ChatIcon, SettingsIcon,
  SunIcon, MoonIcon, SparkIcon, StopIcon
} from '../components/Icons.jsx'

const THEMES = ['light', 'dark', 'midnight', 'sunset']
const THEME_ICONS = { light: SunIcon, dark: MoonIcon, midnight: SparkIcon, sunset: SunIcon }

const s = {
  layout: { display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--bg)', color: 'var(--text)' },
  header: { display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-glass)', backdropFilter: 'blur(14px)', gap: '12px', flexShrink: 0 },
  listBody: { flex: 1, overflowY: 'auto', padding: '8px 8px' }
}

function fmtTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  return sameDay
    ? d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

export default function MobileChat() {
  const navigate = useNavigate()
  const { username: chatParam } = useParams()
  const { user, setUser } = useAuth()
  const chat = useChatTurso()
  const [text, setText] = useState('')
  const [activeTab, setActiveTab] = useState('chat')
  const [theme, setTheme] = useState(localStorage.getItem('wintozo_theme') || 'light')
  const [sendingImage, setSendingImage] = useState(false)
  const [toast, setToast] = useState('')
  const fileInputRef = useRef(null)
  const paramHandled = useRef(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('wintozo_theme', theme)
  }, [theme])

  useEffect(() => {
    if (chatParam && !paramHandled.current && chat.startChat) {
      paramHandled.current = true
      chat.startChat(chatParam)
    }
  }, [chatParam, chat.startChat])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(t)
  }, [toast])

  const voice = useVoiceRecorder((mediaData) => {
    chat.sendMediaMessage({
      type: 'audio',
      url: mediaData.url,
      content: mediaData.url,
      duration: mediaData.duration
    })
  }, chat.activeChat, user)

  const handleSend = () => {
    if (!text.trim()) return
    chat.sendMessage(text)
    setText('')
  }

  const handleImagePick = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSendingImage(true)
    await chat.sendPhoto(file)
    setSendingImage(false)
    e.target.value = ''
  }

  const renderAvatar = (u, size = '48px') => {
    if (u?.avatar_url && !String(u.avatar_url).startsWith('#')) {
      return (
        <div className="chat-avatar" style={{ width: size, height: size }}>
          <img src={u.avatar_url} alt="" />
        </div>
      )
    }
    if (u?.avatar_url && String(u.avatar_url).startsWith('#')) {
      return <div className="chat-avatar" style={{ width: size, height: size, background: u.avatar_url }}>{(u?.nickname || '?')[0]?.toUpperCase()}</div>
    }
    if (u?.avatar) {
      return <div className="chat-avatar" style={{ width: size, height: size, fontSize: '22px' }}>{u.avatar}</div>
    }
    return <div className="chat-avatar" style={{ width: size, height: size }}>{(u?.nickname || '?')[0]?.toUpperCase()}</div>
  }

  const ThemeIcon = THEME_ICONS[theme] || SunIcon

  // ==================== CHAT LIST ====================
  const renderChatList = () => (
    <>
      <div style={s.header}>
        <div style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.8px' }}>
          <span className="logo" style={{ fontSize: '20px' }}>Wintozo</span>
        </div>
        <div style={{ flex: 1 }} />
        <button className="icon-btn" onClick={() => setTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length])} title="Сменить тему">
          <ThemeIcon size={18} />
        </button>
        <button className="icon-btn" onClick={() => navigate('/messenger/phone/chat/search')}>
          <SearchIcon size={18} />
        </button>
      </div>

      <div style={s.listBody}>
        {chat.loading ? (
          <div style={{ padding: '12px' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '10px' }}>
                <div className="skeleton" style={{ width: '48px', height: '48px', borderRadius: '50%' }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="skeleton" style={{ width: '55%', height: '14px' }} />
                  <div className="skeleton" style={{ width: '80%', height: '12px' }} />
                </div>
              </div>
            ))}
          </div>
        ) : chat.chats.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><ChatIcon size={30} /></div>
            <div className="empty-title">Нет чатов</div>
            <div>Найди пользователя и начни общение</div>
            <button className="btn-primary" style={{ maxWidth: '220px', marginTop: '14px' }} onClick={() => navigate('/messenger/phone/chat/search')}>
              <SearchIcon size={17} /> Поиск
            </button>
          </div>
        ) : (
          <div className="chat-list">
            {chat.chats.map((c, i) => (
              <div
                key={c.chatId}
                className={`chat-item ${chat.activeChat === c.chatId ? 'chat-item-active' : ''}`}
                style={{ animationDelay: `${i * 0.04}s` }}
                onClick={() => {
                  chat.openChat(c.chatId, c.partner)
                  setActiveTab('chat')
                }}
              >
                {renderAvatar(c.partner)}
                <div className="chat-info">
                  <div className="chat-name">
                    {c.partner?.nickname || 'Неизвестно'}
                  </div>
                  <div className="chat-last">{c.lastMessage || 'Нет сообщений'}</div>
                </div>
                <div className="chat-meta">
                  <div className="chat-time">{fmtTime(c.lastTime)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )

  // ==================== CHAT VIEW ====================
  const renderChatArea = () => (
    <>
      <div className="chat-header">
        <button className="icon-btn" onClick={chat.closeChat}>
          <BackIcon size={18} />
        </button>
        <div style={{ cursor: 'pointer' }} onClick={() => navigate(`/messenger/phone/chat/user/${chat.activeChatUser?.username}`)}>
          {renderAvatar(chat.activeChatUser, '38px')}
        </div>
        <div className="chat-header-info" onClick={() => navigate(`/messenger/phone/chat/user/${chat.activeChatUser?.username}`)}>
          <div className="chat-title">
            {chat.activeChatUser?.nickname || 'Чат'}
          </div>
          <div className="chat-sub">@{chat.activeChatUser?.username || ''}</div>
        </div>
        <button className="icon-btn" onClick={() => setTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length])}>
          <ThemeIcon size={17} />
        </button>
      </div>

      <div className="chat-messages">
        {chat.messages.map((msg) => {
          const isSelf = msg.sender_username === user?.username
          const mediaUrl = msg.media_url || msg.content

          if (msg.media_type === 'photo' && mediaUrl) {
            return (
              <div key={msg.id} className={`msg-row ${isSelf ? 'msg-self' : 'msg-other'}`}>
                <div className="msg-media" onClick={() => window.open(mediaUrl, '_blank')}>
                  <img src={mediaUrl} alt="photo" />
                </div>
              </div>
            )
          }
          if (msg.media_type === 'audio' && mediaUrl) {
            return (
              <div key={msg.id} className={`msg-row ${isSelf ? 'msg-self' : 'msg-other'}`}>
                <MediaMessage message={{ ...msg, content: mediaUrl, duration: msg.duration }} isSelf={isSelf} />
              </div>
            )
          }
          if (msg.media_type === 'video' && mediaUrl) {
            return (
              <div key={msg.id} className={`msg-row ${isSelf ? 'msg-self' : 'msg-other'}`}>
                <div className="msg-media">
                  <video src={mediaUrl} controls style={{ maxWidth: '260px', display: 'block' }} />
                </div>
              </div>
            )
          }
          return (
            <div key={msg.id} className={`msg-row ${isSelf ? 'msg-self' : 'msg-other'}`}>
              <div className="msg-bubble">
                {msg.content}
                <div className="msg-time">{fmtTime(msg.created_at)}</div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="chat-input-bar">
        <button className="icon-btn" onClick={() => fileInputRef.current?.click()} disabled={sendingImage}>
          <ImageIcon size={19} />
        </button>
        <input
          className="input-msg"
          type="text"
          placeholder="Сообщение..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <button
          className={`record-btn ${voice.isRecording ? 'record-btn-active' : ''}`}
          onPointerDown={(e) => { e.preventDefault(); voice.startRecording() }}
          onPointerUp={() => voice.stopRecording()}
          onPointerLeave={() => voice.isRecording && voice.cancelRecording()}
        >
          {voice.isRecording ? <StopIcon size={18} /> : <MicIcon size={19} />}
        </button>
        <button className="icon-btn-accent" onClick={handleSend} disabled={!text.trim()}>
          <SendIcon size={18} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleImagePick}
        />
      </div>

      {/* Voice Recorder Overlay */}
      {voice.isRecording && (
        <div className="recording-overlay">
          <div className="recording-panel">
            <div className="rec-wave">
              {[0, 1, 2, 3, 4, 5, 6].map(i => (
                <span key={i} style={{ height: `${40 + Math.min(100, voice.audioLevel * 160)}%` }} />
              ))}
            </div>
            <div className="rec-time">
              {Math.floor(voice.recordingTime / 60)}:{String(voice.recordingTime % 60).padStart(2, '0')}
            </div>
            <div className="rec-hint">Отпусти для отправки · Уведи палец для отмены</div>
          </div>
        </div>
      )}

      {(voice.uploading || sendingImage) && (
        <div className="toast" style={{ bottom: '110px' }}>
          {sendingImage ? 'Отправка фото...' : 'Отправка голосового...'}
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  )

  // ==================== MAIN RENDER ====================
  return (
    <div style={s.layout}>
      {chat.activeChat ? renderChatArea() : (
        <>
          {renderChatList()}
          <div className="bottom-nav">
            <div className={`nav-item ${activeTab === 'chat' ? 'nav-item-active' : ''}`} onClick={() => setActiveTab('chat')}>
              <ChatIcon size={21} /> Чаты
            </div>
            <div className={`nav-item ${activeTab === 'settings' ? 'nav-item-active' : ''}`} onClick={() => navigate('/messenger/phone/settings')}>
              <SettingsIcon size={21} /> Ещё
            </div>
          </div>
        </>
      )}
    </div>
  )
}
