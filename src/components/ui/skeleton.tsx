'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('skeleton rounded-md', className)} {...props} />
  )
)
Skeleton.displayName = 'Skeleton'

const TableSkeleton = () => (
  <div className="space-y-3">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="flex items-center gap-4">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-28" />
      </div>
    ))}
  </div>
)

const CardSkeleton = () => (
  <div className="rounded-xl border bg-card p-6 glass">
    <Skeleton className="h-6 w-24 mb-4" />
    <Skeleton className="h-10 w-full mb-2" />
    <Skeleton className="h-4 w-32" />
  </div>
)

export { Skeleton, TableSkeleton, CardSkeleton }