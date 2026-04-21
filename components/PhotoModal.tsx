'use client'

import { useEffect, useState } from 'react'

interface Photo {
  imageUrl: string
  title: string
}

interface PhotoModalProps {
  photos: Photo[]
  initialIndex: number
  onClose: () => void
}

export function PhotoModal({ photos, initialIndex, onClose }: PhotoModalProps) {
  const [index, setIndex] = useState(initialIndex)
  const photo = photos[index]
  const total = photos.length

  function prev() { setIndex((i) => (i - 1 + total) % total) }
  function next() { setIndex((i) => (i + 1) % total) }

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (total > 1 && e.key === 'ArrowLeft') prev()
      if (total > 1 && e.key === 'ArrowRight') next()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, total])

  if (!photo) return null

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
        {/* Close */}
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

        {/* Prev / Next */}
        {total > 1 && (
          <>
            <button
              onClick={prev}
              className="group absolute left-3 top-1/2 -translate-y-1/2 z-10 w-11 h-11 flex items-center justify-center rounded-full text-white transition-all duration-150 hover:scale-110"
              style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.1)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(249,115,22,0.75)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.45)')}
              aria-label="Previous"
              title="Previous photo"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>
            <button
              onClick={next}
              className="group absolute right-3 top-1/2 -translate-y-1/2 z-10 w-11 h-11 flex items-center justify-center rounded-full text-white transition-all duration-150 hover:scale-110"
              style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.1)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(249,115,22,0.75)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.45)')}
              aria-label="Next"
              title="Next photo"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          </>
        )}

        <img
          src={photo.imageUrl}
          alt={photo.title}
          className="w-full object-contain"
          style={{ maxHeight: '75vh', display: 'block' }}
        />

        <div className="px-6 py-3 border-t border-slate-700 flex items-center justify-between gap-4">
          <p className="text-white font-medium truncate">{photo.title}</p>
          {total > 1 && (
            <span className="text-slate-500 text-sm shrink-0">{index + 1} / {total}</span>
          )}
        </div>
      </div>
    </div>
  )
}
