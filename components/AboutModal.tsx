'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import { BikeSetup } from './BikeSetup'
import { APP_VERSION } from '@/lib/version'

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
  const [tab, setTab] = useState<'about' | 'guide' | 'setup'>('about')

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
        className="relative flex flex-col overflow-hidden w-[95vw] h-[92vh] rounded-2xl md:w-4/5 md:h-4/5"
        style={{
          background: 'rgba(15,23,42,0.97)',
          border: '1px solid rgba(51,65,85,0.8)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-700/50 flex-shrink-0">
          <div className="flex items-center gap-1 bg-slate-800/60 rounded-xl p-1">
            {(['about', 'guide', 'setup'] as const).map((t2) => (
              <button
                key={t2}
                onClick={() => setTab(t2)}
                className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: tab === t2 ? 'rgba(249,115,22,0.15)' : 'transparent',
                  color: tab === t2 ? '#f97316' : '#94a3b8',
                  border: tab === t2 ? '1px solid rgba(249,115,22,0.3)' : '1px solid transparent',
                }}
              >
                {t2 === 'about' ? t('title') : t2 === 'guide' ? t('guideTab') : 'Setup'}
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Guide tab */}
        {tab === 'guide' && (
          <div className="flex-1 overflow-y-auto px-8 py-8 space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">{t('guideTitle')}</h3>
              <p className="text-slate-300 leading-relaxed">{t('guideIntro')}</p>
            </div>

            <div className="border-t border-slate-700/50" />

            <div>
              <h4 className="text-base font-semibold text-orange-400 mb-4">{t('guideSectionMapTitle')}</h4>
              <div className="space-y-4">
                {([
                  'guideSectionMapRides',
                  'guideSectionMapRoute',
                  'guideSectionMapPhotos',
                  'guideSectionMapWeather',
                  'guideSectionMapCities',
                  'guideSectionMapBasemap',
                  'guideSectionMapPosition',
                ] as const).map((key) => (
                  <div key={key} className="flex gap-3">
                    <div className="mt-1 w-1.5 h-1.5 rounded-full bg-orange-500/60 flex-shrink-0" />
                    <p className="text-slate-300 leading-relaxed text-sm">{t(key)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-700/50" />

            <div>
              <h4 className="text-base font-semibold text-orange-400 mb-4">{t('guideSectionDataTitle')}</h4>
              <div className="space-y-4">
                {([
                  ['Strava / Flickr', 'guideSectionDataStrava'],
                  ['Flickr', 'guideSectionDataFlickr'],
                  ['YouTube', 'guideSectionDataYoutube'],
                  ['Open-Meteo', 'guideSectionDataWeather'],
                  ['Wikipedia', 'guideSectionDataWiki'],
                ] as const).map(([label, key]) => (
                  <div key={key} className="flex gap-3">
                    <span className="mt-0.5 text-xs font-semibold text-slate-500 w-28 flex-shrink-0">{label}</span>
                    <p className="text-slate-300 leading-relaxed text-sm">{t(key)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-700/50" />

            <div>
              <h4 className="text-base font-semibold text-orange-400 mb-2">{t('guideSectionFreshnessTitle')}</h4>
              <p className="text-slate-300 leading-relaxed text-sm">{t('guideSectionFreshnessText')}</p>
            </div>

            <div className="border-t border-slate-700/50" />

            <div>
              <h4 className="text-base font-semibold text-orange-400 mb-2">{t('guideSectionSuggestTitle')}</h4>
              <p className="text-slate-300 leading-relaxed text-sm mb-3">{t('guideSectionSuggestText')}</p>
              <a
                href="mailto:alex.bubu19@gmail.com?subject=Suggestion%20orbiterra.ch"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-slate-700 text-slate-300 hover:border-orange-500 hover:text-orange-400 transition-colors"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                alex.bubu19@gmail.com
              </a>
            </div>
          </div>
        )}

        {/* Setup tab */}
        {tab === 'setup' && (
          <div className="flex-1 overflow-y-auto px-8 py-8">
            <BikeSetup />
          </div>
        )}

        {/* About tab content */}
        {tab === 'about' && (
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
            <p className="text-slate-300 leading-relaxed mb-6">{t('vincentText')}</p>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: t('stat1Label'), value: t('stat1Value') },
                { label: t('stat2Label'), value: t('stat2Value') },
                { label: t('stat3Label'), value: t('stat3Value') },
                { label: t('stat4Label'), value: t('stat4Value') },
              ].map((s, i) => (
                <div key={i} className="rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-center">
                  <div className="text-orange-400 font-bold text-sm">{s.value}</div>
                  <div className="text-slate-500 text-xs mt-0.5 leading-tight">{s.label}</div>
                </div>
              ))}
            </div>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { name: 'RAB', sub: 'Equipment', url: 'https://rab.equipment', logo: '/sponsors/rab-logo.png' },
                { name: 'JULBO', sub: 'Eyewear', url: 'https://www.julbo.com', logo: '/sponsors/julbo-logo.svg' },
                { name: 'SWIZA', sub: 'Couteaux', url: 'https://www.swiza.com', logo: '/sponsors/swiza-logo.svg' },
                { name: 'GripGrab', sub: 'Habits vélo', url: 'https://www.gripgrab.com', logo: '/sponsors/gripgrab-logo.png' },
                { name: 'ICON OUTDOOR', sub: '', url: 'https://icon-outdoor.ch/', logo: '/sponsors/icon-outdoor-logo.webp' },
                { name: 'bücher&walt', sub: '', url: 'https://www.bucher-walt.ch', logo: '/sponsors/bucherwalt-logo.png' },
              ].map((s) => (
                <a
                  key={s.name}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-16 px-4 rounded-xl border border-slate-700 bg-slate-800/60 flex items-center justify-center hover:border-orange-500/50 hover:bg-slate-800 transition-colors"
                >
                  {s.logo ? (
                    <img src={s.logo} alt={s.name} className="h-8 w-auto" />
                  ) : (
                    <div className="text-center">
                      <div className="text-white font-bold text-sm leading-tight">{s.name}</div>
                      {s.sub && <div className="text-slate-500 text-xs mt-0.5">{s.sub}</div>}
                    </div>
                  )}
                </a>
              ))}
            </div>
          </section>
        </div>
        )}

        {/* Footer */}
        <div className="px-4 py-4 border-t border-slate-700/50 flex-shrink-0 flex flex-wrap items-center justify-between gap-3 md:px-8">
          <div className="flex items-center gap-3">
            {/* Instagram */}
            <a
              href="https://www.instagram.com/vincentmorisetti/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-slate-700 text-slate-300 hover:border-pink-500 hover:text-pink-400 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
              @vincentmorisetti
            </a>
            {/* Email */}
            <a
              href="mailto:alex.bubu19@gmail.com"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-slate-700 text-slate-300 hover:border-orange-500 hover:text-orange-400 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              Contact
            </a>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-600">v{APP_VERSION}</span>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-sm font-medium bg-slate-700 hover:bg-slate-600 text-white transition-colors"
            >
              {t('close')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
