import { cn } from '@/lib/utils'

export function DocsSection({
  id,
  title,
  children,
  className,
  description,
}: {
  id: string
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section id={id} className={cn('scroll-mt-28 border-t border-white/[0.06] pt-12', className)}>
      <h2 className="font-display text-2xl font-semibold tracking-tight text-white">{title}</h2>
      {description && <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-white/60">{description}</p>}
      <div className="mt-6 space-y-5">{children}</div>
    </section>
  )
}

export function DocsSubheading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-white">{children}</h3>
}

export function DocsProse({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('text-[15px] leading-relaxed text-white/60', className)}>{children}</p>
}
