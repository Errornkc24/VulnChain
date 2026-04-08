import { useNavigate } from 'react-router-dom'
import SeverityBadge from '../common/SeverityBadge'
import StatusBadge from '../common/StatusBadge'
import { ShieldAlert } from 'lucide-react'

export default function RecentCVETable({ cves }) {
  const navigate = useNavigate()

  return (
    <div className="bg-surface border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-800">
        <h2 className="text-lg font-semibold text-gray-100">Recent CVEs</h2>
      </div>
      {!cves.length ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <ShieldAlert className="w-8 h-8 mb-2" />
          <p className="text-sm">No CVEs yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">CVE ID</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Severity</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {cves.map((cve) => (
                <tr
                  key={cve.cveId}
                  onClick={() => navigate(`/app/cve/${cve.cveId}`)}
                  className="border-b border-gray-800/30 hover:bg-surface-light cursor-pointer transition-colors"
                >
                  <td className="px-5 py-3.5 font-mono text-matrix text-xs">{cve.cveId}</td>
                  <td className="px-5 py-3.5 text-gray-300 max-w-[200px] truncate">{cve.title}</td>
                  <td className="px-5 py-3.5"><SeverityBadge severity={cve.severity} /></td>
                  <td className="px-5 py-3.5"><StatusBadge status={cve.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
