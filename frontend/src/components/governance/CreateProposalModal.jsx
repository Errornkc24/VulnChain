import { useState } from 'react'
import Modal from '../ui/Modal'
import Input from '../ui/Input'
import Select from '../ui/Select'
import Textarea from '../ui/Textarea'
import Button from '../ui/Button'
import api from '../../services/api'

export default function CreateProposalModal({ isOpen, onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', type: 'POLICY_CHANGE', description: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await api.governance.createProposal(form)
      onCreated(res.data.proposalId)
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create proposal')
    }
    setLoading(false)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Proposal">
      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">{error}</div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Title" placeholder="Proposal title" value={form.title} onChange={update('title')} required />
        <Select label="Type" value={form.type} onChange={update('type')}>
          <option value="POLICY_CHANGE">Policy Change</option>
          <option value="CNA_MEMBERSHIP">CNA Membership</option>
          <option value="SEVERITY_THRESHOLD">Severity Threshold</option>
          <option value="EMBARGO_EXTENSION">Embargo Extension</option>
        </Select>
        <Textarea label="Description" placeholder="Describe the proposal..." value={form.description} onChange={update('description')} rows={4} required />
        <div className="flex justify-end gap-3">
          <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create Proposal'}</Button>
        </div>
      </form>
    </Modal>
  )
}
