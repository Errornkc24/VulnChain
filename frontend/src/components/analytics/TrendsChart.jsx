import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { CHART_COLORS } from '../../lib/constants'
import Card, { CardTitle } from '../ui/Card'

const darkTooltip = {
  contentStyle: { background: '#1A1A1A', border: '1px solid #333', borderRadius: '8px' },
  itemStyle: { color: '#ddd' },
  labelStyle: { color: '#999' },
}

export default function TrendsChart({ data }) {
  if (!data?.length) return null

  return (
    <Card>
      <CardTitle className="mb-4">CVE Trends</CardTitle>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" />
            <XAxis dataKey="month" tick={{ fill: '#aaa', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#888', fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip {...darkTooltip} />
            <Legend
              formatter={(value) => <span style={{ color: '#aaa', fontSize: '12px' }}>{value}</span>}
            />
            <Line type="monotone" dataKey="total" stroke={CHART_COLORS.trends.total} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="critical" stroke={CHART_COLORS.trends.critical} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="high" stroke={CHART_COLORS.trends.high} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
