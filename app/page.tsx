import { createSupabaseClient } from '@/lib/supabase'
import { getTranslations, getLocale } from 'next-intl/server'
import Link from 'next/link'
import Image from 'next/image'

async function getSiteContent(): Promise<Record<string, string>> {
  const supabase = createSupabaseClient()
  const { data } = await supabase.from('site_content').select('key, value')
  return Object.fromEntries((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]))
}

async function getStats() {
  const supabase = createSupabaseClient()
  const { data: trips } = await supabase
    .from('trips')
    .select('distance_m')
    .eq('visible', true)

  const totalDistance = (trips ?? []).reduce((sum, t) => sum + (t.distance_m ?? 0), 0)
  const totalKm = Math.round(totalDistance / 1000)
  const rideCount = (trips ?? []).length

  return { totalKm, rideCount }
}

export default async function LandingPage() {
  const t = await getTranslations('landing')
  const content = await getSiteContent()
  const locale = await getLocale()
  const { totalKm, rideCount } = await getStats()

  const description = locale === 'fr'
    ? content.description_fr
    : content.description_en

  return (
    <main className="min-h-[calc(100vh-57px)] flex flex-col bg-slate-900">
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

        {/* Content */}
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium px-4 py-1.5 rounded-full mb-8">
            <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse" />
            Alaska → Ushuaia
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

          <Link
            href="/map"
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:-translate-y-0.5"
          >
            {t('cta')}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </Link>
        </div>
      </div>

      {/* Stats bar */}
      {rideCount > 0 && (
        <div className="border-t border-slate-800 bg-slate-900/80">
          <div className="max-w-2xl mx-auto px-6 py-8 grid grid-cols-2 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-white">{totalKm.toLocaleString()}</div>
              <div className="text-sm text-slate-500 mt-1">km ridden</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-white">{rideCount}</div>
              <div className="text-sm text-slate-500 mt-1">rides tracked</div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
