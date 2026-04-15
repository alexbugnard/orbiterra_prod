import { verifyCronSecret } from '@/app/api/cron/strava/route'

describe('verifyCronSecret', () => {
  it('returns true when Authorization header matches CRON_SECRET', () => {
    process.env.CRON_SECRET = 'my-secret'
    const headers = new Headers({ Authorization: 'Bearer my-secret' })
    expect(verifyCronSecret(headers)).toBe(true)
  })

  it('returns false when Authorization header does not match', () => {
    process.env.CRON_SECRET = 'my-secret'
    const headers = new Headers({ Authorization: 'Bearer wrong' })
    expect(verifyCronSecret(headers)).toBe(false)
  })

  it('returns false when Authorization header is missing', () => {
    process.env.CRON_SECRET = 'my-secret'
    const headers = new Headers()
    expect(verifyCronSecret(headers)).toBe(false)
  })
})
