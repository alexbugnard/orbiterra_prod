import { matchPhotoToTrip } from '@/lib/trip-match'

const trips = [
  {
    id: 'trip-1',
    start_date: '2024-06-01T08:00:00Z',
    end_date: '2024-06-01T10:00:00Z',
  },
  {
    id: 'trip-2',
    start_date: '2024-06-02T09:00:00Z',
    end_date: '2024-06-02T12:00:00Z',
  },
]

describe('matchPhotoToTrip', () => {
  it('matches a photo taken during a trip', () => {
    const result = matchPhotoToTrip('2024-06-01T09:00:00Z', trips)
    expect(result).toBe('trip-1')
  })

  it('matches a photo at the exact start of a trip', () => {
    const result = matchPhotoToTrip('2024-06-01T08:00:00Z', trips)
    expect(result).toBe('trip-1')
  })

  it('returns null when photo is taken outside all trips', () => {
    const result = matchPhotoToTrip('2024-06-03T10:00:00Z', trips)
    expect(result).toBeNull()
  })

  it('returns null for empty trip list', () => {
    const result = matchPhotoToTrip('2024-06-01T09:00:00Z', [])
    expect(result).toBeNull()
  })
})
