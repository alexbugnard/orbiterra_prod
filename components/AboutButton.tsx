'use client'

import { useState } from 'react'
import { AboutModal } from './AboutModal'

export function AboutButton({ label }: { label: string }) {
  const [open, setOpen] = useState(false)

  function openModal() {
    setOpen(true)
    window.dispatchEvent(new CustomEvent('aboutmodal', { detail: { open: true } }))
  }

  function closeModal() {
    setOpen(false)
    window.dispatchEvent(new CustomEvent('aboutmodal', { detail: { open: false } }))
  }

  return (
    <>
      <button
        onClick={openModal}
        className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5"
        aria-label={label}
      >
        {/* Info icon — always visible */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="8" strokeWidth="3" strokeLinecap="round"/>
          <line x1="12" y1="12" x2="12" y2="16"/>
        </svg>
        {/* Text — hidden on mobile */}
        <span className="hidden md:inline text-sm">{label}</span>
      </button>
      {open && <AboutModal onClose={closeModal} />}
    </>
  )
}
