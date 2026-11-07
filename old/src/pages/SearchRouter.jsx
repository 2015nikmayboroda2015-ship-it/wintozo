import { useLocation } from 'react-router-dom'
import MobileSearch from '../mobile/MobileSearch.jsx'
import ComputerSearch from '../computer/ComputerSearch.jsx'

export default function SearchRouter() {
  const location = useLocation()
  return location.pathname.includes('computer') ? <ComputerSearch /> : <MobileSearch />
}
