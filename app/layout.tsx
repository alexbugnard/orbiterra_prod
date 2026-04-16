import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { AboutButton } from '@/components/AboutButton'
import Link from 'next/link'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages, getTranslations } from 'next-intl/server'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'BikeTrip',
  description: 'Cycling journey tracker with interactive maps',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()
  const t = await getTranslations('nav')

  return (
    <html lang={locale}>
      <body className={inter.className}>
        <NextIntlClientProvider messages={messages}>
          <header className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-900/95 backdrop-blur-sm sticky top-0 z-50">
            <Link href="/" className="flex items-center gap-2 font-bold text-white text-lg tracking-tight">
              <span className="text-orange-500">⬡</span>
              BikeTrip
            </Link>
            <nav className="flex items-center gap-6">
              <AboutButton label={t('about')} />
              <Link href="/map" className="text-sm text-slate-400 hover:text-white transition-colors">
                {t('map')}
              </Link>
              <LanguageSwitcher />
            </nav>
          </header>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
