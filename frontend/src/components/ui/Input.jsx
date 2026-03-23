import { forwardRef } from 'react'
import { cn } from '../../lib/cn'

const Input = forwardRef(({ label, error, className, ...props }, ref) => {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-medium text-gray-400">{label}</label>}
      <input
        ref={ref}
        className={cn(
          'w-full bg-surface-light border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-200',
          'placeholder:text-gray-600 transition-colors duration-200',
          'focus:outline-none focus:border-matrix/50 focus:ring-1 focus:ring-matrix/20',
          error && 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
})

Input.displayName = 'Input'
export default Input
