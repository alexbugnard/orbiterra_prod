import { createSupabaseClient } from '@/lib/supabase'
import { SiteContentEditor } from './SiteContentEditor'
import Link from 'next/link'

async function getSiteContent(): Promise<Record<string, string>> {
  const supabase = createSupabaseClient()
  const { data } = await supabase.from('site_content').select('key, value')
  return Object.fromEntries((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]))
}

export default async function SiteContentPage() {
  const content = await getSiteContent()

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-800">← Back</Link>
        <h1 className="text-2xl font-bold">Site Content</h1>
      </div>
      <SiteContentEditor content={content} />
    </div>
  )
}
