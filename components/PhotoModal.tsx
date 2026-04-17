'use client'

import { useEffect } from 'react'

interface PhotoModalProps {
  imageUrl: string
  title: string
  onClose: () => void
}

export function PhotoModal({ imageUrl, title, onClose }: PhotoModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full rounded-2xl overflow-hidden"
        style={{ background: '#1e293b', border: '1px solid #334155', boxShadow: '0 40px 100px rgba(0,0,0,0.6)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-9 h-9 flex items-center justify-center rounded-full text-slate-400 hover:text-white transition-colors"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          aria-label="Close"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>

        <img
          src={imageUrl}
          alt={title}
          className="w-full object-contain"
          style={{ maxHeight: '75vh', display: 'block' }}
        />

        {title && (
          <div className="px-6 py-4 border-t border-slate-700">
            <p className="text-white font-medium">{title}</p>
          </div>
        )}
      </div>
    </div>
  )
}
