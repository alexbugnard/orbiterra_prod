import { createSupabaseClient } from '@/lib/supabase'
import { TripEditor } from './TripEditor'
import { SyncButton } from './SyncButton'
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
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Trips</h1>
          <p className="text-sm text-slate-500 mt-0.5">{trips.length} rides in database</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin/site-content"
            className="text-sm text-slate-400 hover:text-white transition-colors px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-600"
          >
            Site content
          </Link>
          <SyncButton />
          <Link
            href="/admin/connect-strava"
            className="text-sm text-white bg-orange-500 hover:bg-orange-600 transition-colors px-4 py-2 rounded-lg font-medium"
          >
            Connect Strava
          </Link>
        </div>
      </div>

      <div className="space-y-3">
        {trips.length === 0 && (
          <div className="text-center py-12 text-slate-500 bg-slate-800/50 rounded-xl border border-slate-700 border-dashed">
            No trips yet. Connect Strava and run the sync.
          </div>
        )}
        {trips.map((trip: any) => (
          <TripEditor key={trip.id} trip={trip} />
        ))}
      </div>
    </div>
  )
}
