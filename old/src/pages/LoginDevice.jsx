import { useNavigate } from 'react-router-dom'
import { PhoneIcon, ComputerIcon } from '../components/Icons.jsx'

export default function LoginDevice() {
  const navigate = useNavigate()

  const select = (device) => {
    localStorage.setItem('wintozo_device', device)
    navigate(`/messenger/${device}/chat`, { replace: true })
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="logo">Wintozo</div>
        <div className="auth-subtitle">Выбери устройство</div>
        <button className="btn-secondary" onClick={() => select('phone')}>
          <PhoneIcon size={20} /> Телефон
        </button>
        <button className="btn-secondary" onClick={() => select('computer')}>
          <ComputerIcon size={20} /> Компьютер
        </button>
      </div>
    </div>
  )
}
