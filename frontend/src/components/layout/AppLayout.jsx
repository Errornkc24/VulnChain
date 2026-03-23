import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import MobileNav from './MobileNav'

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-app bg-grid">
      <div className="hidden lg:block">
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      </div>
      <MobileNav isOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className={`transition-all duration-200 ${collapsed ? 'lg:ml-[72px]' : 'lg:ml-[240px]'}`}>
        <Header onMobileMenuToggle={() => setMobileOpen(true)} />
        <main className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
