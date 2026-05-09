import type { Metadata } from 'next'
import { Inter, JetBrains_Mono, Sora } from 'next/font/google'
import './globals.css'

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700'],
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'OpusMax — One key. Every model.',
  description:
    'A blazing-fast, Anthropic-compatible AI gateway with per-key budgets, real-time usage, and a beautiful admin console.',
  keywords: ['OpusMax', 'Anthropic-compatible', 'API gateway', 'Claude API', 'usage tracking'],
  authors: [{ name: 'OpusMax' }],
  openGraph: {
    title: 'OpusMax — One key. Every model.',
    description: 'A blazing-fast, Anthropic-compatible AI gateway.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${inter.variable} ${jetbrains.variable}`}>
      <body
        suppressHydrationWarning
        className="min-h-screen bg-background text-foreground antialiased font-sans"
      >
        {children}
      </body>
    </html>
  )
}
