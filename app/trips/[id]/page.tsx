import { createSupabaseClient } from '@/lib/supabase'
import { getLocale, getTranslations } from 'next-intl/server'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { notFound } from 'next/navigation'

const Map = dynamic(() => import('@/components/Map').then((m) => m.Map), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center text-gray-400">Loading map...</div>,
})

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createSupabaseClient()
  const locale = await getLocale()
  const t = await getTranslations('trip')

  const { data: trip } = await supabase
    .from('trips')
    .select('*')
    .eq('id', id)
    .eq('visible', true)
    .single()

  if (!trip) notFound()

  const { data: waypoints } = await supabase
    .from('waypoints')
    .select('id, lat, lng, url_large, title')
    .eq('trip_id', id)

  const journal = locale === 'fr' ? trip.journal_fr : trip.journal_en
  const distanceKm = (trip.distance_m / 1000).toFixed(1)
  const formattedTrip = {
    id: trip.id,
    name: trip.name,
    start_date: trip.start_date,
    distance_m: trip.distance_m,
    journal_fr: trip.journal_fr,
    journal_en: trip.journal_en,
    coordinates: trip.path?.coordinates ?? [],
  }

  return (
    <div className="flex flex-col h-[calc(100vh-57px)]">
      <div className="px-6 py-4 border-b bg-white">
        <Link href="/map" className="text-sm text-gray-500 hover:text-gray-800 mb-2 inline-block">
          {t('backToMap')}
        </Link>
        <h1 className="text-xl font-bold">{trip.name}</h1>
        <p className="text-sm text-gray-500">
          {new Date(trip.start_date).toLocaleDateString(locale)} · {distanceKm} km
        </p>
        {journal && <p className="mt-2 text-gray-700">{journal}</p>}
      </div>
      <div className="flex-1">
        <Map trips={[formattedTrip]} waypoints={waypoints ?? []} locale={locale} />
      </div>
    </div>
  )
}
