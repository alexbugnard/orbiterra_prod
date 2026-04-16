import { verifyCronSecret } from '@/app/api/cron/strava/route'

describe('verifyCronSecret (reused in weather cron)', () => {
  it('returns true for a matching Bearer token', () => {
    process.env.CRON_SECRET = 'test-secret'
    const headers = new Headers({ Authorization: 'Bearer test-secret' })
    expect(verifyCronSecret(headers)).toBe(true)
  })

  it('returns false for a mismatched token', () => {
    process.env.CRON_SECRET = 'test-secret'
    const headers = new Headers({ Authorization: 'Bearer wrong' })
    expect(verifyCronSecret(headers)).toBe(false)
  })
})
