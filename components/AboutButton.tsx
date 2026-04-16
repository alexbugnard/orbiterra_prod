'use client'

import { useState } from 'react'
import { AboutModal } from './AboutModal'

export function AboutButton({ label }: { label: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-slate-400 hover:text-white transition-colors"
      >
        {label}
      </button>
      {open && <AboutModal onClose={() => setOpen(false)} />}
    </>
  )
}
