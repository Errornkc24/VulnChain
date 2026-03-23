import { cn } from '../../lib/cn'

export default function Card({ className, children, hover, ...props }) {
  return (
    <div
      className={cn(
        'bg-surface border border-gray-800 rounded-xl p-5',
        hover && 'transition-all duration-200 hover:border-gray-700 hover:bg-surface-light cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children }) {
  return <div className={cn('mb-4', className)}>{children}</div>
}

export function CardTitle({ className, children }) {
  return <h3 className={cn('text-lg font-semibold text-gray-100', className)}>{children}</h3>
}
