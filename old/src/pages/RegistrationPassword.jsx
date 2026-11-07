import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { LockIcon, ArrowRightIcon, BackIcon } from '../components/Icons.jsx'

export default function RegistrationPassword() {
  const navigate = useNavigate()
  const { regData, setRegData, signUp } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleFinish() {
    setError('')
    if (!password || !confirm) {
      setError('Заполни все поля')
      return
    }
    if (password.length < 6) {
      setError('Пароль минимум 6 символов')
      return
    }
    if (password !== confirm) {
      setError('Пароли не совпадают')
      return
    }
    setLoading(true)
    const { error: signUpError } = await signUp(regData.nickname, regData.username, password)
    if (signUpError) {
      setError(signUpError.message || 'Ошибка регистрации')
      setLoading(false)
      return
    }
    setRegData({ ...regData, password })
    navigate('/messenger/registration/device/select', { replace: true })
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="logo">Wintozo</div>
        <div className="auth-subtitle">Придумай пароль</div>
        <div className="input-group">
          <label className="input-label">Пароль</label>
          <div className="input-wrapper">
            <div className="input-icon"><LockIcon size={18} /></div>
            <input className="input-field" type="password" placeholder="Минимум 6 символов" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !loading && handleFinish()} />
          </div>
        </div>
        <div className="input-group">
          <label className="input-label">Повтори пароль</label>
          <div className="input-wrapper">
            <div className="input-icon"><LockIcon size={18} /></div>
            <input className="input-field" type="password" placeholder="Ещё раз" value={confirm} onChange={(e) => setConfirm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !loading && handleFinish()} />
          </div>
        </div>
        {error && <div className="error-text">{error}</div>}
        <button className="btn-primary" onClick={handleFinish} disabled={loading}>
          Создать аккаунт <ArrowRightIcon size={18} />
        </button>
        <button className="btn-secondary" onClick={() => navigate('/messenger/registration/username')}>
          <BackIcon size={16} /> Назад
        </button>
      </div>
    </div>
  )
}
