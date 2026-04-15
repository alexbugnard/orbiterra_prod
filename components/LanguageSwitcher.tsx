'use client'

import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'

export function LanguageSwitcher() {
  const locale = useLocale()
  const router = useRouter()

  async function switchLocale(next: string) {
    await fetch('/api/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: next }),
    })
    router.refresh()
  }

  return (
    <div className="flex gap-2 text-sm">
      <button
        onClick={() => switchLocale('fr')}
        className={locale === 'fr' ? 'font-bold underline' : 'text-gray-500 hover:text-gray-800'}
      >
        FR
      </button>
      <span className="text-gray-300">|</span>
      <button
        onClick={() => switchLocale('en')}
        className={locale === 'en' ? 'font-bold underline' : 'text-gray-500 hover:text-gray-800'}
      >
        EN
      </button>
    </div>
  )
}
