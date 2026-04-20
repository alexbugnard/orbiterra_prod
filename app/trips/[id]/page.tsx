import { createSupabaseClient } from '@/lib/supabase'
import { getLocale, getTranslations } from 'next-intl/server'
import { TripViewClient } from '@/components/TripViewClient'
import { notFound } from 'next/navigation'

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createSupabaseClient()
  const locale = await getLocale()
  const t = await getTranslations('trip')

  const { data: trip } = await supabase
    .from('trips')
    .select('id, name, start_date, end_date, distance_m, coordinates, visible, journal_fr, journal_en, elevation, max_speed_ms, elev_high, breaks, max_speed_lat, max_speed_lng, elev_high_lat, elev_high_lng')
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
  const date = new Date(trip.start_date).toLocaleDateString(locale, {
    year: 'numeric', month: 'long', day: 'numeric'
  })

  const formattedTrip = {
    id: trip.id,
    name: trip.name,
    start_date: trip.start_date,
    distance_m: trip.distance_m,
    journal_fr: trip.journal_fr,
    journal_en: trip.journal_en,
    coordinates: trip.coordinates ?? [],
    elevation: (trip.elevation ?? null) as [number, number][] | null,
    start_lat: null,
    start_lng: null,
    max_speed_ms: (trip.max_speed_ms ?? null) as number | null,
    elev_high: (trip.elev_high ?? null) as number | null,
    breaks: (trip.breaks ?? null) as { lat: number; lng: number; duration_min: number; distance_m: number }[] | null,
    max_speed_lat: (trip.max_speed_lat ?? null) as number | null,
    max_speed_lng: (trip.max_speed_lng ?? null) as number | null,
    elev_high_lat: (trip.elev_high_lat ?? null) as number | null,
    elev_high_lng: (trip.elev_high_lng ?? null) as number | null,
  }

  return (
    <TripViewClient
      trip={formattedTrip}
      waypoints={waypoints ?? []}
      locale={locale}
      backLabel={t('backToMap')}
      distanceKm={distanceKm}
      date={date}
      journal={journal}
    />
  )
}
