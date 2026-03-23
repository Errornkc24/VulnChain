import Card from '../ui/Card'
import { ThumbsUp, ThumbsDown, Minus } from 'lucide-react'

export default function VoteSummary({ votes }) {
  const entries = votes ? Object.values(votes) : []
  const yes = entries.filter((v) => v.decision === 'YES')
  const no = entries.filter((v) => v.decision === 'NO')
  const abstain = entries.filter((v) => v.decision === 'ABSTAIN')

  const yesWeight = yes.reduce((a, v) => a + (v.weight || 1), 0)
  const noWeight = no.reduce((a, v) => a + (v.weight || 1), 0)
  const abstainWeight = abstain.reduce((a, v) => a + (v.weight || 1), 0)

  const items = [
    { label: 'Yes', count: yes.length, weight: yesWeight, icon: ThumbsUp, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
    { label: 'No', count: no.length, weight: noWeight, icon: ThumbsDown, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
    { label: 'Abstain', count: abstain.length, weight: abstainWeight, icon: Minus, color: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/20' },
  ]

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map(({ label, count, weight, icon: Icon, color, bg }) => (
        <Card key={label} className={`border ${bg} p-4 text-center`}>
          <Icon size={20} className={`mx-auto mb-2 ${color}`} />
          <div className={`text-2xl font-bold font-mono ${color}`}>{count}</div>
          <div className="text-xs text-gray-500 mt-1">Weight: {weight}</div>
          <div className="text-xs text-gray-600">{label}</div>
        </Card>
      ))}
    </div>
  )
}
