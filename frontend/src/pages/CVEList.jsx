import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { SUBMIT_ROLES } from '../lib/constants'
import { pageTransition } from '../lib/animations'
import CVEFilters from '../components/cve/CVEFilters'
import CVETable from '../components/cve/CVETable'
import Button from '../components/ui/Button'
import Loading from '../components/common/Loading'

export default function CVEList() {
  const [cves, setCves] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ q: '', severity: '', status: '' })
  const [page, setPage] = useState(1)
  const { hasRole } = useAuth()
  const perPage = 20

  const fetchCves = useCallback(async () => {
    setLoading(true)
    try {
      const hasFilters = filters.q || filters.severity || filters.status
      const res = hasFilters
        ? await api.cve.search(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)))
        : await api.cve.list()
      const list = res.data?.cves || res.data || []
      setCves(Array.isArray(list) ? list : [])
    } catch {
      setCves([])
    }
    setLoading(false)
  }, [filters])

  useEffect(() => {
    const timer = setTimeout(fetchCves, 300)
    return () => clearTimeout(timer)
  }, [fetchCves])

  const paged = cves.slice((page - 1) * perPage, page * perPage)
  const totalPages = Math.ceil(cves.length / perPage)

  return (
    <motion.div {...pageTransition} className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">CVE Records</h1>
        {hasRole(...SUBMIT_ROLES) && (
          <Link to="/app/cve/new">
            <Button><Plus size={16} /> Submit CVE</Button>
          </Link>
        )}
      </div>

      <CVEFilters filters={filters} setFilters={setFilters} />

      {loading ? <Loading /> : <CVETable cves={paged} />}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={`w-8 h-8 rounded-lg text-sm ${
                page === i + 1
                  ? 'bg-matrix/20 text-matrix border border-matrix/30'
                  : 'text-gray-500 hover:bg-surface-light'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  )
}
