'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

const SPONSORS = [
  { name: 'RAB', logo: '/sponsors/rab-logo.png', url: 'https://rab.equipment' },
  { name: 'JULBO', logo: '/sponsors/julbo-logo.svg', url: 'https://www.julbo.com' },
  { name: 'SWIZA', logo: '/sponsors/swiza-logo.svg', url: 'https://www.swiza.com' },
  { name: 'GripGrab', logo: '/sponsors/gripgrab-logo.png', url: 'https://www.gripgrab.com' },
  { name: 'ICON OUTDOOR', logo: '/sponsors/icon-outdoor-logo.webp', url: 'https://icon-outdoor.ch/' },
  { name: 'bücher&walt', logo: '/sponsors/bucherwalt-logo.png', url: 'https://www.bucher-walt.ch' },
]

interface Props {
  panelOpen?: boolean
  hidden?: boolean
}

export function SponsorBanner({ panelOpen, hidden }: Props) {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIndex((i) => (i + 1) % SPONSORS.length)
        setVisible(true)
      }, 300)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const sponsor = SPONSORS[index]

  return (
    <a
      href={sponsor.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 md:gap-2 px-2 py-1.5 md:px-3 md:py-2 rounded-xl border border-slate-700 bg-slate-900/85 backdrop-blur-sm hover:border-orange-500/50 transition-[right,opacity] duration-300"
      style={{
        position: 'absolute',
        zIndex: 1000,
        top: '16px',
        right: panelOpen ? '444px' : '16px',
        opacity: visible && !hidden ? 1 : 0,
        pointerEvents: hidden ? 'none' : undefined,
      }}
    >
      {/* "Partner" label — desktop only */}
      <span className="hidden md:inline text-[10px] text-slate-500 uppercase tracking-wider leading-none whitespace-nowrap">Partner</span>
      <div className="h-5 md:h-6 flex items-center justify-center min-w-[40px] md:min-w-[56px]">
        {sponsor.logo ? (
          <Image
            src={sponsor.logo}
            alt={sponsor.name}
            width={72}
            height={24}
            className="h-5 md:h-6 w-auto max-w-[60px] md:max-w-[80px] object-contain"
            unoptimized
          />
        ) : (
          <span className="text-white font-bold text-sm whitespace-nowrap">{sponsor.name}</span>
        )}
      </div>
    </a>
  )
}
