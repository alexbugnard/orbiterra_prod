'use client'

import { useState } from 'react'

export function SyncButton() {
  const [state, setState] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<string | null>(null)

  async function runSync() {
    setState('syncing')
    setResult(null)
    try {
      const res = await fetch('/api/sync')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Sync failed')
      setResult(`${data.upserted ?? 0} rides synced`)
      setState('done')
      setTimeout(() => setState('idle'), 4000)
    } catch (err) {
      setResult(String(err))
      setState('error')
      setTimeout(() => setState('idle'), 5000)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={runSync}
        disabled={state === 'syncing'}
        className="text-sm px-4 py-2 rounded-lg font-medium border border-cyan-700 text-cyan-400 hover:bg-cyan-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {state === 'syncing' ? 'Syncing…' : 'Sync Strava'}
      </button>
      {result && (
        <span className={`text-xs ${state === 'error' ? 'text-red-400' : 'text-slate-400'}`}>
          {result}
        </span>
      )}
    </div>
  )
}
