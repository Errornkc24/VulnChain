import { cn } from '../../lib/cn'

const variants = {
  primary: 'bg-matrix/20 text-matrix border border-matrix/40 hover:bg-matrix/30 hover:glow-green-sm',
  secondary: 'bg-surface-light text-gray-300 border border-gray-700 hover:bg-surface-lighter hover:border-gray-600',
  danger: 'bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25',
  ghost: 'text-gray-400 hover:text-gray-200 hover:bg-surface-light',
  accent: 'bg-accent/20 text-accent border border-accent/40 hover:bg-accent/30',
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

export default function Button({ variant = 'primary', size = 'md', className, children, disabled, ...props }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-matrix/30 focus:ring-offset-1 focus:ring-offset-black',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
