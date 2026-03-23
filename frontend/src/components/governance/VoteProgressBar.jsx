export default function VoteProgressBar({ votes }) {
  const entries = votes ? Object.values(votes) : []
  const yesWeight = entries.filter((v) => v.decision === 'YES').reduce((a, v) => a + (v.weight || 1), 0)
  const noWeight = entries.filter((v) => v.decision === 'NO').reduce((a, v) => a + (v.weight || 1), 0)
  const abstainWeight = entries.filter((v) => v.decision === 'ABSTAIN').reduce((a, v) => a + (v.weight || 1), 0)
  const total = yesWeight + noWeight + abstainWeight

  if (!total) return null

  const yPct = (yesWeight / total) * 100
  const nPct = (noWeight / total) * 100

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-gray-500">
        <span>Yes {yPct.toFixed(1)}%</span>
        <span>No {nPct.toFixed(1)}%</span>
      </div>
      <div className="h-3 bg-surface-lighter rounded-full overflow-hidden flex">
        {yPct > 0 && <div className="bg-green-500/60 transition-all" style={{ width: `${yPct}%` }} />}
        {nPct > 0 && <div className="bg-red-500/60 transition-all" style={{ width: `${nPct}%` }} />}
        {total - yesWeight - noWeight > 0 && <div className="bg-gray-600/40 flex-1" />}
      </div>
    </div>
  )
}
