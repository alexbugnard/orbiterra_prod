import { buildFlickrPhotoUrl, parseFlickrPhoto } from '@/lib/flickr'

describe('buildFlickrPhotoUrl', () => {
  it('builds a large photo URL from Flickr photo fields', () => {
    const url = buildFlickrPhotoUrl({
      farm: 1,
      server: '123',
      id: '456',
      secret: 'abc',
    })
    expect(url).toBe('https://farm1.staticflickr.com/123/456_abc_b.jpg')
  })
})

describe('parseFlickrPhoto', () => {
  it('returns null for a photo with no location', () => {
    const raw = { id: '1', title: { _content: 'test' }, datetaken: '2024-01-01 10:00:00', farm: 1, server: '1', secret: 'x' }
    const result = parseFlickrPhoto(raw, null)
    expect(result).toBeNull()
  })

  it('parses a photo with valid location', () => {
    const raw = {
      id: '1',
      title: { _content: 'Summit' },
      datetaken: '2024-06-01 09:30:00',
      farm: 1,
      server: '123',
      secret: 'abc',
    }
    const location = { latitude: '48.8566', longitude: '2.3522' }
    const result = parseFlickrPhoto(raw, location)
    expect(result).not.toBeNull()
    expect(result!.flickr_id).toBe('1')
    expect(result!.lat).toBe(48.8566)
    expect(result!.lng).toBe(2.3522)
    expect(result!.title).toBe('Summit')
  })
})
