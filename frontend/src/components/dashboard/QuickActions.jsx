import { useNavigate } from 'react-router-dom'
import { Plus, Search, Vote } from 'lucide-react'

const actions = [
  { label: 'Submit CVE', icon: Plus, path: '/app/cve/new', color: 'text-cyan-400' },
  { label: 'Browse CVEs', icon: Search, path: '/app/cve', color: 'text-green-400' },
  { label: 'Governance', icon: Vote, path: '/app/governance', color: 'text-purple-400' },
]

export default function QuickActions() {
  const navigate = useNavigate()

  return (
    <div className="bg-surface border border-gray-800 rounded-xl p-5">
      <h2 className="text-lg font-semibold text-gray-100 mb-4">Quick Actions</h2>
      <div className="space-y-2">
        {actions.map((a) => (
          <button
            key={a.path}
            onClick={() => navigate(a.path)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-800/40 hover:bg-gray-800 transition-colors text-left"
          >
            <a.icon className={`w-5 h-5 ${a.color}`} />
            <span className="text-sm text-gray-300">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
