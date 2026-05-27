import { DocsCodeBlock } from '@/components/docs/docs-code-block'
import { DocsProse } from '@/components/docs/docs-section'
import { cn } from '@/lib/utils'

export function DocsApiSection({
  id,
  method,
  pathBadge,
  fullUrl,
  title,
  description,
  children,
}: {
  id: string
  method: 'GET' | 'POST'
  pathBadge: string
  fullUrl: string
  title: string
  description: string
  children?: React.ReactNode
}) {
  const isGet = method === 'GET'
  return (
    <section id={id} className="scroll-mt-28 border-t border-white/[0.06] pt-12">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'inline-flex rounded-md px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wide',
            isGet
              ? 'border border-white/10 bg-white/[0.04] text-white/80'
              : 'bg-gradient-to-r from-cyan-600 to-violet-600 text-white shadow-[0_0_20px_rgba(34,211,238,0.25)]'
          )}
        >
          {method}
        </span>
        <code className="font-mono text-sm text-white/70">{pathBadge}</code>
      </div>
      <code className="mt-2 block break-all font-mono text-xs text-cyan-200/80">{fullUrl}</code>
      <h2 className="font-display mt-4 text-2xl font-semibold text-white">{title}</h2>
      <DocsProse className="mt-2">{description}</DocsProse>
      {children && <div className="mt-6 space-y-4">{children}</div>}
    </section>
  )
}

export function DocsApiCodePair({
  requestLabel,
  request,
  responseLabel,
  response,
  note,
}: {
  requestLabel?: string
  request?: string
  responseLabel?: string
  response?: string
  note?: string
}) {
  return (
    <>
      {request && <DocsCodeBlock label={requestLabel ?? 'Request'} code={request} />}
      {response && <DocsCodeBlock label={responseLabel ?? 'Response'} code={response} />}
      {note && <p className="text-sm text-white/50">{note}</p>}
    </>
  )
}
