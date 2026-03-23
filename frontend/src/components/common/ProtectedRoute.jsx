import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ShieldAlert } from 'lucide-react'

export default function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, user, loading } = useAuth()

  if (loading) return null

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <ShieldAlert className="w-16 h-16 text-red-500/50" />
        <h2 className="text-xl font-semibold text-gray-300">Access Denied</h2>
        <p className="text-sm text-gray-500">Required role: {roles.join(', ')}</p>
      </div>
    )
  }

  return children
}
