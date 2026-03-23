import { Search } from 'lucide-react'
import Input from '../ui/Input'
import Select from '../ui/Select'

export default function CVEFilters({ filters, setFilters }) {
  const update = (field) => (e) => setFilters((f) => ({ ...f, [field]: e.target.value }))

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
        <input
          type="text"
          placeholder="Search CVEs..."
          value={filters.q}
          onChange={update('q')}
          className="w-full bg-surface-light border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-matrix/50"
        />
      </div>
      <Select value={filters.severity} onChange={update('severity')}>
        <option value="">All Severities</option>
        <option value="CRITICAL">Critical</option>
        <option value="HIGH">High</option>
        <option value="MEDIUM">Medium</option>
        <option value="LOW">Low</option>
        <option value="INFORMATIONAL">Informational</option>
      </Select>
      <Select value={filters.status} onChange={update('status')}>
        <option value="">All Statuses</option>
        <option value="DRAFT">Draft</option>
        <option value="UNDER_REVIEW">Under Review</option>
        <option value="EMBARGOED">Embargoed</option>
        <option value="PUBLISHED">Published</option>
        <option value="DISPUTED">Disputed</option>
        <option value="DEPRECATED">Deprecated</option>
      </Select>
    </div>
  )
}
