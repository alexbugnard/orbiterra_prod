'use client'

import { useEffect, useState } from 'react'

export function LocalTime({ tz }: { tz: string }) {
  const [time, setTime] = useState('')

  useEffect(() => {
    const update = () => {
      setTime(new Date().toLocaleTimeString('fr-CH', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }))
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [tz])

  if (!time) return null

  return (
    <div className="flex flex-col items-center">
      <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-0.5">Heure locale</div>
      <div className="font-mono text-sm font-bold text-cyan-400 tabular-nums tracking-wider">{time}</div>
      <div className="text-[9px] text-slate-600 mt-0.5">{tz}</div>
    </div>
  )
}
