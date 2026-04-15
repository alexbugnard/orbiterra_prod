import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createSupabaseClient } from '@/lib/supabase'

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: Record<string, string> = await request.json()
  const allowedKeys = ['title', 'description_fr', 'description_en', 'hero_image_url']

  const supabase = createSupabaseClient()

  for (const [key, value] of Object.entries(body)) {
    if (!allowedKeys.includes(key)) continue
    await supabase
      .from('site_content')
      .upsert({ key, value }, { onConflict: 'key' })
  }

  return NextResponse.json({ ok: true })
}
