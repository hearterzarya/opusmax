import { SiteHeader } from '@/components/site/site-header'
import { SiteFooter } from '@/components/site/site-footer'

interface Section {
  title: string
  body?: string
  bullets?: string[]
}

const sections: Section[] = [
  {
    title: '1. Acceptance of Terms',
    body:
      'By accessing and using OpusMax, you agree to be bound by these Terms of Service. If you do not agree, please do not use our service.',
  },
  {
    title: '2. Description of Service',
    body:
      'OpusMax provides an API proxy service that allows users to access AI models through our infrastructure. We act as an intermediary between you and upstream AI providers including Anthropic. We reserve the right to modify, suspend, or discontinue any part of our service at any time without prior notice.',
  },
  {
    title: '3. Account Registration',
    body:
      'You may need to register for an account to access certain features. You are responsible for maintaining the confidentiality of your account credentials and API keys, and for keeping registration information accurate and up to date.',
  },
  {
    title: '4. Acceptable Use',
    bullets: [
      'No illegal or unauthorized purpose',
      'No attempting to gain unauthorized access to our systems or other users\' accounts',
      'No interference with or disruption of the service or servers',
      'No automated tools used at excessive or abusive levels',
      'No reselling or redistribution of the service without authorization',
      'No violation of third-party rights or applicable laws',
    ],
  },
  {
    title: '5. API Keys and Authentication',
    bullets: [
      'Keep your API keys secure and confidential',
      'You are responsible for all activity under your API keys',
      'Notify us immediately of any unauthorized use',
    ],
  },
  {
    title: '6. Rate Limits and Quotas',
    body:
      'Your use of the service is subject to rate limits and quotas as specified in your plan. Exceeding these limits may result in temporary or permanent suspension of access.',
  },
  {
    title: '7. Fees and Payment',
    body:
      'Some features require payment. All fees are as published on our website or as agreed in writing. We reserve the right to change pricing with 30 days notice. All fees are non-refundable unless otherwise specified.',
  },
  {
    title: '8. Limitation of Liability',
    body:
      'TO THE MAXIMUM EXTENT PERMITTED BY LAW, OPUSMAX SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL, ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE.',
  },
  {
    title: '9. Termination',
    body:
      'We may terminate or suspend your access immediately, without prior notice, for any reason, including breach of these Terms. Upon termination, your right to use the service will immediately cease.',
  },
  {
    title: '10. Changes to Terms',
    body:
      'We reserve the right to modify these terms at any time. We will provide notice of significant changes via email or by posting on our website. Your continued use after such modifications constitutes acceptance.',
  },
  {
    title: '11. Contact',
    body: 'For questions about these Terms, please contact us at legal@opusmax.pro.',
  },
]

export default function TermsPage() {
  return (
    <div className="relative min-h-screen overflow-x-clip">
      <SiteHeader />

      <main className="aurora relative">
        <span className="aurora-blob" aria-hidden />
        <div className="relative z-10 mx-auto max-w-3xl px-6 py-14">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-white/50">Legal</p>
          <h1 className="font-display tracking-display mt-3 text-5xl font-semibold text-white md:text-6xl">
            Terms of <span className="gradient-text">service</span>
          </h1>
          <p className="mt-3 max-w-2xl text-white/65">
            The rules that govern your use of OpusMax.
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
