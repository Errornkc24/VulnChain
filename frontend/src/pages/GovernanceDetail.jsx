import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Play, Calculator } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { GOVERNANCE_ROLES, ORG_TO_MSP, PROPOSAL_TYPES } from '../lib/constants'
import { pageTransition } from '../lib/animations'
import StatusBadge from '../components/common/StatusBadge'
import Badge from '../components/ui/Badge'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Loading from '../components/common/Loading'
import VoteSummary from '../components/governance/VoteSummary'
import VoteProgressBar from '../components/governance/VoteProgressBar'
import VotePanel from '../components/governance/VotePanel'
import VoteHistory from '../components/governance/VoteHistory'

export default function GovernanceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, hasRole } = useAuth()
  const [proposal, setProposal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [tallyResult, setTallyResult] = useState(null)

  const fetchProposal = async () => {
    try {
      const res = await api.governance.getProposal(id)
      setProposal(res.data?.proposal || res.data)
    } catch {
      navigate('/app/governance')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProposal() }, [id])

  const handleActivate = async () => {
    setActionLoading(true)
    try {
      await api.governance.activateProposal(id)
      await fetchProposal()
    } catch {}
    setActionLoading(false)
  }

  const handleTally = async () => {
    setActionLoading(true)
    try {
      const res = await api.governance.tally(id)
      setTallyResult(res.data.result)
      await fetchProposal()
    } catch {}
    setActionLoading(false)
  }

  const handleVote = async (decision, reason) => {
    setActionLoading(true)
    try {
      await api.governance.vote(id, { decision, reason })
      await fetchProposal()
    } catch {}
    setActionLoading(false)
  }

  if (loading) return <Loading />
  if (!proposal) return null

  const typeConfig = PROPOSAL_TYPES[proposal.type] || PROPOSAL_TYPES.POLICY_CHANGE
  const canManage = hasRole(...GOVERNANCE_ROLES)
  const userOrg = user?.organization?.toLowerCase() || ''
  const userMSP = ORG_TO_MSP[userOrg]
  const hasVoted = userMSP && proposal.votes?.[userMSP]
  const canVote = proposal.status === 'ACTIVE' && canManage && !hasVoted

  return (
    <motion.div {...pageTransition} className="space-y-6 max-w-3xl mx-auto">
      <button onClick={() => navigate('/app/governance')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors">
        <ArrowLeft size={16} /> Back to Governance
      </button>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm font-mono text-gray-500">{proposal.proposalId}</span>
            <StatusBadge status={proposal.status} />
            <Badge className={typeConfig.bg}>{typeConfig.label}</Badge>
          </div>
          <h1 className="text-xl font-bold text-gray-100">{proposal.title}</h1>
        </div>
        <div className="flex gap-2">
          {proposal.status === 'PROPOSED' && canManage && (
            <Button onClick={handleActivate} disabled={actionLoading}>
              <Play size={14} /> Activate Voting
            </Button>
          )}
          {proposal.status === 'ACTIVE' && canManage && (
            <Button variant="accent" onClick={handleTally} disabled={actionLoading}>
              <Calculator size={14} /> Tally Votes
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <div className="text-xs text-gray-500 mb-1">Proposer</div>
          <div className="text-sm text-gray-300">{proposal.proposerOrg}</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-xs text-gray-500 mb-1">Quorum</div>
          <div className="text-sm text-gray-300 font-mono">{proposal.quorum}%</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-xs text-gray-500 mb-1">Threshold</div>
          <div className="text-sm text-gray-300 font-mono">{proposal.threshold}%</div>
        </Card>
      </div>

      <Card>
        <h3 className="text-sm font-semibold text-gray-300 mb-2">Description</h3>
        <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap">{proposal.description}</p>
      </Card>

      {tallyResult && (
        <Card className="border-matrix/30">
          <h3 className="text-sm font-semibold text-matrix mb-2">Tally Result</h3>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div><span className="text-gray-500">Status:</span> <span className="text-gray-200">{tallyResult.status}</span></div>
            <div><span className="text-gray-500">Approval:</span> <span className="text-gray-200 font-mono">{tallyResult.approvalRate}%</span></div>
            <div><span className="text-gray-500">Participation:</span> <span className="text-gray-200 font-mono">{tallyResult.participation}%</span></div>
          </div>
        </Card>
      )}

      <VoteSummary votes={proposal.votes} />
      <VoteProgressBar votes={proposal.votes} />

      {canVote && <VotePanel onVote={handleVote} loading={actionLoading} />}

      {hasVoted && (
        <Card className="border-green-500/20">
          <p className="text-sm text-green-400">You have already voted on this proposal.</p>
        </Card>
      )}

      <VoteHistory votes={proposal.votes} />
    </motion.div>
  )
}
