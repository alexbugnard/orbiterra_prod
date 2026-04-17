import { buildStravaAuthUrl, parseTokenResponse } from '@/lib/strava'

describe('buildStravaAuthUrl', () => {
  it('returns a valid Strava authorization URL', () => {
    process.env.STRAVA_CLIENT_ID = 'test-client-id'
    const url = buildStravaAuthUrl('http://localhost:3000/admin/connect-strava/callback')
    expect(url).toContain('https://www.strava.com/oauth/authorize')
    expect(url).toContain('scope=activity%3Aread_all')
    expect(url).toContain('redirect_uri=')
  })
})

describe('parseTokenResponse', () => {
  it('extracts access_token, refresh_token, and expires_at from Strava response', () => {
    const raw = {
      access_token: 'abc',
      refresh_token: 'def',
      expires_at: 1700000000,
    }
    const result = parseTokenResponse(raw)
    expect(result.access_token).toBe('abc')
    expect(result.refresh_token).toBe('def')
    expect(result.expires_at).toBeInstanceOf(Date)
  })
})
