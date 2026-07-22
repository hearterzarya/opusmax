'use client'

import { useEffect, useRef } from 'react'

interface RevealProps {
  children: React.ReactNode
  as?: keyof React.JSX.IntrinsicElements
  className?: string
  delay?: 0 | 1 | 2 | 3 | 4 | 5
  direction?: 'up' | 'left' | 'right'
  /** set true to re-animate every time element re-enters viewport */
  repeat?: boolean
}

/**
 * Adds the .reveal class while the element is offscreen, then
 * toggles .visible on intersection so the CSS keyframes/transitions run.
 * No third-party animation libraries.
 */
export function Reveal({
  children,
  as: Tag = 'div',
  className = '',
  delay = 0,
  direction = 'up',
  repeat = false,
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const baseClass =
      direction === 'left'
        ? 'reveal-left'
        : direction === 'right'
          ? 'reveal-right'
          : 'reveal'
    const delayClass = delay ? `reveal-delay-${delay}` : ''
    el.classList.add(baseClass)
    if (delayClass) el.classList.add(delayClass)

    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('visible')
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            el.classList.add('visible')
            if (!repeat) io.unobserve(el)
          } else if (repeat) {
            el.classList.remove('visible')
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [delay, direction, repeat])

  const Component = Tag as React.ElementType
  return (
    <Component ref={ref as React.MutableRefObject<HTMLElement | null>} className={className}>
      {children}
    </Component>
  )
}