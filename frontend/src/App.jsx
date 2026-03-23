import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import PublicLayout from './components/layout/PublicLayout'
import AppLayout from './components/layout/AppLayout'
import ProtectedRoute from './components/common/ProtectedRoute'
import { SUBMIT_ROLES } from './lib/constants'

import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import CVEList from './pages/CVEList'
import CVEDetail from './pages/CVEDetail'
import CVESubmit from './pages/CVESubmit'
import Governance from './pages/Governance'
import GovernanceDetail from './pages/GovernanceDetail'
import Analytics from './pages/Analytics'

function AuthRedirect({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return null
  if (isAuthenticated) return <Navigate to="/app/dashboard" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<AuthRedirect><Landing /></AuthRedirect>} />
        <Route path="/login" element={<AuthRedirect><Login /></AuthRedirect>} />
        <Route path="/register" element={<AuthRedirect><Register /></AuthRedirect>} />
      </Route>

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="cve" element={<CVEList />} />
        <Route path="cve/new" element={<ProtectedRoute roles={SUBMIT_ROLES}><CVESubmit /></ProtectedRoute>} />
        <Route path="cve/:id" element={<CVEDetail />} />
        <Route path="governance" element={<Governance />} />
        <Route path="governance/:id" element={<GovernanceDetail />} />
        <Route path="analytics" element={<Analytics />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
