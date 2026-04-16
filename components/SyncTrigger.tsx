'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function SyncTrigger() {
  const router = useRouter()

  useEffect(() => {
    fetch('/api/sync', { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (data.synced && data.upserted > 0) {
          // New rides found — refresh the page data
          router.refresh()
        }
      })
      .catch(() => {}) // silent fail — sync is best-effort
  }, [])

  return null
}
