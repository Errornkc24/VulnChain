import { cn } from '../../lib/cn'
import { Check } from 'lucide-react'

export default function WizardProgress({ steps, currentStep }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border transition-colors',
                i < currentStep
                  ? 'bg-matrix/20 border-matrix/40 text-matrix'
                  : i === currentStep
                  ? 'bg-matrix/10 border-matrix/30 text-matrix'
                  : 'bg-surface-light border-gray-700 text-gray-600'
              )}
            >
              {i < currentStep ? <Check size={14} /> : i + 1}
            </div>
            <span className={cn('text-xs hidden sm:block', i <= currentStep ? 'text-gray-300' : 'text-gray-600')}>
              {label}
            </span>
          </div>
          {i < steps.length - 1 && <div className={cn('w-8 h-px', i < currentStep ? 'bg-matrix/40' : 'bg-gray-800')} />}
        </div>
      ))}
    </div>
  )
}
