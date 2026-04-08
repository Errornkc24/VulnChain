import { Clock } from 'lucide-react'
import SeverityBadge from '../common/SeverityBadge'

export default function ActivityFeed({ cves }) {
  const recent = cves
    .filter((c) => c.createdAt)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5)

  return (
    <div className="bg-surface border border-gray-800 rounded-xl p-5">
      <h2 className="text-lg font-semibold text-gray-100 mb-4">Activity</h2>
      {!recent.length ? (
        <p className="text-sm text-gray-500">No recent activity</p>
      ) : (
        <div className="space-y-3">
          {recent.map((cve) => (
            <div key={cve.cveId} className="flex items-start gap-3">
              <Clock className="w-4 h-4 text-gray-600 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-gray-300 truncate">
                  <span className="font-mono text-matrix text-xs">{cve.cveId}</span>{' '}
                  {cve.title}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <SeverityBadge severity={cve.severity} />
                  <span className="text-xs text-gray-600">
                    {new Date(cve.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
