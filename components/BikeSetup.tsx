'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'

const HOTSPOTS = [
  { id: 'frame',        x: 50,  y: 45, label: 'Cadre',               model: 'Surly Long Haul Trucker 29" (acier)' },
  { id: 'fork',         x: 78,  y: 50, label: 'Fourche',             model: 'Surly LHT OEM — acier chromoly' },
  { id: 'handlebar',    x: 70,  y: 25, label: 'Cintre',              model: 'Nitto Noodle B115AA 44 cm' },
  { id: 'saddle',       x: 34,  y: 18, label: 'Selle',               model: 'Brooks B17 Standard (cuir)' },
  { id: 'saddlebag',    x: 20,  y: 22, label: 'Sacoche de selle',    model: 'Ortlieb Seat-Pack 16.5L' },
  { id: 'rearpannier',  x: 13,  y: 48, label: 'Sacoches arrière',    model: 'Ortlieb Back-Roller Classic 2×20L' },
  { id: 'framebag',     x: 50,  y: 54, label: 'Sacoche de cadre',    model: 'Revelate Designs Tangle Frame Bag' },
  { id: 'frontbag',     x: 76,  y: 36, label: 'Sacoche de guidon',   model: 'Ortlieb Handlebar-Pack 15L' },
  { id: 'smallbags',    x: 62,  y: 30, label: 'Sacoches de potence', model: 'Revelate Designs Mountain Feedbag ×2' },
  { id: 'drivetrain',   x: 47,  y: 75, label: 'Groupe / transmission', model: 'Shimano Deore XT 3×9 — cassette 11-36' },
  { id: 'brakes',       x: 80,  y: 60, label: 'Freins',              model: 'Shimano Deore BR-M6100 — disque hydraulique' },
  { id: 'tires',        x: 84,  y: 82, label: 'Pneus',               model: 'Schwalbe Marathon Mondial 29×2.0 — 127 tpi' },
  { id: 'dynamo',       x: 83,  y: 68, label: 'Moyeu dynamo',        model: 'SON 28 Delux (Schmidt) — 6V / 3W' },
  { id: 'lighting',     x: 73,  y: 44, label: 'Éclairage',           model: 'Busch & Müller IQ-X + Toplight Line' },
  { id: 'bottle',       x: 55,  y: 62, label: 'Porte-bidon',         model: 'Salsa Anything Cage HD ×2' },
]

const TIP_W = 164
const TIP_H = 52
const DOT_R = 6
const OFFSET = 22 // px gap between dot edge and tooltip

export function BikeSetup() {
  const [hovered, setHovered] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.offsetWidth, h: el.offsetHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const active = hovered ? HOTSPOTS.find(h => h.id === hovered) : null

  // Compute pixel layout for the active hotspot
  let dotPx = 0, dotPy = 0
  let tipLeft = 0, tipTop = 0
  let lineX1 = 0, lineY1 = 0, lineX2 = 0, lineY2 = 0

  if (active && size.w > 0) {
    dotPx = (active.x / 100) * size.w
    dotPy = (active.y / 100) * size.h

    // Flip tooltip left/right based on dot position
    const placeRight = active.x < 55
    const tipX = placeRight
      ? dotPx + DOT_R + OFFSET
      : dotPx - DOT_R - OFFSET - TIP_W

    // Clamp tooltip vertically so it stays inside the container
    const tipY = Math.min(
      Math.max(dotPy - TIP_H / 2, 4),
      size.h - TIP_H - 4
    )

    tipLeft = tipX
    tipTop = tipY

    // Line: from dot center → nearest edge mid of tooltip
    lineX1 = dotPx
    lineY1 = dotPy
    lineX2 = placeRight ? tipX : tipX + TIP_W
    lineY2 = tipY + TIP_H / 2
  }

  return (
    <div className="select-none">
      <div ref={containerRef} className="relative w-full" style={{ paddingBottom: '56%' }}>
        <Image
          src="/matos/Gemini_Generated_Image_x0ocijx0ocijx0oc.png"
          alt="Bike setup"
          fill
          className="object-contain rounded-xl"
          unoptimized
        />

        {/* Single SVG overlay for the callout line */}
        {active && size.w > 0 && (
          <svg
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 20, width: size.w, height: size.h }}
          >
            <line
              x1={lineX1} y1={lineY1}
              x2={lineX2} y2={lineY2}
              stroke="#f97316"
              strokeWidth="1.5"
              strokeDasharray="4 3"
              strokeLinecap="round"
            />
            {/* Small circle at tooltip anchor */}
            <circle cx={lineX2} cy={lineY2} r="2.5" fill="#f97316" />
          </svg>
        )}

        {/* Tooltip */}
        {active && size.w > 0 && (
          <div
            className="absolute pointer-events-none"
            style={{ left: tipLeft, top: tipTop, zIndex: 30, width: TIP_W }}
          >
            <div
              className="rounded-lg px-3 py-2 shadow-xl"
              style={{
                background: 'rgba(15,23,42,0.97)',
                border: '1px solid rgba(249,115,22,0.55)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.7)',
              }}
            >
              <div className="text-[10px] text-orange-400 font-semibold uppercase tracking-wider mb-0.5 leading-tight">
                {active.label}
              </div>
              <div className="text-white text-xs font-medium leading-snug">{active.model}</div>
            </div>
          </div>
        )}

        {/* Dots */}
        {HOTSPOTS.map((h) => (
          <button
            key={h.id}
            onMouseEnter={() => setHovered(h.id)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(h.id)}
            onBlur={() => setHovered(null)}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${h.x}%`, top: `${h.y}%`, zIndex: 25 }}
            aria-label={`${h.label}: ${h.model}`}
          >
            <span
              className="block w-3 h-3 rounded-full border-2 transition-all duration-150"
              style={{
                background: hovered === h.id ? '#f97316' : 'rgba(249,115,22,0.65)',
                borderColor: hovered === h.id ? '#fff' : 'rgba(255,255,255,0.4)',
                boxShadow: hovered === h.id ? '0 0 0 4px rgba(249,115,22,0.25)' : 'none',
                transform: hovered === h.id ? 'scale(1.35)' : 'scale(1)',
              }}
            />
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {HOTSPOTS.map((h) => (
          <div
            key={h.id}
            onMouseEnter={() => setHovered(h.id)}
            onMouseLeave={() => setHovered(null)}
            className="px-3 py-2 rounded-lg border transition-colors cursor-default"
            style={{
              borderColor: hovered === h.id ? 'rgba(249,115,22,0.6)' : 'rgba(51,65,85,0.8)',
              background: hovered === h.id ? 'rgba(249,115,22,0.08)' : 'rgba(30,41,59,0.5)',
            }}
          >
            <div className="text-slate-400 text-xs">{h.label}</div>
            <div className="text-white text-sm font-medium leading-tight mt-0.5 truncate">{h.model}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
