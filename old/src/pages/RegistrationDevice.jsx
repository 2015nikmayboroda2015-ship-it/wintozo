import { useNavigate } from 'react-router-dom'
import { PhoneIcon, ComputerIcon, RocketIcon } from '../components/Icons.jsx'

export default function RegistrationDevice() {
  const navigate = useNavigate()

  const select = (device) => {
    localStorage.setItem('wintozo_device', device)
    navigate(`/messenger/${device}/chat`, { replace: true })
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="logo">Wintozo</div>
        <div className="auth-subtitle">Аккаунт создан! Выбери устройство</div>
        <button className="btn-secondary" onClick={() => select('phone')}>
          <PhoneIcon size={20} /> Телефон
        </button>
        <button className="btn-secondary" onClick={() => select('computer')}>
          <ComputerIcon size={20} /> Компьютер
        </button>
        <button className="btn-primary" onClick={() => select('phone')}>
          <RocketIcon size={18} /> Начать общение
        </button>
      </div>
    </div>
  )
}
