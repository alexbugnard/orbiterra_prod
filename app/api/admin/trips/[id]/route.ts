import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createSupabaseClient } from '@/lib/supabase'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const allowed = ['name', 'visible', 'journal_fr', 'journal_en']
  const update = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  )

  const supabase = createSupabaseClient()
  const { error } = await supabase.from('trips').update(update).eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
