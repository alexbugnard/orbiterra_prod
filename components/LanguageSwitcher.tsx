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
    <div className="flex items-center gap-1 text-sm bg-slate-800 rounded-lg p-1">
      <button
        onClick={() => switchLocale('fr')}
        className={`px-2.5 py-1 rounded-md font-medium transition-all ${
          locale === 'fr'
            ? 'bg-slate-700 text-white'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        FR
      </button>
      <button
        onClick={() => switchLocale('en')}
        className={`px-2.5 py-1 rounded-md font-medium transition-all ${
          locale === 'en'
            ? 'bg-slate-700 text-white'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        EN
      </button>
    </div>
  )
}
