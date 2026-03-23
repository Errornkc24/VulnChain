import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Ban } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { STATUS_TRANSITIONS, TRANSITION_ROLES } from '../lib/constants'
import { pageTransition } from '../lib/animations'
import SeverityBadge from '../components/common/SeverityBadge'
import StatusBadge from '../components/common/StatusBadge'
import CVEInfoGrid from '../components/cve/CVEInfoGrid'
import CVETimeline from '../components/cve/CVETimeline'
import CVETransitionModal from '../components/cve/CVETransitionModal'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Loading from '../components/common/Loading'

export default function CVEDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const [cve, setCve] = useState(null)
  const [loading, setLoading] = useState(true)
  const [transitioning, setTransitioning] = useState(false)
  const [transitionTarget, setTransitionTarget] = useState(null)

  const fetchCve = async () => {
    try {
      const res = await api.cve.get(id)
      setCve(res.data?.cve || res.data)
    } catch {
      navigate('/app/cve')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCve() }, [id])

  const handleTransition = async (status, notes) => {
    setTransitioning(true)
    try {
      await api.cve.updateStatus(id, status, notes)
      await fetchCve()
      setTransitionTarget(null)
    } catch {}
    setTransitioning(false)
  }

  if (loading) return <Loading />
  if (!cve) return null

  const transitions = STATUS_TRANSITIONS[cve.status] || []
  const canTransition = hasRole(...TRANSITION_ROLES)

  const embargoActive = cve.embargoDate && new Date(cve.embargoDate) > new Date()
  const embargoCountdown = embargoActive
    ? Math.ceil((new Date(cve.embargoDate) - new Date()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <motion.div {...pageTransition} className="space-y-6">
      <button onClick={() => navigate('/app/cve')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors">
        <ArrowLeft size={16} /> Back to CVE List
      </button>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-xl font-bold font-mono text-matrix">{cve.cveId}</h1>
            <SeverityBadge severity={cve.severity} />
            <StatusBadge status={cve.status} />
          </div>
          <h2 className="text-lg text-gray-200">{cve.title}</h2>
        </div>
        {canTransition && (
          <div className="flex gap-2 flex-wrap">
            {transitions.map((s) => (
              <Button key={s} size="sm" onClick={() => setTransitionTarget(s)}>
                {s.replace(/_/g, ' ')}
              </Button>
            ))}
            {cve.status !== 'DEPRECATED' && (
              <Button size="sm" variant="danger" onClick={() => setTransitionTarget('DEPRECATED')}>
                <Ban size={14} /> Deprecate
              </Button>
            )}
          </div>
        )}
      </div>

      <CVEInfoGrid cve={cve} />

      {cve.affectedVersions?.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Affected Versions</h3>
          <div className="flex flex-wrap gap-2">
            {cve.affectedVersions.map((v, i) => (
              <span key={i} className="px-2 py-1 bg-surface-lighter rounded text-xs font-mono text-gray-400 border border-gray-800">{v}</span>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h3 className="text-sm font-semibold text-gray-300 mb-2">Description</h3>
        <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap">{cve.description}</p>
      </Card>

      {cve.cweDescription && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-300 mb-2">CWE Description</h3>
          <p className="text-sm text-gray-400">{cve.cweDescription}</p>
        </Card>
      )}

      {cve.patchInfo && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Patch Information</h3>
          <p className="text-sm text-gray-400 whitespace-pre-wrap">{cve.patchInfo}</p>
        </Card>
      )}

      {embargoActive && (
        <Card className="border-purple-500/30">
          <h3 className="text-sm font-semibold text-purple-400 mb-2">Embargo Active</h3>
          <p className="text-sm text-gray-400">
            Embargo expires on {new Date(cve.embargoDate).toLocaleDateString()} — <span className="text-purple-400 font-mono">{embargoCountdown} days remaining</span>
          </p>
        </Card>
      )}

      {cve.references?.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-300 mb-2">References</h3>
          <ul className="space-y-1">
            {cve.references.map((ref, i) => (
              <li key={i} className="text-sm text-accent hover:text-accent-dim truncate">{ref}</li>
            ))}
          </ul>
        </Card>
      )}

      <CVETimeline history={cve.history} />

      <CVETransitionModal
        isOpen={!!transitionTarget}
        onClose={() => setTransitionTarget(null)}
        targetStatus={transitionTarget}
        onConfirm={handleTransition}
        loading={transitioning}
      />
    </motion.div>
  )
}
