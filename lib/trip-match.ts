interface TripWindow {
  id: string
  start_date: string
  end_date: string
}

export function matchPhotoToTrip(
  takenAt: string,
  trips: TripWindow[]
): string | null {
  const photoTime = new Date(takenAt).getTime()

  for (const trip of trips) {
    const start = new Date(trip.start_date).getTime()
    const end = new Date(trip.end_date).getTime()
    if (photoTime >= start && photoTime <= end) {
      return trip.id
    }
  }

  return null
}
