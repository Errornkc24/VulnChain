import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { UserPlus, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Logo from '../components/brand/Logo'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Button from '../components/ui/Button'

export default function Register() {
  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '', role: 'PUBLIC', organization: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  const showOrg = ['CNA_MEMBER', 'NATIONAL_BODY'].includes(form.role)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password.length < 6) return setError('Password must be at least 6 characters')
    if (form.password !== form.confirmPassword) return setError('Passwords do not match')
    setLoading(true)
    try {
      const { confirmPassword, ...data } = form
      if (!showOrg) delete data.organization
      await register(data)
      navigate('/login')
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-surface items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-matrix/5 to-transparent" />
        <div className="relative z-10 text-center px-12">
          <Logo size="xl" className="justify-center mb-8" />
          <p className="text-gray-500 text-lg leading-relaxed max-w-md">
            Join the decentralized vulnerability management network.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="lg:hidden mb-8">
            <Logo size="lg" className="justify-center" />
          </div>

          <h1 className="text-2xl font-bold text-gray-100 mb-2">Create account</h1>
          <p className="text-gray-500 text-sm mb-8">Register to get started</p>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-6">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Username" placeholder="Choose a username" value={form.username} onChange={update('username')} required />
            <Input label="Email" type="email" placeholder="you@example.com" value={form.email} onChange={update('email')} required />
            <Input label="Password" type="password" placeholder="Min 6 characters" value={form.password} onChange={update('password')} required />
            <Input label="Confirm Password" type="password" placeholder="Repeat password" value={form.confirmPassword} onChange={update('confirmPassword')} required />
            <Select label="Role" value={form.role} onChange={update('role')}>
              <option value="PUBLIC">Public</option>
              <option value="RESEARCHER">Researcher</option>
              <option value="CNA_MEMBER">CNA Member</option>
              <option value="NATIONAL_BODY">National Body</option>
            </Select>
            {showOrg && (
              <Input label="Organization" placeholder="Your organization name" value={form.organization} onChange={update('organization')} />
            )}
            <Button type="submit" disabled={loading} className="w-full">
              <UserPlus size={16} />
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>

          <p className="text-sm text-gray-500 text-center mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-matrix hover:text-matrix-dim transition-colors">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
