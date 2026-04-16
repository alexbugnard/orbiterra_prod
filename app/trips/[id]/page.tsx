import { createSupabaseClient } from '@/lib/supabase'
import { getLocale } from 'next-intl/server'
import { TripViewClient } from '@/components/TripViewClient'
import { notFound } from 'next/navigation'

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createSupabaseClient()
  const locale = await getLocale()

  const { data: trip } = await supabase
    .from('trips')
    .select('id, name, start_date, end_date, distance_m, coordinates, visible, journal_fr, journal_en, elevation')
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
  }

  return (
    <TripViewClient
      trip={formattedTrip}
      waypoints={waypoints ?? []}
      locale={locale}
      distanceKm={distanceKm}
      date={date}
      journal={journal}
    />
  )
}
