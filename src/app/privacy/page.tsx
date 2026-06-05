import { SiteHeader } from '@/components/site/site-header'
import { SiteFooter } from '@/components/site/site-footer'

interface Section {
  title: string
  body?: string
  bullets?: string[]
}

const sections: Section[] = [
  {
    title: '1. Information We Collect',
    body:
      'We collect metadata about your API usage including the model used (e.g., claude-opus-4-8), token counts (input and output), request timestamps, latency measurements, status codes, and errors. We do NOT store prompt content, model responses, or your raw API keys (only hashed versions).',
  },
  {
    title: '2. How We Use Information',
    bullets: [
      'Provide and maintain our service',
      'Enforce rate limits and quotas',
      'Calculate and bill for usage',
      'Improve service performance',
      'Detect and prevent abuse',
      'Respond to legal requests',
    ],
  },
  {
    title: '3. Data Retention',
    bullets: [
      'Usage logs: 90 days',
      'Billing records: 7 years',
      'Account information: Duration of account + 30 days',
    ],
  },
  {
    title: '4. Data Security',
    bullets: [
      'Encryption in transit (TLS 1.2+)',
      'Encryption at rest for sensitive data',
      'API key hashing using SHA-256',
      'Regular security audits',
      'Access controls and authentication',
    ],
  },
  {
    title: '5. Third-Party Services',
    bullets: [
      'Database hosting (Neon — PostgreSQL)',
      'Caching and rate limiting (Upstash — Redis)',
      'Payment processing (Stripe)',
    ],
  },
  {
    title: '6. Cookies and Tracking',
    body:
      'We use minimal cookies — session cookies for admin authentication and essential cookies for service functionality. We do not use advertising or tracking cookies.',
  },
  {
    title: '7. Your Rights',
    bullets: [
      'Access your usage data',
      'Request deletion of your account data',
      'Export your usage records',
      'Opt out of non-essential data collection',
    ],
  },
  {
    title: "8. Children's Privacy",
    body:
      'Our service is not intended for users under 18 years of age. We do not knowingly collect information from children.',
  },
  {
    title: '9. Changes to Policy',
    body:
      'We may update this privacy policy periodically. We will notify you of significant changes via email or by posting on our website.',
  },
  {
    title: '10. Contact',
    body: 'For privacy-related questions, please contact us at privacy@opusmax.pro.',
  },
]

export default function PrivacyPage() {
  return (
    <div className="relative min-h-screen overflow-x-clip">
      <SiteHeader />

      <main className="aurora relative">
        <span className="aurora-blob" aria-hidden />
        <div className="relative z-10 mx-auto max-w-3xl px-6 py-14">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-white/50">Legal</p>
          <h1 className="font-display tracking-display mt-3 text-5xl font-semibold text-white md:text-6xl">
            Privacy <span className="gradient-text">policy</span>
          </h1>
          <p className="mt-3 max-w-2xl text-white/65">
            How OpusMax collects, uses, and protects your data.
          </p>

          <div className="mt-10 space-y-4">
            {sections.map((s) => (
              <section key={s.title} className="glass rounded-2xl p-6">
                <h2 className="font-display text-xl font-semibold tracking-tight text-white">
                  {s.title}
                </h2>
                {s.body && <p className="mt-3 text-white/70">{s.body}</p>}
                {s.bullets && (
                  <ul className="mt-3 space-y-1.5 text-white/70">
                    {s.bullets.map((b) => (
                      <li key={b} className="flex gap-2">
                        <span className="text-fuchsia-300">•</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          <p className="mt-10 text-center text-sm text-white/50">
            Last updated: April 30, 2026
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
