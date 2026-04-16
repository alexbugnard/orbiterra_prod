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
            <nav className="flex items-center gap-4">
              <AboutButton label={t('about')} />
              <Link href="/map" className="text-sm text-slate-400 hover:text-white transition-colors">
                {t('map')}
              </Link>
              {/* Instagram */}
              <a
                href="https://www.instagram.com/vincentmorisetti/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-pink-400 transition-colors"
                aria-label="Instagram"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
              {/* Email */}
              <a
                href="mailto:alex.bubu19@gmail.com"
                className="text-slate-400 hover:text-orange-400 transition-colors"
                aria-label="Email"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </a>
              <LanguageSwitcher />
            </nav>
          </header>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
