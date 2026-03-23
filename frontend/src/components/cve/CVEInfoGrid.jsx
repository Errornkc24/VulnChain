import Card from '../ui/Card'
import { Gauge, Package, User, Calendar, Shield, FileCode } from 'lucide-react'

export default function CVEInfoGrid({ cve }) {
  const items = [
    { icon: Gauge, label: 'CVSS Score', value: cve.cvssScore, mono: true },
    { icon: Package, label: 'Product', value: cve.affectedProduct },
    { icon: User, label: 'Submitter', value: cve.submitterOrg },
    { icon: Calendar, label: 'Created', value: new Date(cve.createdAt).toLocaleDateString() },
    { icon: Shield, label: 'CWE', value: cve.cweId || 'N/A' },
    { icon: FileCode, label: 'CVSS Vector', value: cve.cvssVector || 'N/A', mono: true },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {items.map(({ icon: Icon, label, value, mono }) => (
        <Card key={label} className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon size={14} className="text-gray-600" />
            <span className="text-xs text-gray-500">{label}</span>
          </div>
          <p className={`text-sm text-gray-200 truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
        </Card>
      ))}
    </div>
  )
}
