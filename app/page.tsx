import { createSupabaseClient } from '@/lib/supabase'
import { getTranslations, getLocale } from 'next-intl/server'
import Link from 'next/link'
import Image from 'next/image'

async function getSiteContent(): Promise<Record<string, string>> {
  const supabase = createSupabaseClient()
  const { data } = await supabase.from('site_content').select('key, value')
  return Object.fromEntries((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]))
}

export default async function LandingPage() {
  const t = await getTranslations('landing')
  const content = await getSiteContent()
  const locale = await getLocale()

  const description = locale === 'fr'
    ? content.description_fr
    : content.description_en

  return (
    <main className="min-h-screen flex flex-col">
      {content.hero_image_url && (
        <div className="relative w-full h-64 md:h-96">
          <Image
            src={content.hero_image_url}
            alt={content.title}
            fill
            className="object-cover"
          />
        </div>
      )}
      <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 text-center">
        <h1 className="text-4xl font-bold mb-4 text-gray-900">{content.title}</h1>
        <p className="text-lg text-gray-600 max-w-xl mb-8">{description}</p>
        <Link
          href="/map"
          className="bg-gray-900 text-white px-8 py-3 rounded-lg font-semibold hover:bg-gray-700 transition"
        >
          {t('cta')}
        </Link>
      </div>
    </main>
  )
}
