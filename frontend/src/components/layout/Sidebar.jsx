import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, ShieldAlert, Vote, BarChart3,
  ChevronLeft, ChevronRight, Plus
} from 'lucide-react'
import Logo from '../brand/Logo'
import { useAuth } from '../../context/AuthContext'
import { SUBMIT_ROLES } from '../../lib/constants'
import { cn } from '../../lib/cn'

const navItems = [
  { to: '/app/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/app/cve', icon: ShieldAlert, label: 'CVE Records' },
  { to: '/app/governance', icon: Vote, label: 'Governance' },
  { to: '/app/analytics', icon: BarChart3, label: 'Analytics' },
]

export default function Sidebar({ collapsed, setCollapsed }) {
  const { hasRole } = useAuth()

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ duration: 0.2 }}
      className="fixed left-0 top-0 bottom-0 z-30 bg-surface border-r border-gray-800 flex flex-col"
    >
      <div className="h-16 flex items-center px-4 border-b border-gray-800">
        <Logo size={collapsed ? 'sm' : 'md'} showText={!collapsed} />
      </div>

      <nav className="flex-1 py-4 px-2 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-matrix/10 text-matrix border border-matrix/20'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-surface-light border border-transparent'
              )
            }
          >
            <Icon size={20} className="flex-shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}

        {!collapsed && hasRole(...SUBMIT_ROLES) && (
          <div className="pt-4 mt-4 border-t border-gray-800">
            <NavLink
              to="/app/cve/new"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-matrix/70 hover:text-matrix hover:bg-matrix/10 border border-transparent hover:border-matrix/20 transition-all duration-200"
            >
              <Plus size={20} />
              <span>Submit CVE</span>
            </NavLink>
          </div>
        )}
      </nav>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="h-12 flex items-center justify-center border-t border-gray-800 text-gray-600 hover:text-gray-400 transition-colors"
      >
        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>
    </motion.aside>
  )
}
