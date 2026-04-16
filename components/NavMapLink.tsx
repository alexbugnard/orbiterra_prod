'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function NavMapLink({ label }: { label: string }) {
  const pathname = usePathname()
  // Hide on trip detail pages — they have their own back arrow
  if (pathname.startsWith('/trips/')) return null

  return (
    <Link href="/map" className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5" aria-label={label}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="1,6 1,22 8,18 16,22 23,18 23,2 16,6 8,2"/>
        <line x1="8" y1="2" x2="8" y2="18"/>
        <line x1="16" y1="6" x2="16" y2="22"/>
      </svg>
      <span className="hidden md:inline text-sm">{label}</span>
    </Link>
  )
}
