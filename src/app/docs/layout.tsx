import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'OpusMax Documentation',
  description:
    'Set up OpusMax with npx opusmaxx — configure Claude Code, Cursor, VS Code, Windsurf, Cline, Roo Code, and more.',
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return children
}
