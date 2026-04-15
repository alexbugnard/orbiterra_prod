'use client'

import { useState } from 'react'

export function SiteContentEditor({ content }: { content: Record<string, string> }) {
  const [title, setTitle] = useState(content.title ?? '')
  const [descFr, setDescFr] = useState(content.description_fr ?? '')
  const [descEn, setDescEn] = useState(content.description_en ?? '')
  const [heroUrl, setHeroUrl] = useState(content.hero_image_url ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    await fetch('/api/admin/site-content', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description_fr: descFr,
        description_en: descEn,
        hero_image_url: heroUrl,
      }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="bg-white rounded-lg border p-6 space-y-4">
      <div>
        <label className="text-sm font-medium block mb-1">Trip Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
        />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">Description (FR)</label>
        <textarea
          value={descFr}
          onChange={(e) => setDescFr(e.target.value)}
          rows={4}
          className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
        />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">Description (EN)</label>
        <textarea
          value={descEn}
          onChange={(e) => setDescEn(e.target.value)}
          rows={4}
          className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
        />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">Hero Image URL</label>
        <input
          value={heroUrl}
          onChange={(e) => setHeroUrl(e.target.value)}
          placeholder="https://..."
          className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
        />
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="bg-gray-900 text-white px-6 py-2 rounded font-semibold hover:bg-gray-700 disabled:opacity-50"
      >
        {saved ? 'Saved ✓' : saving ? 'Saving...' : 'Save changes'}
      </button>
    </div>
  )
}
