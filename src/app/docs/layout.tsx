import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'OpusMax Documentation',
  description:
    'Set up OpusMax with Claude Code, Cursor, VS Code, Windsurf, Cline, Roo Code, and Claude-compatible API tools.',
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return children
}
