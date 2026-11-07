import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'
import { BackIcon, CrownIcon, ZapIcon, ShieldIcon, CheckIcon, RocketIcon } from '../components/Icons.jsx'

const s = {
  layout: { display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--bg)', color: 'var(--text)', animation: 'fadeIn 0.35s ease' },
  header: { display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', gap: '12px', flexShrink: 0 },
  backBtn: { width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text)', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', flexShrink: 0 },
  title: { fontWeight: 700, fontSize: '17px', flex: 1 },
  body: { flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' },
  proCard: {
    borderRadius: '22px', padding: '26px 22px', color: '#fff', position: 'relative', overflow: 'hidden',
    background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 10px 30px rgba(245,158,11,0.35)',
    animation: 'slideUp 0.4s cubic-bezier(0.4,0,0.2,1) backwards'
  },
  proCardInactive: { background: 'linear-gradient(135deg, #475569, #334155)', boxShadow: '0 10px 30px rgba(51,65,85,0.3)' },
  proCrown: { width: '70px', height: '70px', borderRadius: '22px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', boxShadow: 'inset 0 0 20px rgba(255,255,255,0.15)' },
  proTitle: { fontSize: '24px', fontWeight: 800, textAlign: 'center', marginBottom: '6px' },
  proSub: { fontSize: '13px', opacity: 0.92, textAlign: 'center', lineHeight: 1.5, marginBottom: '16px' },
  proBadge: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 16px', background: 'rgba(255,255,255,0.2)', borderRadius: '20px', fontSize: '13px', fontWeight: 700, width: 'fit-content', margin: '0 auto' },
  section: { fontSize: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' },
  card: { background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border)', padding: '16px', animation: 'slideUp 0.4s cubic-bezier(0.4,0,0.2,1) backwards' },
  row: { display: 'flex', alignItems: 'center', gap: '14px', padding: '13px', borderRadius: '13px', background: 'var(--bg-tertiary)', marginBottom: '8px', border: '1px solid var(--border)' },
  loader: { width: '30px', height: '30px', border: '3px solid var(--border)', borderTop: '3px solid #f59e0b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }
}

const FEATURES = [
  { icon: <CrownIcon size={20} />, title: 'Корона WintozoPro', desc: 'Золотая корона рядом с аватаркой', color: '#f59e0b' },
  { icon: <ShieldIcon size={20} />, title: 'Серая галочка', desc: 'Базовая верификация в профиле', color: '#22c55e' },
  { icon: <ZapIcon size={20} />, title: 'Премиум-темы', desc: 'Доступ к WintozoPro-палитрам WinChat', color: '#8b5cf6' },
  { icon: <CheckIcon size={20} />, title: 'Анимации фона', desc: 'Эксклюзивные фоновые эффекты', color: '#3b82f6' }
]

export default function ProStatusPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [proStatus, setProStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('winpro_until, username')
          .eq('id', user?.id)
          .maybeSingle()
        if (!alive) return
        if (prof?.winpro_until && new Date(prof.winpro_until) > new Date()) {
          setProStatus({ active: true, end_date: prof.winpro_until })
        } else {
          setProStatus({ active: false })
        }
      } catch (err) {
        console.error('Pro status load error:', err)
      } finally {
        if (alive) setLoading(false)
      }
    }
    if (user?.id) load()
    else setLoading(false)
    return () => { alive = false }
  }, [user?.id])

  const isActive = proStatus?.active

  const formatEndDate = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const diff = Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24))
    if (diff <= 0) return 'Истёк'
    return `Осталось ${diff} дн. · ${d.toLocaleDateString('ru-RU')}`
  }

  if (loading) {
    return (
      <div style={s.layout}>
        <div style={s.header}>
          <div style={s.backBtn} onClick={() => navigate(-1)}><BackIcon size={18} /></div>
          <div style={s.title}>WintozoPro</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div style={s.loader} /></div>
      </div>
    )
  }

  return (
    <div style={s.layout}>
      <div style={s.header}>
        <div style={s.backBtn} onClick={() => navigate(-1)}><BackIcon size={18} /></div>
        <div style={s.title}>WintozoPro</div>
      </div>

      <div style={s.body}>
        <div style={{ ...s.proCard, ...(isActive ? {} : s.proCardInactive) }}>
          <div style={s.proCrown}><CrownIcon size={34} /></div>
          <div style={s.proTitle}>WintozoPro</div>
          <div style={s.proSub}>
            {isActive
              ? 'Подписка активна — корона, галочка и премиум-темы уже в профиле'
              : 'WintozoPro выдаёт администрация WinChat'}
          </div>
          {isActive && proStatus?.end_date && (
            <div style={s.proBadge}><ZapIcon size={14} /> {formatEndDate(proStatus.end_date)}</div>
          )}
        </div>

        <div style={s.section}>Возможности WintozoPro</div>
        {FEATURES.map((f, i) => (
          <div key={f.title} style={{ ...s.row, animationDelay: `${0.05 + i * 0.04}s` }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '13px', background: `${f.color}22`, color: f.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{f.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 750, fontSize: '14px' }}>{f.title}</div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>{f.desc}</div>
            </div>
          </div>
        ))}

        <div style={s.section}>Как получить WintozoPro</div>
        <div style={{ ...s.card, animationDelay: '0.2s' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            WintozoPro выдаётся администрацией WinChat. Напишите администратору в новом интерфейсе — подписка появится в профиле автоматически.
          </div>
        </div>

        <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-secondary)', opacity: 0.7, padding: '4px 0 14px' }}>
          <RocketIcon size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
          Wintozo · память о старом интерфейсе
        </div>
      </div>
    </div>
  )
}
