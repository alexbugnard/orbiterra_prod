import { createSupabaseClient } from '@/lib/supabase'

describe('createSupabaseClient', () => {
  it('returns a supabase client object with from method', () => {
    process.env.SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_KEY = 'test-key'
    const client = createSupabaseClient()
    expect(client).toBeDefined()
    expect(typeof client.from).toBe('function')
  })
})
