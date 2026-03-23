import { useState } from 'react'
import Modal from '../ui/Modal'
import Textarea from '../ui/Textarea'
import Button from '../ui/Button'

export default function CVETransitionModal({ isOpen, onClose, targetStatus, onConfirm, loading }) {
  const [notes, setNotes] = useState('')

  const handleConfirm = () => {
    onConfirm(targetStatus, notes)
    setNotes('')
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Transition to ${targetStatus?.replace(/_/g, ' ')}`}>
      <div className="space-y-4">
        <p className="text-sm text-gray-400">
          You are about to change the status to <span className="text-matrix font-medium">{targetStatus?.replace(/_/g, ' ')}</span>.
        </p>
        <Textarea
          label="Notes (optional)"
          placeholder="Add notes about this transition..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? 'Processing...' : 'Confirm Transition'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
