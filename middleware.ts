import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Simple in-memory rate limiter for login attempts.
// Limits to 10 attempts per IP per 15-minute window.
// Note: resets on cold start (serverless), but provides meaningful protection
// against sustained brute-force attacks on warm instances.
const attempts = new Map<string, { count: number; resetAt: number }>()

const MAX_ATTEMPTS = 10
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes

export function middleware(request: NextRequest) {
  if (
    request.method === 'POST' &&
    request.nextUrl.pathname === '/api/auth/callback/credentials'
  ) {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      request.headers.get('x-real-ip') ??
      'unknown'

    const now = Date.now()
    const entry = attempts.get(ip)

    if (entry && now < entry.resetAt) {
      if (entry.count >= MAX_ATTEMPTS) {
        return NextResponse.json(
          { error: 'Too many login attempts. Try again in 15 minutes.' },
          { status: 429 }
        )
      }
      entry.count++
    } else {
      attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    }

    // Prune old entries to prevent memory leak
    if (attempts.size > 10_000) {
      for (const [key, val] of attempts) {
        if (now >= val.resetAt) attempts.delete(key)
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/auth/callback/credentials',
}
