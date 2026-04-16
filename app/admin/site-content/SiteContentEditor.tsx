'use client'

import { useState } from 'react'

export function SiteContentEditor({ content }: { content: Record<string, string> }) {
  const [title, setTitle] = useState(content.title ?? '')
  const [descFr, setDescFr] = useState(content.description_fr ?? '')
  const [descEn, setDescEn] = useState(content.description_en ?? '')
  const [heroUrl, setHeroUrl] = useState(content.hero_image_url ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/site-content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description_fr: descFr,
          description_en: descEn,
          hero_image_url: heroUrl,
        }),
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

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-4">
      <div>
        <label className="text-sm font-medium text-slate-300 block mb-1">Trip Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-slate-300 block mb-1">Description (FR)</label>
        <textarea
          value={descFr}
          onChange={(e) => setDescFr(e.target.value)}
          rows={4}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-slate-300 block mb-1">Description (EN)</label>
        <textarea
          value={descEn}
          onChange={(e) => setDescEn(e.target.value)}
          rows={4}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-slate-300 block mb-1">Hero Image URL</label>
        <input
          value={heroUrl}
          onChange={(e) => setHeroUrl(e.target.value)}
          placeholder="https://..."
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
        />
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-semibold disabled:opacity-50 transition-colors"
      >
        {saved ? 'Saved ✓' : saving ? 'Saving...' : 'Save changes'}
      </button>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
    </div>
  )
}
