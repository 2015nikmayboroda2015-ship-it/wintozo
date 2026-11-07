import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Index() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    if (user) {
      const device = localStorage.getItem('wintozo_device') || 'phone'
      navigate(`/messenger/${device}/chat`, { replace: true })
    } else {
      navigate('/messenger/registration/username', { replace: true })
    }
  }, [user, loading, navigate])

  return (
    <div className="auth-wrapper">
      <div className="logo">Wintozo</div>
    </div>
  )
}
