import { ThumbsUp, ThumbsDown, Minus } from 'lucide-react'

const icons = { YES: ThumbsUp, NO: ThumbsDown, ABSTAIN: Minus }
const colors = { YES: 'text-green-400', NO: 'text-red-400', ABSTAIN: 'text-gray-400' }

export default function VoteHistory({ votes }) {
  const entries = votes ? Object.entries(votes) : []
  if (!entries.length) return null

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-300">Vote History</h3>
      {entries.map(([mspId, vote]) => {
        const Icon = icons[vote.decision] || Minus
        return (
          <div key={mspId} className="flex items-start gap-3 bg-surface-light rounded-lg p-3">
            <Icon size={16} className={colors[vote.decision] || 'text-gray-400'} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-300">{vote.voterOrg || mspId}</span>
                <span className="text-xs text-gray-600 font-mono">w:{vote.weight}</span>
              </div>
              {vote.reason && <p className="text-xs text-gray-500 mt-1">{vote.reason}</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
