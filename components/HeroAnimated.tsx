'use client'

import { useEffect, useState } from 'react'

export function AnimatedLogo({ children }: { children: React.ReactNode }) {
  const [go, setGo] = useState(false)
  useEffect(() => { setGo(true) }, [])

  return (
    <div
      style={{
        perspective: 800,
        display: 'inline-block',
      }}
    >
      <div
        style={{
          animation: go
            ? 'spinY 3.4s cubic-bezier(0.08, 0.6, 0.25, 1) forwards'
            : 'none',
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </div>
  )
}

export function AnimatedButton({ children }: { children: React.ReactNode }) {
  const [go, setGo] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setGo(true), 400) // slight delay after logo
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      style={{
        animation: go ? 'revealLTR 1.4s cubic-bezier(0.4, 0, 0.2, 1) forwards' : 'none',
        clipPath: go ? undefined : 'inset(0 100% 0 0)',
        display: 'inline-block',
      }}
    >
      {children}
    </div>
  )
}
