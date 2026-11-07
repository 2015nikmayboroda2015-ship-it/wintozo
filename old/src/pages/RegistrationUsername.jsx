import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { AtIcon, UserIcon, ArrowRightIcon } from '../components/Icons.jsx'

export default function RegistrationUsername() {
  const navigate = useNavigate()
  const { regData, setRegData } = useAuth()
  const [nickname, setNickname] = useState(regData.nickname || '')
  const [username, setUsername] = useState(regData.username || '')
  const [error, setError] = useState('')

  function handleNext() {
    setError('')
    if (!nickname.trim() || !username.trim()) {
      setError('Заполни все поля')
      return
    }
    if (!/^[a-z0-9_]{3,20}$/i.test(username.trim())) {
      setError('Юзернейм: 3–20 символов, латиница, цифры и _')
      return
    }
    setRegData({ ...regData, nickname: nickname.trim(), username: username.trim() })
    navigate('/messenger/registration/password')
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="logo">Wintozo</div>
        <div className="auth-subtitle">Создание аккаунта</div>
        <div className="input-group">
          <label className="input-label">Никнейм</label>
          <div className="input-wrapper">
            <div className="input-icon"><UserIcon size={18} /></div>
            <input className="input-field" type="text" placeholder="Как тебя зовут?" value={nickname} onChange={(e) => setNickname(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleNext()} />
          </div>
        </div>
        <div className="input-group">
          <label className="input-label">Юзернейм</label>
          <div className="input-wrapper">
            <div className="input-icon"><AtIcon size={18} /></div>
            <input className="input-field" type="text" placeholder="@username" value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleNext()} />
          </div>
        </div>
        {error && <div className="error-text">{error}</div>}
        <button className="btn-primary" onClick={handleNext}>Далее <ArrowRightIcon size={18} /></button>
        <Link to="/messenger/login" className="auth-link">Уже есть аккаунт? Войти</Link>
      </div>
    </div>
  )
}
