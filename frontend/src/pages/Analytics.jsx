import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ShieldAlert, AlertTriangle, Globe, Lock } from 'lucide-react'
import api from '../services/api'
import { pageTransition } from '../lib/animations'
import KPICard from '../components/dashboard/KPICard'
import SeverityChart from '../components/analytics/SeverityChart'
import StatusPieChart from '../components/analytics/StatusPieChart'
import TrendsChart from '../components/analytics/TrendsChart'
import OrgTable from '../components/analytics/OrgTable'
import Loading from '../components/common/Loading'

export default function Analytics() {
  const [summary, setSummary] = useState(null)
  const [trends, setTrends] = useState([])
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.analytics.getSummary(),
      api.analytics.getTrends(),
      api.analytics.getOrgStats(),
    ])
      .then(([s, t, o]) => {
        setSummary(s.data)
        setTrends(Array.isArray(t.data) ? t.data : [])
        setOrgs(Array.isArray(o.data) ? o.data : [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Loading />

  const total = summary?.statusCounts ? Object.values(summary.statusCounts).reduce((a, b) => a + b, 0) : 0
  const critical = summary?.severityCounts?.CRITICAL || 0
  const published = summary?.statusCounts?.published || 0
  const embargoed = summary?.statusCounts?.embargoed || 0

  return (
    <motion.div {...pageTransition} className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-100">Analytics</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={ShieldAlert} label="Total CVEs" value={total} />
        <KPICard icon={AlertTriangle} label="Critical" value={critical} color="text-red-400" delay={0.05} />
        <KPICard icon={Globe} label="Published" value={published} color="text-green-400" delay={0.1} />
        <KPICard icon={Lock} label="Embargoed" value={embargoed} color="text-purple-400" delay={0.15} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SeverityChart data={summary?.severityCounts} />
        <StatusPieChart data={summary?.statusCounts} />
      </div>

      <TrendsChart data={trends} />
      <OrgTable data={orgs} />
    </motion.div>
  )
}
