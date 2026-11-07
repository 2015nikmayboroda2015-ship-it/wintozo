import { useLocation } from 'react-router-dom'
import MobileSettings from '../mobile/MobileSettings.jsx'
import ComputerSettings from '../computer/ComputerSettings.jsx'

export default function SettingsRouter() {
  const location = useLocation()
  return location.pathname.includes('computer') ? <ComputerSettings /> : <MobileSettings />
}
