import { NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/supabase'
import { fetchFlickrPhotos } from '@/lib/flickr'
import { matchPhotoToTrip } from '@/lib/trip-match'
import { verifyCronSecret } from '@/app/api/cron/strava/route'

export async function POST(request: Request) {
  if (!verifyCronSecret(request.headers as unknown as Headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseClient()

  // Fetch all trip windows for timestamp matching
  const { data: trips } = await supabase
    .from('trips')
    .select('id, start_date, end_date')

  const tripWindows = (trips ?? []).map((t: any) => ({
    id: t.id as string,
    start_date: t.start_date as string,
    end_date: t.end_date as string,
  }))

  const photos = await fetchFlickrPhotos(
    process.env.FLICKR_USER_ID!,
    process.env.FLICKR_API_KEY!
  )

  let upserted = 0
  for (const photo of photos) {
    const tripId = matchPhotoToTrip(photo.taken_at.toISOString(), tripWindows)

    await supabase.from('waypoints').upsert({
      flickr_id: photo.flickr_id,
      trip_id: tripId,
      url_large: photo.url_large,
      title: photo.title,
      taken_at: photo.taken_at.toISOString(),
      lat: photo.lat,
      lng: photo.lng,
    }, { onConflict: 'flickr_id' })

    upserted++
  }

  return NextResponse.json({ upserted })
}
