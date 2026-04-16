'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'

interface Video {
  id: string
  youtube_id: string
  title: string
}

interface AboutModalProps {
  onClose: () => void
}

export function AboutModal({ onClose }: AboutModalProps) {
  const t = useTranslations('about')
  const [videos, setVideos] = useState<Video[]>([])
  const [activeVideo, setActiveVideo] = useState<string | null>(null)

  // Load videos
  useEffect(() => {
    fetch('/api/videos')
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setVideos(data))
      .catch(() => {})
  }, [])

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (activeVideo) setActiveVideo(null)
        else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, activeVideo])

  return createPortal(
    /* Backdrop */
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      {/* Modal */}
      <div
        className="relative flex flex-col rounded-2xl overflow-hidden"
        style={{
          width: '80%',
          height: '80%',
          background: 'rgba(15,23,42,0.97)',
          border: '1px solid rgba(51,65,85,0.8)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-700/50 flex-shrink-0">
          <h2 className="text-xl font-bold text-white">{t('title')}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-8 py-8 space-y-10">

          {/* Goal */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-base">🎯</div>
              <h3 className="text-lg font-semibold text-white">{t('goalTitle')}</h3>
            </div>
            <p className="text-slate-300 leading-relaxed">{t('goalText')}</p>
          </section>

          <div className="border-t border-slate-700/50" />

          {/* Vincent */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-base">🚴</div>
              <h3 className="text-lg font-semibold text-white">{t('vincentTitle')}</h3>
            </div>
            <p className="text-slate-300 leading-relaxed">{t('vincentText')}</p>
          </section>

          <div className="border-t border-slate-700/50" />

          {/* Videos */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-base">▶️</div>
              <h3 className="text-lg font-semibold text-white">{t('videosTitle')}</h3>
            </div>

            {videos.length === 0 ? (
              <p className="text-slate-500 text-sm italic">{t('videosEmpty')}</p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {videos.map((video) => (
                  <div key={video.id} className="rounded-xl overflow-hidden border border-slate-700 bg-slate-800/50">
                    {activeVideo === video.youtube_id ? (
                      <iframe
                        src={`https://www.youtube-nocookie.com/embed/${video.youtube_id}?autoplay=1`}
                        title={video.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="w-full aspect-video"
                      />
                    ) : (
                      <button
                        className="relative w-full group"
                        onClick={() => setActiveVideo(video.youtube_id)}
                      >
                        {/* Thumbnail */}
                        <img
                          src={`https://img.youtube.com/vi/${video.youtube_id}/hqdefault.jpg`}
                          alt={video.title}
                          className="w-full aspect-video object-cover"
                        />
                        {/* Play overlay */}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors">
                          <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                              <polygon points="5,3 19,12 5,21"/>
                            </svg>
                          </div>
                        </div>
                      </button>
                    )}
                    <div className="px-3 py-2 text-sm text-slate-300 font-medium truncate">{video.title}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="border-t border-slate-700/50" />

          {/* Sponsors */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-base">🤝</div>
              <h3 className="text-lg font-semibold text-white">{t('sponsorsTitle')}</h3>
            </div>
            <p className="text-slate-300 leading-relaxed mb-6">{t('sponsorsText')}</p>

            {/* Sponsor logos */}
            <div className="flex flex-wrap gap-4">
              <a
                href="https://rab.equipment"
                target="_blank"
                rel="noopener noreferrer"
                className="h-16 px-6 rounded-xl border border-slate-700 bg-white flex items-center justify-center hover:border-slate-500 transition-colors"
              >
                <img
                  src="/sponsors/rab-logo.svg"
                  alt="RAB Equipment"
                  className="h-8 w-auto"
                />
              </a>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-slate-700/50 flex-shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm font-medium bg-slate-700 hover:bg-slate-600 text-white transition-colors"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
