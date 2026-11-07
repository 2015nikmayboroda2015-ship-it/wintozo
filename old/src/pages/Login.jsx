import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { AtIcon, LockIcon, ArrowRightIcon } from '../components/Icons.jsx'

export default function Login() {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setError('')
    if (!username || !password) {
      setError('Заполни все поля')
      return
    }
    setLoading(true)
    const { error: loginError } = await signIn(username, password)
    if (loginError) {
      setError(loginError.message || 'Ошибка входа')
      setLoading(false)
      return
    }
    navigate('/messenger/login/device', { replace: true })
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="logo">Wintozo</div>
        <div className="auth-subtitle">Войти в аккаунт</div>
        <div className="input-group">
          <label className="input-label">Юзернейм</label>
          <div className="input-wrapper">
            <div className="input-icon"><AtIcon size={18} /></div>
            <input className="input-field" type="text" placeholder="@username" value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !loading && handleLogin()} />
          </div>
        </div>
        <div className="input-group">
          <label className="input-label">Пароль</label>
          <div className="input-wrapper">
            <div className="input-icon"><LockIcon size={18} /></div>
            <input className="input-field" type="password" placeholder="Введи пароль" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !loading && handleLogin()} />
          </div>
        </div>
        {error && <div className="error-text">{error}</div>}
        <button className="btn-primary" onClick={handleLogin} disabled={loading}>Войти <ArrowRightIcon size={18} /></button>
        <Link to="/messenger/registration/username" className="auth-link">Нет аккаунта? Создать</Link>
        <Link to="/messenger/user/news/registration/privacy-policy/" className="auth-privacy-link">Политика конфиденциальности</Link>
      </div>
    </div>
  )
}
