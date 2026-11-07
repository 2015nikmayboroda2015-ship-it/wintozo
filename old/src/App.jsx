import { Routes, Route, Navigate } from 'react-router-dom'
import { Component } from 'react'
import { useAuth } from './context/AuthContext.jsx'
import Index from './pages/Index.jsx'
import Login from './pages/Login.jsx'
import LoginDevice from './pages/LoginDevice.jsx'
import RegistrationUsername from './pages/RegistrationUsername.jsx'
import RegistrationPassword from './pages/RegistrationPassword.jsx'
import RegistrationDevice from './pages/RegistrationDevice.jsx'
import SettingsRouter from './pages/SettingsRouter.jsx'
import SearchRouter from './pages/SearchRouter.jsx'
import ProStatusPage from './mobile/ProStatusPage.jsx'
import UserProfilePage from './pages/UserProfilePage.jsx'
import MobileChat from './mobile/MobileChat.jsx'
import ComputerChat from './computer/ComputerChat.jsx'
import PolitikaKonfeditialnostiPage from './pages/PolitikaKonfeditialnostiPage.jsx'
import AdminTerminalPage from './pages/AdminTerminalPage.jsx'
import { CandleIcon } from './components/Icons.jsx'

/** Ловит ошибку любой страницы и показывает экран вместо белого краша. */
class PageErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error('Legacy page error:', error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100dvh', gap: '14px', padding: '24px', textAlign: 'center',
          background: 'var(--bg, #1a1a2e)', color: 'var(--text, #fff)'
        }}>
          <div style={{ color: 'var(--warning, #f59e0b)', display: 'flex' }}>
            <CandleIcon size={42} />
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800 }}>Память о Wintozo</div>
          <div style={{ fontSize: '13px', opacity: 0.7, maxWidth: '340px', lineHeight: 1.5 }}>
            Эта страница старого интерфейса недоступна на новых серверах.
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ padding: '10px 26px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 700, background: '#6c63ff', color: '#fff' }}
          >
            Назад
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  const { loading } = useAuth()

  if (loading) {
    return (
      <div className="auth-wrapper">
        <div className="logo">Wintozo</div>
      </div>
    )
  }

  return (
    <PageErrorBoundary>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/messenger/login" element={<Login />} />
        <Route path="/messenger/login/device" element={<LoginDevice />} />
        <Route path="/messenger/registration/username" element={<RegistrationUsername />} />
        <Route path="/messenger/registration/password" element={<RegistrationPassword />} />
        <Route path="/messenger/registration/device/select" element={<RegistrationDevice />} />
        <Route path="/messenger/phone/chat" element={<MobileChat />} />
        <Route path="/messenger/phone/chat/:username" element={<MobileChat />} />
        <Route path="/messenger/phone/chat/user/:username" element={<UserProfilePage />} />
        <Route path="/messenger/computer/chat" element={<ComputerChat />} />
        <Route path="/messenger/computer/chat/:username" element={<ComputerChat />} />
        <Route path="/messenger/computer/chat/user/:username" element={<UserProfilePage />} />
        <Route path="/messenger/phone/chat/search" element={<SearchRouter />} />
        <Route path="/messenger/computer/chat/search" element={<SearchRouter />} />
        <Route path="/messenger/phone/settings" element={<SettingsRouter />} />
        <Route path="/messenger/computer/settings" element={<SettingsRouter />} />
        <Route path="/messenger/status/pro" element={<ProStatusPage />} />
        <Route path="/messenger/admin/terminal" element={<AdminTerminalPage />} />
        <Route path="/messenger/user/news/registration/privacy-policy/" element={<PolitikaKonfeditialnostiPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PageErrorBoundary>
  )
}
