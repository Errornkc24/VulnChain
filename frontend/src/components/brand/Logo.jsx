import { cn } from '../../lib/cn'

export default function Logo({ size = 'md', showText = true, className }) {
  const sizes = { sm: 'w-7 h-7', md: 'w-9 h-9', lg: 'w-12 h-12', xl: 'w-16 h-16' }
  const textSizes = { sm: 'text-base', md: 'text-lg', lg: 'text-2xl', xl: 'text-3xl' }

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 40 40" className={cn(sizes[size], 'flex-shrink-0')} fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 3L5 10.5V21C5 30 11.4 38.2 20 40C28.6 38.2 35 30 35 21V10.5L20 3Z" fill="#111" stroke="#00FF41" strokeWidth="1.5" />
        <rect x="13" y="17" width="3" height="3" rx="0.5" fill="#00FF41" opacity="0.7" />
        <rect x="18.5" y="13" width="3" height="3" rx="0.5" fill="#00FF41" opacity="0.9" />
        <rect x="24" y="17" width="3" height="3" rx="0.5" fill="#00FF41" opacity="0.7" />
        <rect x="18.5" y="21" width="3" height="3" rx="0.5" fill="#00FF41" opacity="0.5" />
        <line x1="14.5" y1="20" x2="20" y2="14.5" stroke="#00FF41" strokeWidth="0.8" opacity="0.5" />
        <line x1="21.5" y1="16" x2="25.5" y2="17" stroke="#00FF41" strokeWidth="0.8" opacity="0.5" />
        <line x1="20" y1="21" x2="20" y2="16" stroke="#00FF41" strokeWidth="0.8" opacity="0.5" />
      </svg>
      {showText && (
        <span className={cn('font-bold tracking-tight', textSizes[size])}>
          <span className="text-matrix">Vuln</span>
          <span className="text-gray-200">Chain</span>
        </span>
      )}
    </div>
  )
}
