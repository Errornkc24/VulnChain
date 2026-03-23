import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Users } from 'lucide-react'
import Badge from '../ui/Badge'
import { STATUS, PROPOSAL_TYPES } from '../../lib/constants'
import { staggerItem } from '../../lib/animations'

export default function ProposalCard({ proposal }) {
  const navigate = useNavigate()
  const typeConfig = PROPOSAL_TYPES[proposal.type] || PROPOSAL_TYPES.POLICY_CHANGE
  const statusConfig = STATUS[proposal.status] || STATUS.DRAFT

  const voteCount = proposal.votes ? Object.keys(proposal.votes).length : 0

  return (
    <motion.div
      variants={staggerItem}
      onClick={() => navigate(`/app/governance/${proposal.proposalId}`)}
      className="bg-surface border border-gray-800 rounded-xl p-5 hover:border-gray-700 cursor-pointer transition-all duration-200 group"
    >
      <div className="flex items-start justify-between mb-3">
        <Badge className={typeConfig.bg}>{typeConfig.label}</Badge>
        <Badge className={statusConfig.bg}>{statusConfig.label}</Badge>
      </div>
      <h3 className="text-base font-semibold text-gray-200 mb-2 group-hover:text-matrix transition-colors">
        {proposal.title}
      </h3>
      <p className="text-sm text-gray-500 line-clamp-2 mb-4">{proposal.description}</p>
      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>{proposal.proposerOrg}</span>
        <span className="flex items-center gap-1"><Users size={12} /> {voteCount} votes</span>
      </div>
    </motion.div>
  )
}
