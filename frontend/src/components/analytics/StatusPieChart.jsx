import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { CHART_COLORS } from '../../lib/constants'
import Card, { CardTitle } from '../ui/Card'

const darkTooltip = {
  contentStyle: { background: '#1A1A1A', border: '1px solid #333', borderRadius: '8px' },
  itemStyle: { color: '#ddd' },
  labelStyle: { color: '#999' },
}

export default function StatusPieChart({ data }) {
  const chartData = Object.entries(data || {})
    .filter(([name, value]) => name !== 'total' && value > 0)
    .map(([name, value]) => ({ name, value }))

  return (
    <Card>
      <CardTitle className="mb-4">CVEs by Status</CardTitle>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} strokeWidth={0}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS.status[i % CHART_COLORS.status.length]} />
              ))}
            </Pie>
            <Tooltip {...darkTooltip} />
            <Legend
              formatter={(value) => <span style={{ color: '#aaa', fontSize: '12px' }}>{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
