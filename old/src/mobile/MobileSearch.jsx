import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'
import { useChatTurso } from '../hooks/useChatTurso.js'
import { BackIcon, SearchIcon } from '../components/Icons.jsx'

const s = {
  layout: { display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--bg)', color: 'var(--text)' },
  header: { display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', gap: '12px', flexShrink: 0 },
  backBtn: { width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text)', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', flexShrink: 0 },
  title: { fontWeight: 700, fontSize: '17px', flex: 1 },
  body: { flex: 1, overflowY: 'auto', padding: '10px 8px' },
  userItem: { display: 'flex', alignItems: 'center', padding: '12px 14px', gap: '13px', cursor: 'pointer', borderRadius: '14px', transition: 'background 0.2s ease' },
  avatar: { width: '46px', height: '46px', borderRadius: '50%', background: 'var(--gradient)', color: 'var(--accent-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '18px', flexShrink: 0, overflow: 'hidden' }
}

export default function MobileSearch() {
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
    if (u?.avatar_url && !String(u.avatar_url).startsWith('#')) {
      return <div style={s.avatar}><img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
    }
    if (u?.avatar_url && String(u.avatar_url).startsWith('#')) {
      return <div style={{ ...s.avatar, background: u.avatar_url }}>{(u?.nickname || '?')[0]?.toUpperCase()}</div>
    }
    if (u?.avatar) {
      return <div style={s.avatar}>{u.avatar}</div>
    }
    return <div style={s.avatar}>{(u?.nickname || '?')[0]?.toUpperCase()}</div>
  }

  return (
    <div style={s.layout}>
      <div style={s.header}>
        <div style={s.backBtn} onClick={() => navigate('/messenger/phone/chat')}>
          <BackIcon size={18} />
        </div>
        <div style={s.title}>Поиск</div>
      </div>

      <div style={{ padding: '10px 14px 0' }}>
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

      <div style={s.body}>
        {searching && query.trim() && <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>Поиск...</div>}
        {!searching && query.trim() && results.length === 0 && (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
            Никого не нашли по запросу «{query}»
          </div>
        )}
        {results.map((u, i) => (
          <div key={u.username} style={{ ...s.userItem, animation: `slideUp 0.35s ease ${i * 0.04}s backwards` }}>
            {renderAvatar(u)}
            <div style={{ flex: 1, minWidth: 0 }} onClick={() => {
              chat.startChat(u.username)
              navigate('/messenger/phone/chat')
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
