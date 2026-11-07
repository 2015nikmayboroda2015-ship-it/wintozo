import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'
import { useChatTurso } from '../hooks/useChatTurso.js'
import { BackIcon, SearchIcon } from '../components/Icons.jsx'

export default function ComputerSearch() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const chat = useChatTurso()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    const search = async () => {
      if (!query.trim()) { setResults([]); return }
      setSearching(true)
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, username, nickname, avatar_url, bio')
          .ilike('username', `${query.trim()}%`)
          .limit(20)
        setResults((data || []).filter(u => u.username !== user?.username))
      } catch (err) {
        console.error('Search error:', err)
      } finally {
        setSearching(false)
      }
    }
    const t = setTimeout(search, 350)
    return () => clearTimeout(t)
  }, [query, user])

  const renderAvatar = (u) => {
    const avatarStyle = { width: '46px', height: '46px', borderRadius: '50%', background: 'var(--gradient)', color: 'var(--accent-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '18px', flexShrink: 0, overflow: 'hidden' }
    if (u?.avatar_url && !String(u.avatar_url).startsWith('#')) {
      return <div style={avatarStyle}><img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
    }
    if (u?.avatar_url && String(u.avatar_url).startsWith('#')) {
      return <div style={{ ...avatarStyle, background: u.avatar_url }}>{(u?.nickname || '?')[0]?.toUpperCase()}</div>
    }
    if (u?.avatar) {
      return <div style={avatarStyle}>{u.avatar}</div>
    }
    return <div style={avatarStyle}>{(u?.nickname || '?')[0]?.toUpperCase()}</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--bg)', color: 'var(--text)', maxWidth: '720px', margin: '0 auto', width: '100%', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', gap: '12px' }}>
        <button className="icon-btn" onClick={() => navigate('/messenger/computer/chat')}>
          <BackIcon size={18} />
        </button>
        <div style={{ fontWeight: 700, fontSize: '17px', flex: 1 }}>Поиск</div>
      </div>

      <div style={{ padding: '12px 16px 0' }}>
        <div className="input-wrapper">
          <div className="input-icon"><SearchIcon size={17} /></div>
          <input
            className="input-field"
            type="text"
            placeholder="Поиск по юзернейму..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
        {searching && query.trim() && <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>Поиск...</div>}
        {!searching && query.trim() && results.length === 0 && (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
            Никого не нашли по запросу «{query}»
          </div>
        )}
        {results.map((u, i) => (
          <div key={u.username} style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', gap: '13px', borderRadius: '14px', cursor: 'pointer', transition: 'background 0.2s ease', animation: `slideUp 0.35s ease ${i * 0.04}s backwards` }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            {renderAvatar(u)}
            <div style={{ flex: 1, minWidth: 0 }} onClick={() => {
              chat.startChat(u.username)
              navigate('/messenger/computer/chat')
            }}>
              <div style={{ fontWeight: 600, fontSize: '15px' }}>{u.nickname || u.username}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>@{u.username}</div>
              {u.bio && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{u.bio}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
