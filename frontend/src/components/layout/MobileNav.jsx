import { NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, LayoutDashboard, ShieldAlert, Vote, BarChart3, Plus } from 'lucide-react'
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

export default function MobileNav({ isOpen, onClose }) {
  const { hasRole } = useAuth()

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-40 lg:hidden"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed left-0 top-0 bottom-0 w-[280px] bg-surface border-r border-gray-800 z-50 lg:hidden flex flex-col"
          >
            <div className="h-16 flex items-center justify-between px-4 border-b border-gray-800">
              <Logo size="md" />
              <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 py-4 px-3 space-y-1">
              {navItems.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all',
                      isActive ? 'bg-matrix/10 text-matrix' : 'text-gray-500 hover:text-gray-300 hover:bg-surface-light'
                    )
                  }
                >
                  <Icon size={20} />
                  <span>{label}</span>
                </NavLink>
              ))}
              {hasRole(...SUBMIT_ROLES) && (
                <NavLink
                  to="/app/cve/new"
                  onClick={onClose}
                  className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-matrix/70 hover:text-matrix hover:bg-matrix/10 mt-4 border-t border-gray-800 pt-4"
                >
                  <Plus size={20} />
                  <span>Submit CVE</span>
                </NavLink>
              )}
            </nav>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
