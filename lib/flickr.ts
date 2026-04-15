const FLICKR_API = 'https://api.flickr.com/services/rest'

export interface FlickrPhoto {
  flickr_id: string
  url_large: string
  title: string
  taken_at: Date
  lat: number
  lng: number
}

export function buildFlickrPhotoUrl(photo: {
  farm: number
  server: string
  id: string
  secret: string
}): string {
  return `https://farm${photo.farm}.staticflickr.com/${photo.server}/${photo.id}_${photo.secret}_b.jpg`
}

export function parseFlickrPhoto(
  raw: {
    id: string
    title: { _content: string }
    datetaken: string
    farm: number
    server: string
    secret: string
  },
  location: { latitude: string; longitude: string } | null
): FlickrPhoto | null {
  if (!location) return null

  const lat = parseFloat(location.latitude)
  const lng = parseFloat(location.longitude)

  if (isNaN(lat) || isNaN(lng)) return null

  return {
    flickr_id: raw.id,
    url_large: buildFlickrPhotoUrl(raw),
    title: raw.title._content,
    taken_at: new Date(raw.datetaken.replace(' ', 'T') + 'Z'),
    lat,
    lng,
  }
}

export async function fetchFlickrPhotos(userId: string, apiKey: string): Promise<FlickrPhoto[]> {
  // Fetch photo list
  const listParams = new URLSearchParams({
    method: 'flickr.people.getPublicPhotos',
    api_key: apiKey,
    user_id: userId,
    extras: 'date_taken,geo',
    per_page: '500',
    format: 'json',
    nojsoncallback: '1',
  })

  const listRes = await fetch(`${FLICKR_API}?${listParams}`)
  if (!listRes.ok) throw new Error(`Flickr list fetch failed: ${listRes.status}`)
  const listData = await listRes.json()

  const rawPhotos: typeof listData.photos.photo = listData.photos?.photo ?? []
  const results: FlickrPhoto[] = []

  for (const raw of rawPhotos) {
    // Fetch location for each photo
    const geoParams = new URLSearchParams({
      method: 'flickr.photos.geo.getLocation',
      api_key: apiKey,
      photo_id: raw.id,
      format: 'json',
      nojsoncallback: '1',
    })

    const geoRes = await fetch(`${FLICKR_API}?${geoParams}`)
    if (!geoRes.ok) continue

    const geoData = await geoRes.json()
    const location = geoData.photo?.location ?? null

    const parsed = parseFlickrPhoto(raw, location)
    if (parsed) results.push(parsed)
  }

  return results
}
