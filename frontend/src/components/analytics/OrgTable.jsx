import Card, { CardTitle } from '../ui/Card'

export default function OrgTable({ data }) {
  if (!data?.length) return null

  return (
    <Card>
      <CardTitle className="mb-4">CVEs by Organization</CardTitle>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Organization</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Published</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Draft</th>
            </tr>
          </thead>
          <tbody>
            {data.map((org, i) => (
              <tr key={i} className="border-b border-gray-800/30 hover:bg-surface-light transition-colors">
                <td className="px-4 py-3 text-gray-300">{org.organization || org.org}</td>
                <td className="px-4 py-3 font-mono text-matrix">{org.total}</td>
                <td className="px-4 py-3 font-mono text-green-400">{org.published || 0}</td>
                <td className="px-4 py-3 font-mono text-gray-400">{org.draft || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
