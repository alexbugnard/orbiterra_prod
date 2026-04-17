import { createSupabaseClient } from '@/lib/supabase'
import { MapClient } from '@/components/MapClient'

async function getMapData() {
  const supabase = createSupabaseClient()

  const { data: trips } = await supabase
    .from('trips')
    .select('id, name, start_date, distance_m, path, journal_fr, journal_en')
    .eq('visible', true)
    .order('start_date', { ascending: true })

  const { data: waypoints } = await supabase
    .from('waypoints')
    .select('id, lat, lng, url_large, title')

  const formattedTrips = (trips ?? []).map((t: any) => ({
    id: t.id,
    name: t.name,
    start_date: t.start_date,
    distance_m: t.distance_m,
    journal_fr: t.journal_fr,
    journal_en: t.journal_en,
    coordinates: t.path?.coordinates ?? [],
  }))

  return { trips: formattedTrips, waypoints: waypoints ?? [] }
}

export default async function MapPage() {
  const { trips, waypoints } = await getMapData()

  return (
    <div style={{ height: '100vh' }}>
      <MapClient trips={trips} waypoints={waypoints} locale="fr" />
    </div>
  )
}
