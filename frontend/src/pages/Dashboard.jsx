import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ShieldAlert, AlertTriangle, Lock, Globe } from 'lucide-react'
import api from '../services/api'
import KPICard from '../components/dashboard/KPICard'
import RecentCVETable from '../components/dashboard/RecentCVETable'
import QuickActions from '../components/dashboard/QuickActions'
import ActivityFeed from '../components/dashboard/ActivityFeed'
import Loading from '../components/common/Loading'
import { pageTransition } from '../lib/animations'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [cves, setCves] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.analytics.getSummary(), api.cve.list()])
      .then(([summaryRes, cveRes]) => {
        setStats(summaryRes.data)
        const list = cveRes.data?.cves || cveRes.data || []
        setCves(Array.isArray(list) ? list : [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Loading />

  const total = stats?.statusCounts?.total || 0
  const critical = stats?.severityCounts?.CRITICAL || 0
  const embargoed = stats?.statusCounts?.embargoed || 0
  const published = stats?.statusCounts?.published || 0

  return (
    <motion.div {...pageTransition} className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-100">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={ShieldAlert} label="Total CVEs" value={total} delay={0} />
        <KPICard icon={AlertTriangle} label="Critical" value={critical} color="text-red-400" delay={0.05} />
        <KPICard icon={Lock} label="Embargoed" value={embargoed} color="text-purple-400" delay={0.1} />
        <KPICard icon={Globe} label="Published" value={published} color="text-green-400" delay={0.15} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentCVETable cves={cves.slice(0, 10)} />
        </div>
        <div className="space-y-6">
          <QuickActions />
          <ActivityFeed cves={cves} />
        </div>
      </div>
    </motion.div>
  )
}
