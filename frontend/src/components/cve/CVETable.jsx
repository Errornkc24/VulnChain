import { useNavigate } from 'react-router-dom'
import SeverityBadge from '../common/SeverityBadge'
import StatusBadge from '../common/StatusBadge'
import EmptyState from '../common/EmptyState'
import { ShieldAlert } from 'lucide-react'

export default function CVETable({ cves }) {
  const navigate = useNavigate()

  if (!cves.length) {
    return <EmptyState icon={ShieldAlert} title="No CVEs found" description="Try adjusting your filters or submit a new CVE." />
  }

  return (
    <div className="bg-surface border border-gray-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">CVE ID</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Severity</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">CVSS</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Product</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Date</th>
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
                <td className="px-5 py-3.5 text-gray-300 max-w-[250px] truncate">{cve.title}</td>
                <td className="px-5 py-3.5"><SeverityBadge severity={cve.severity} /></td>
                <td className="px-5 py-3.5 font-mono text-gray-400 hidden md:table-cell">{cve.cvssScore}</td>
                <td className="px-5 py-3.5"><StatusBadge status={cve.status} /></td>
                <td className="px-5 py-3.5 text-gray-500 hidden lg:table-cell truncate max-w-[150px]">{cve.affectedProduct}</td>
                <td className="px-5 py-3.5 text-gray-600 text-xs hidden lg:table-cell">
                  {new Date(cve.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
