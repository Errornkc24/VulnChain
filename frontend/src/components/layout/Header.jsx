import { useLocation, useNavigate } from 'react-router-dom'
import { LogOut, User, Menu } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import RoleBadge from '../common/RoleBadge'
import { useState, useRef, useEffect } from 'react'

const breadcrumbMap = {
  dashboard: 'Dashboard',
  cve: 'CVE Records',
  new: 'Submit CVE',
  governance: 'Governance',
  analytics: 'Analytics',
}

export default function Header({ onMobileMenuToggle }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  const segments = location.pathname.split('/').filter(Boolean).slice(1)
  const breadcrumbs = segments.map((s) => breadcrumbMap[s] || s)

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <header className="h-16 bg-black/60 backdrop-blur-md border-b border-gray-800 flex items-center justify-between px-6 sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <button onClick={onMobileMenuToggle} className="lg:hidden text-gray-500 hover:text-gray-300">
          <Menu size={20} />
        </button>
        <div className="text-sm text-gray-500 flex items-center gap-2">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && <span className="text-gray-700">/</span>}
              <span className={i === breadcrumbs.length - 1 ? 'text-gray-300' : ''}>{crumb}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-surface-light transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-matrix/15 border border-matrix/30 flex items-center justify-center">
            <User size={14} className="text-matrix" />
          </div>
          <span className="text-sm text-gray-300 hidden sm:block">{user?.username}</span>
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-2 w-56 bg-surface border border-gray-800 rounded-xl shadow-xl py-2 z-50">
            <div className="px-4 py-2 border-b border-gray-800">
              <p className="text-sm font-medium text-gray-200">{user?.username}</p>
              <div className="mt-1"><RoleBadge role={user?.role} /></div>
            </div>
            <button
              onClick={() => { logout(); navigate('/login'); setMenuOpen(false) }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-400 hover:text-red-400 hover:bg-surface-light transition-colors"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
