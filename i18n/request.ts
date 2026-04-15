import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const locale = cookieStore.get('locale')?.value ?? 'fr'
  const validLocales = ['fr', 'en']
  const resolvedLocale = validLocales.includes(locale) ? locale : 'fr'

  return {
    locale: resolvedLocale,
    messages: (await import(`../messages/${resolvedLocale}.json`)).default,
  }
})
