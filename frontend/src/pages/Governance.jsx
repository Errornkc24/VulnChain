import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { GOVERNANCE_ROLES } from '../lib/constants'
import { pageTransition, staggerContainer } from '../lib/animations'
import ProposalCard from '../components/governance/ProposalCard'
import CreateProposalModal from '../components/governance/CreateProposalModal'
import Button from '../components/ui/Button'
import Loading from '../components/common/Loading'
import EmptyState from '../components/common/EmptyState'
import { Vote } from 'lucide-react'

const tabs = ['ALL', 'ACTIVE', 'PROPOSED', 'PASSED', 'REJECTED', 'ENACTED']

export default function Governance() {
  const [proposals, setProposals] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('ALL')
  const [showCreate, setShowCreate] = useState(false)
  const { hasRole } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    const params = tab !== 'ALL' ? { status: tab } : {}
    api.governance.listProposals(params)
      .then((res) => {
        const list = res.data?.proposals || res.data || []
        setProposals(Array.isArray(list) ? list : [])
      })
      .catch(() => setProposals([]))
      .finally(() => setLoading(false))
  }, [tab])

  return (
    <motion.div {...pageTransition} className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">Governance</h1>
        {hasRole(...GOVERNANCE_ROLES) && (
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={16} /> New Proposal
          </Button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              tab === t
                ? 'bg-matrix/15 text-matrix border border-matrix/30'
                : 'text-gray-500 hover:text-gray-300 hover:bg-surface-light border border-transparent'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <Loading />
      ) : proposals.length === 0 ? (
        <EmptyState icon={Vote} title="No proposals" description="No governance proposals found for this filter." />
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {proposals.map((p) => (
            <ProposalCard key={p.proposalId} proposal={p} />
          ))}
        </motion.div>
      )}

      <CreateProposalModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(id) => navigate(`/app/governance/${id}`)}
      />
    </motion.div>
  )
}
