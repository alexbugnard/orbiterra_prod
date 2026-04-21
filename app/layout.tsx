import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { AboutButton } from '@/components/AboutButton'
import { SocialLinks } from '@/components/SocialLinks'
import Link from 'next/link'
import Image from 'next/image'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages, getTranslations } from 'next-intl/server'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'OrbiTerra',
  description: 'Alaska → Ushuaia — suivez le voyage de Vincent en temps réel',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()
  const t = await getTranslations('nav')

  return (
    <html lang={locale}>
      <body className={inter.className}>
        <NextIntlClientProvider messages={messages}>
          <header className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-slate-800 bg-slate-900/95 backdrop-blur-sm sticky top-0 z-50">
            <Link href="/" className="flex items-center gap-2 font-bold text-white text-lg tracking-tight">
              <Image src="/logo/Capture d'écran 2026-04-20 085244.png" alt="OrbiTerra" width={36} height={36} className="rounded-full bg-white p-0.5 object-contain" loading="eager" priority />
              <span>Orbi<span className="text-orange-400">Terra</span></span>
            </Link>
            <nav className="flex items-center gap-3 md:gap-4">
              <AboutButton label={t('about')} />
              <SocialLinks />
              <LanguageSwitcher />
            </nav>
          </header>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
