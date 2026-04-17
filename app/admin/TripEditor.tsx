'use client'

import { useState } from 'react'

interface Trip {
  id: string
  name: string
  start_date: string
  distance_m: number
  visible: boolean
  journal_fr: string | null
  journal_en: string | null
}

export function TripEditor({ trip }: { trip: Trip }) {
  const [name, setName] = useState(trip.name)
  const [visible, setVisible] = useState(trip.visible)
  const [journalFr, setJournalFr] = useState(trip.journal_fr ?? '')
  const [journalEn, setJournalEn] = useState(trip.journal_en ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(false)

  async function save() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/trips/${trip.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, visible, journal_fr: journalFr, journal_en: journalEn }),
      })
      if (!res.ok) throw new Error('Save failed')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const distanceKm = (trip.distance_m / 1000).toFixed(1)

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      {/* Summary row */}
      <div className="flex items-center gap-4 px-4 py-3">
        <div
          className={`w-2 h-2 rounded-full flex-shrink-0 ${visible ? 'bg-green-400' : 'bg-slate-600'}`}
          title={visible ? 'Visible' : 'Hidden'}
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white truncate">{trip.name}</div>
          <div className="text-xs text-slate-500">
            {new Date(trip.start_date).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' })} · {distanceKm} km
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-500"
        >
          {expanded ? 'Collapse' : 'Edit'}
        </button>
      </div>

      {/* Edit panel */}
      {expanded && (
        <div className="border-t border-slate-700 px-4 py-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1.5">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1.5">Journal (FR)</label>
              <textarea
                value={journalFr}
                onChange={(e) => setJournalFr(e.target.value)}
                rows={3}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1.5">Journal (EN)</label>
              <textarea
                value={journalEn}
                onChange={(e) => setJournalEn(e.target.value)}
                rows={3}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors resize-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={visible}
                onChange={(e) => setVisible(e.target.checked)}
                className="w-4 h-4 accent-orange-500"
              />
              Publicly visible
            </label>

            <div className="flex items-center gap-3">
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button
                onClick={save}
                disabled={saving}
                className={`text-sm px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50 ${
                  saved
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-orange-500 hover:bg-orange-600 text-white'
                }`}
              >
                {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
