import { cn } from '../../lib/cn'

export default function Skeleton({ className }) {
  return (
    <div className={cn('animate-pulse bg-surface-lighter rounded-lg', className)} />
  )
}

export function SkeletonCard() {
  return (
    <div className="bg-surface border border-gray-800 rounded-xl p-5 space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  )
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}
