import { useState } from 'react'
import Button from '../ui/Button'
import Textarea from '../ui/Textarea'
import Card from '../ui/Card'

export default function VotePanel({ onVote, loading }) {
  const [reason, setReason] = useState('')

  return (
    <Card className="border-matrix/20">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">Cast Your Vote</h3>
      <Textarea
        label="Reason (optional)"
        placeholder="Explain your vote..."
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
      />
      <div className="flex gap-3 mt-4">
        <Button onClick={() => onVote('YES', reason)} disabled={loading} className="flex-1">
          Yes
        </Button>
        <Button variant="danger" onClick={() => onVote('NO', reason)} disabled={loading} className="flex-1">
          No
        </Button>
        <Button variant="secondary" onClick={() => onVote('ABSTAIN', reason)} disabled={loading} className="flex-1">
          Abstain
        </Button>
      </div>
    </Card>
  )
}
