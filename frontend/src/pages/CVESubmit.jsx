import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Send } from 'lucide-react'
import api from '../services/api'
import { getSeverityFromScore } from '../lib/constants'
import { pageTransition } from '../lib/animations'
import WizardProgress from '../components/cve/WizardProgress'
import Input from '../components/ui/Input'
import Textarea from '../components/ui/Textarea'
import Select from '../components/ui/Select'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import SeverityBadge from '../components/common/SeverityBadge'

const steps = ['Basic Info', 'Scoring', 'Additional', 'Review']

export default function CVESubmit() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    title: '', description: '', affectedProduct: '', affectedVersions: '',
    cvssScore: '', severity: '', cvssVector: '', cweId: '', cweDescription: '',
    embargoDate: '', patchInfo: '', references: '',
  })

  const update = (field) => (e) => {
    const val = e.target.value
    const next = { ...form, [field]: val }
    if (field === 'cvssScore' && val) {
      next.severity = getSeverityFromScore(parseFloat(val))
    }
    setForm(next)
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      const data = {
        ...form,
        cvssScore: parseFloat(form.cvssScore) || 0,
        affectedVersions: form.affectedVersions ? form.affectedVersions.split(',').map((s) => s.trim()) : [],
        references: form.references ? form.references.split('\n').filter(Boolean) : [],
      }
      const res = await api.cve.create(data)
      navigate(`/app/cve/${res.data.cveId}`)
    } catch (err) {
      setError(err.response?.data?.error || 'Submission failed')
    }
    setLoading(false)
  }

  return (
    <motion.div {...pageTransition} className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => navigate('/app/cve')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors">
        <ArrowLeft size={16} /> Back to CVE List
      </button>

      <h1 className="text-2xl font-bold text-gray-100">Submit CVE</h1>

      <WizardProgress steps={steps} currentStep={step} />

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">{error}</div>
      )}

      <Card>
        {step === 0 && (
          <div className="space-y-4">
            <Input label="Title" placeholder="Vulnerability title" value={form.title} onChange={update('title')} required />
            <Textarea label="Description" placeholder="Detailed description..." value={form.description} onChange={update('description')} rows={4} required />
            <Input label="Affected Product" placeholder="e.g. Apache Log4j" value={form.affectedProduct} onChange={update('affectedProduct')} required />
            <Input label="Affected Versions" placeholder="Comma-separated, e.g. 2.0, 2.1, 2.2" value={form.affectedVersions} onChange={update('affectedVersions')} />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <p className="text-xs text-gray-500 bg-surface-light rounded-lg p-3 border border-gray-800">
              Provide your initial severity assessment. In production, NIST/NVD assigns the official score — here the submitting CNA provides a preliminary estimate for triage.
            </p>

            <div>
              <Input label="CVSS Score (0–10)" type="number" min="0" max="10" step="0.1" placeholder="e.g. 9.8" value={form.cvssScore} onChange={update('cvssScore')} required />
              <p className="text-xs text-gray-600 mt-1">Common Vulnerability Scoring System — rates severity from 0 (none) to 10 (critical).</p>
            </div>
            {form.severity && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Auto-calculated severity:</span>
                <SeverityBadge severity={form.severity} />
              </div>
            )}
            <Select label="Severity Override" value={form.severity} onChange={update('severity')}>
              <option value="">Auto-calculate from score</option>
              <option value="CRITICAL">Critical (9.0–10.0)</option>
              <option value="HIGH">High (7.0–8.9)</option>
              <option value="MEDIUM">Medium (4.0–6.9)</option>
              <option value="LOW">Low (0.1–3.9)</option>
              <option value="INFORMATIONAL">Informational (0.0)</option>
            </Select>

            <div>
              <Input label="CVSS Vector (optional)" placeholder="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H" value={form.cvssVector} onChange={update('cvssVector')} />
              <p className="text-xs text-gray-600 mt-1">The formula showing attack vector, complexity, privileges, impact etc. that produces the score.</p>
            </div>

            <div>
              <Input label="CWE ID (optional)" placeholder="e.g. CWE-79" value={form.cweId} onChange={update('cweId')} />
              <p className="text-xs text-gray-600 mt-1">Common Weakness Enumeration — categorizes the type of vulnerability (e.g. CWE-79 = XSS, CWE-89 = SQL Injection).</p>
            </div>

            <div>
              <Input label="CWE Description (optional)" placeholder="e.g. Improper Neutralization of Input During Web Page Generation" value={form.cweDescription} onChange={update('cweDescription')} />
              <p className="text-xs text-gray-600 mt-1">Human-readable name of the weakness category.</p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Input label="Embargo Date" type="datetime-local" value={form.embargoDate} onChange={update('embargoDate')} />
            <Textarea label="Patch Information" placeholder="Patch or mitigation details..." value={form.patchInfo} onChange={update('patchInfo')} rows={3} />
            <Textarea label="References" placeholder="One URL per line..." value={form.references} onChange={update('references')} rows={3} />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-300">Review Submission</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Title:</span> <span className="text-gray-200">{form.title}</span></div>
              <div><span className="text-gray-500">Product:</span> <span className="text-gray-200">{form.affectedProduct}</span></div>
              <div><span className="text-gray-500">CVSS:</span> <span className="text-gray-200 font-mono">{form.cvssScore}</span></div>
              <div><span className="text-gray-500">Severity:</span> {form.severity && <SeverityBadge severity={form.severity} />}</div>
              {form.cweId && <div><span className="text-gray-500">CWE:</span> <span className="text-gray-200">{form.cweId}</span></div>}
              {form.embargoDate && <div><span className="text-gray-500">Embargo:</span> <span className="text-gray-200">{form.embargoDate}</span></div>}
            </div>
            <div>
              <span className="text-sm text-gray-500">Description:</span>
              <p className="text-sm text-gray-300 mt-1 whitespace-pre-wrap">{form.description}</p>
            </div>
          </div>
        )}
      </Card>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
          <ArrowLeft size={16} /> Previous
        </Button>
        {step < 3 ? (
          <Button onClick={() => setStep(step + 1)}>
            Next <ArrowRight size={16} />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={loading}>
            <Send size={16} /> {loading ? 'Submitting...' : 'Submit CVE'}
          </Button>
        )}
      </div>
    </motion.div>
  )
}
