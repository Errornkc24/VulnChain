import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { CHART_COLORS } from '../../lib/constants'
import Card, { CardTitle } from '../ui/Card'

const darkTooltip = {
  contentStyle: { background: '#1A1A1A', border: '1px solid #333', borderRadius: '8px' },
  itemStyle: { color: '#ddd' },
  labelStyle: { color: '#999' },
  cursor: { fill: 'rgba(255,255,255,0.05)' },
}

export default function SeverityChart({ data }) {
  const chartData = Object.entries(data || {}).map(([name, value]) => ({ name, value }))

  return (
    <Card>
      <CardTitle className="mb-4">CVEs by Severity</CardTitle>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <XAxis dataKey="name" tick={{ fill: '#aaa', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#888', fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip {...darkTooltip} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={CHART_COLORS.severity[entry.name] || '#666'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
