import { createSupabaseClient } from '@/lib/supabase'
import { TripEditor } from './TripEditor'
import Link from 'next/link'

async function getTrips() {
  const supabase = createSupabaseClient()
  const { data } = await supabase
    .from('trips')
    .select('id, name, start_date, distance_m, visible, journal_fr, journal_en')
    .order('start_date', { ascending: false })
  return data ?? []
}

export default async function AdminPage() {
  const trips = await getTrips()

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Admin — Trips</h1>
        <div className="flex gap-3">
          <Link href="/admin/site-content" className="text-sm text-blue-600 hover:underline">
            Edit site content →
          </Link>
          <Link href="/admin/connect-strava" className="text-sm text-orange-600 hover:underline">
            Connect Strava →
          </Link>
        </div>
      </div>
      <div className="space-y-4">
        {trips.length === 0 && (
          <p className="text-gray-500">No trips yet. Connect Strava and run the sync.</p>
        )}
        {trips.map((trip: any) => (
          <TripEditor key={trip.id} trip={trip} />
        ))}
      </div>
    </div>
  )
}
