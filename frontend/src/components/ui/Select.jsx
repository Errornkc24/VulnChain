import { cn } from '../../lib/cn'

export default function Select({ label, error, className, children, ...props }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-medium text-gray-400">{label}</label>}
      <select
        className={cn(
          'w-full bg-surface-light border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-200',
          'transition-colors duration-200',
          'focus:outline-none focus:border-matrix/50 focus:ring-1 focus:ring-matrix/20',
          className
        )}
        style={{ colorScheme: 'dark' }}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
