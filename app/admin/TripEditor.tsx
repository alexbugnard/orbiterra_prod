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

  async function save() {
    setSaving(true)
    await fetch(`/api/admin/trips/${trip.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, visible, journal_fr: journalFr, journal_en: journalEn }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const distanceKm = (trip.distance_m / 1000).toFixed(1)

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-base font-semibold border-b border-transparent focus:border-gray-300 focus:outline-none"
          />
          <p className="text-xs text-gray-400">
            {new Date(trip.start_date).toLocaleDateString('en')} · {distanceKm} km
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={visible}
            onChange={(e) => setVisible(e.target.checked)}
            className="rounded"
          />
          Visible
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Journal (FR)</label>
          <textarea
            value={journalFr}
            onChange={(e) => setJournalFr(e.target.value)}
            rows={3}
            className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Journal (EN)</label>
          <textarea
            value={journalEn}
            onChange={(e) => setJournalEn(e.target.value)}
            rows={3}
            className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
          />
        </div>
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="text-sm bg-gray-900 text-white px-4 py-1.5 rounded hover:bg-gray-700 disabled:opacity-50"
      >
        {saved ? 'Saved ✓' : saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  )
}
