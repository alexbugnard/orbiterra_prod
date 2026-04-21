import { createSupabaseClient } from '@/lib/supabase'
import { getTranslations, getLocale } from 'next-intl/server'
import Link from 'next/link'
import Image from 'next/image'
import { GlobeMap } from '@/components/GlobeMap'
import { CountUp } from '@/components/CountUp'
import { AnimatedLogo, AnimatedButton } from '@/components/HeroAnimated'

async function getSiteContent(): Promise<Record<string, string>> {
  const supabase = createSupabaseClient()
  const { data } = await supabase.from('site_content').select('key, value')
  return Object.fromEntries((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]))
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function routeKm(coords: [number, number][]) {
  let d = 0
  for (let i = 1; i < coords.length; i++) d += haversineKm(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0])
  return d
}

// Sample coords to at most maxPts points, keeping first and last
function sample(coords: [number, number][], maxPts: number): [number, number][] {
  if (coords.length <= maxPts) return coords
  const step = (coords.length - 1) / (maxPts - 1)
  return Array.from({ length: maxPts }, (_, i) => coords[Math.round(i * step)])
}

async function getStats() {
  const supabase = createSupabaseClient()

  const [{ data: trips }, { data: routes }] = await Promise.all([
    supabase.from('trips').select('distance_m, coordinates').eq('visible', true),
    supabase.from('planned_routes').select('coordinates').limit(1),
  ])

  const totalDistance = (trips ?? []).reduce((sum, t) => sum + (t.distance_m ?? 0), 0)
  const totalKm = Math.round(totalDistance / 1000)
  const rideCount = (trips ?? []).length

  const planned = routes?.[0]?.coordinates as [number, number][] | undefined

  let progress: { pct: number; kmLeft: number; totalKm: number } | null = null
  // sampled coords for the SVG map (300 pts) + cutoff index in that sampled array
  let routeCoords: [number, number][] = []
  let riddenCutoff = 0

  if (planned && planned.length > 1) {
    // Grid-based ridden mask (same approach as Map.tsx) — O(trips×coords + planned×9)
    const CELL = 0.15 // ~16 km cells, coarser than map but fine for progress detection
    const occupied = new Set<string>()
    for (const trip of trips ?? []) {
      const coords = trip.coordinates as [number, number][] | null
      if (!coords) continue
      for (const [lng, lat] of coords) {
        occupied.add(`${Math.floor(lat / CELL)},${Math.floor(lng / CELL)}`)
      }
    }

    let maxIndex = 0
    for (let pi = 0; pi < planned.length; pi++) {
      const [pLng, pLat] = planned[pi]
      const cr = Math.floor(pLat / CELL)
      const cc = Math.floor(pLng / CELL)
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (occupied.has(`${cr + dr},${cc + dc}`)) { maxIndex = pi; break }
        }
      }
    }

    if (maxIndex > 0) {
      const totalRouteKm = routeKm(planned)
      const doneKm = routeKm(planned.slice(0, maxIndex + 1))
      const pct = Math.min(100, (doneKm / totalRouteKm) * 100)
      progress = { pct: Math.round(pct * 10) / 10, kmLeft: Math.round(totalRouteKm - doneKm), totalKm: Math.round(totalRouteKm) }
    }

    // Sample full route to 400 pts for SVG
    const SAMPLE_PTS = 400
    routeCoords = sample(planned, SAMPLE_PTS)
    // Map maxIndex (in full array) → index in sampled array
    riddenCutoff = maxIndex > 0 ? Math.round((maxIndex / (planned.length - 1)) * (SAMPLE_PTS - 1)) : 0
  }

  return { totalKm, rideCount, progress, routeCoords, riddenCutoff }
}

export default async function LandingPage() {
  const t = await getTranslations('landing')
  const content = await getSiteContent()
  const locale = await getLocale()
  const { totalKm, rideCount, progress, routeCoords, riddenCutoff } = await getStats()

  const description = locale === 'fr'
    ? content.description_fr
    : content.description_en

  return (
    <main className="relative min-h-[calc(100vh-57px)] flex flex-col bg-slate-900">

      {/* Globe — absolute right, vertically centered, full page height */}
      {routeCoords.length > 1 && (
        <div className="absolute hidden md:flex top-0 bottom-0 z-10 items-center pointer-events-none" style={{ right: '126px', marginTop: '-130px' }}>
          <div className="w-[min(38vh,340px)] aspect-square opacity-90">
            <GlobeMap coords={routeCoords} riddenCutoff={riddenCutoff} />
          </div>
        </div>
      )}

      {/* Hero */}
      <div className="relative flex flex-col items-center justify-center flex-1 px-6 py-24 text-center overflow-hidden">
        {/* Background image */}
        <Image
          src="/image_landing_page.png"
          alt=""
          fill
          priority
          className="object-cover"
        />
        {/* Dark overlay so text stays readable */}
        <div className="absolute inset-0 bg-slate-900/60" />

        {/* Content — centered as before */}
        <div className="relative z-10 max-w-2xl">
          <div className="mb-8">
            <AnimatedLogo>
              <Image
                src="/logo/Capture d'écran 2026-04-20 085244.png"
                alt="OrbiTerra"
                width={192}
                height={192}
                className="mx-auto rounded-full bg-white/90 p-2 shadow-xl"
                loading="eager"
                priority
              />
            </AnimatedLogo>
          </div>

          <h1 className="text-5xl md:text-6xl font-extrabold text-white mb-4 leading-tight tracking-tight">
            Orbi<span className="text-orange-400">Terra</span>
          </h1>

          <p className="text-xl text-slate-300 font-medium mb-4">
            {content.title || 'Le voyage de Vincent'}
          </p>

          <p className="text-lg text-slate-400 max-w-xl mx-auto mb-10 leading-relaxed">
            {description || 'Follow my bike trips around the world, with photos and route details.'}
          </p>

          <AnimatedButton>
            <Link
              href="/map"
              className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:-translate-y-0.5"
            >
              {t('cta')}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </Link>
          </AnimatedButton>
        </div>
      </div>

      {/* Route map + stats */}
      {rideCount > 0 && (
        <div className="border-t border-slate-800 bg-slate-900/80">
          <div className="max-w-2xl mx-auto px-6 py-8">
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-8 text-center">
                <div>
                  <div className="text-3xl font-bold text-white"><CountUp value={totalKm} /></div>
                  <div className="text-sm text-slate-500 mt-1">{t('kmRidden')}</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-white"><CountUp value={rideCount} duration={1400} /></div>
                  <div className="text-sm text-slate-500 mt-1">{t('ridesTracked')}</div>
                </div>
              </div>

              {progress && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-500 uppercase tracking-wider">{t('routeProgress')}</span>
                    <span className="text-sm font-bold text-cyan-400">{progress.pct}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-orange-500 to-cyan-400"
                      style={{ width: `${progress.pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-slate-500">
                    <span>Prudhoe Bay</span>
                    <span>{progress.kmLeft.toLocaleString()} km {t('remaining')}</span>
                    <span>Ushuaia</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
