'use client'

import { useEffect, useRef, useState } from 'react'

interface ElevationMarker {
  distanceM: number
  label: string
  color: string
}

interface ElevationProfileProps {
  points: [number, number][] // [distanceMeters, altitudeMeters]
  hoveredDistance?: number | null
  onHoverDistance?: (d: number | null) => void
  markers?: ElevationMarker[]
  gainLabel?: string
  riddenUpToM?: number
  showStats?: boolean
  countries?: [number, string][] // [distanceM, countryName]
}

const H = 116
const PAD = { top: 34, right: 8, bottom: 20, left: 36 }

export function ElevationProfile({ points, hoveredDistance, onHoverDistance, markers = [], gainLabel = 'm gain', riddenUpToM, showStats = true, countries }: ElevationProfileProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(400)

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width)
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  if (points.length < 2) return null

  const innerW = width - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const maxDist = points[points.length - 1][0]
  const alts = points.map(([, a]) => a)
  const minAlt = Math.min(...alts)
  const maxAlt = Math.max(...alts)
  const altRange = maxAlt - minAlt || 1

  const totalGain = points.reduce((gain, [, alt], i) => {
    if (i === 0) return 0
    const diff = alt - points[i - 1][1]
    return gain + (diff > 0 ? diff : 0)
  }, 0)

  const toX = (dist: number) => PAD.left + (dist / maxDist) * innerW
  const toY = (alt: number) => PAD.top + innerH - ((alt - minAlt) / altRange) * innerH

  const pathD = points
    .map(([d, a], i) => `${i === 0 ? 'M' : 'L'}${toX(d).toFixed(1)},${toY(a).toFixed(1)}`)
    .join(' ')

  const areaD = `${pathD} L${toX(maxDist).toFixed(1)},${(PAD.top + innerH).toFixed(1)} L${PAD.left},${(PAD.top + innerH).toFixed(1)} Z`

  const yTicks = [minAlt, minAlt + altRange / 2, maxAlt]

  // Round x-axis interval to a nice number (500, 1000, 2000, 2500, 5000 km…)
  const NICE = [500, 1000, 2000, 2500, 5000, 10000]
  const maxDistKm = maxDist / 1000
  const targetTicks = Math.min(5, Math.max(2, Math.floor(innerW / 80)))
  const rawIntervalKm = maxDistKm / (targetTicks + 1)
  const intervalKm = NICE.find(n => n >= rawIntervalKm) ?? NICE[NICE.length - 1]
  const xTicks: number[] = []
  for (let km = intervalKm; km < maxDistKm - intervalKm * 0.3; km += intervalKm) {
    xTicks.push(km * 1000)
  }

  const riddenClipW = riddenUpToM != null
    ? Math.max(0, Math.min(innerW, toX(riddenUpToM) - PAD.left))
    : null

  // Compute indicator values when hoveredDistance is set
  let indicatorX: number | null = null
  let indicatorY: number | null = null
  let indicatorAlt: number | null = null
  if (hoveredDistance != null) {
    const clamped = Math.max(0, Math.min(maxDist, hoveredDistance))
    indicatorX = toX(clamped)
    let nearest = points[0]
    let minDiff = Math.abs(points[0][0] - clamped)
    for (const p of points) {
      const diff = Math.abs(p[0] - clamped)
      if (diff < minDiff) { minDiff = diff; nearest = p }
    }
    indicatorY = toY(nearest[1])
    indicatorAlt = nearest[1]
  }

  function getDistFromClientX(clientX: number, rect: DOMRect): number {
    const offsetX = clientX - rect.left
    const dist = ((offsetX - PAD.left) / innerW) * maxDist
    return Math.max(0, Math.min(maxDist, dist))
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!onHoverDistance) return
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
    onHoverDistance(getDistFromClientX(e.clientX, rect))
  }

  function handleMouseLeave() {
    onHoverDistance?.(null)
  }

  function handleTouchMove(e: React.TouchEvent<SVGSVGElement>) {
    if (!onHoverDistance) return
    const touch = e.touches[0]
    if (!touch) return
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
    onHoverDistance(getDistFromClientX(touch.clientX, rect))
  }

  function handleTouchEnd() {
    onHoverDistance?.(null)
  }

  // Country at current hover position (or at start if no hover)
  let currentCountry: string | null = null
  if (countries && countries.length > 0) {
    const dist = hoveredDistance ?? 0
    let match = countries[0][1]
    for (const [d, name] of countries) {
      if (d <= dist) match = name
      else break
    }
    currentCountry = match
  }

  return (
    <div ref={containerRef}>
      {countries && countries.length > 0 && (
        <div className="mb-1 text-xs font-semibold text-cyan-400 tracking-wide">
          {currentCountry ?? countries[0][1]}
        </div>
      )}
      {showStats && <div className="flex items-center justify-between mb-1.5 text-xs text-slate-500">
        <span>↑ {Math.round(totalGain).toLocaleString()} {gainLabel}</span>
        <span>{Math.round(minAlt)} – {Math.round(maxAlt)} m</span>
      </div>}

      <svg
        width={width}
        height={H}
        style={{ display: 'block', cursor: onHoverDistance ? 'crosshair' : undefined, touchAction: 'none' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <defs>
          <linearGradient id="elev-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="elev-grad-slate" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#475569" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#475569" stopOpacity="0.04" />
          </linearGradient>
          {riddenClipW != null && (
            <clipPath id="ridden-clip">
              <rect x={PAD.left} y={0} width={riddenClipW} height={H} />
            </clipPath>
          )}
        </defs>

        {/* Grid lines */}
        {yTicks.map((alt, i) => (
          <line key={i} x1={PAD.left} y1={toY(alt)} x2={PAD.left + innerW} y2={toY(alt)}
            stroke="#334155" strokeWidth="0.5" />
        ))}

        {riddenClipW != null ? (
          <>
            {/* Full area (slate = unridden) */}
            <path d={areaD} fill="url(#elev-grad-slate)" />
            {/* Full line (slate dashed = unridden) */}
            <path d={pathD} fill="none" stroke="#475569" strokeWidth="1.5" strokeLinejoin="round" strokeDasharray="5 3" />
            {/* Ridden area clipped */}
            <path d={areaD} fill="url(#elev-grad)" clipPath="url(#ridden-clip)" />
            {/* Ridden line clipped */}
            <path d={pathD} fill="none" stroke="#f97316" strokeWidth="1.5" strokeLinejoin="round" clipPath="url(#ridden-clip)" />
            {/* Frontier line */}
            {riddenClipW > 0 && (
              <line
                x1={PAD.left + riddenClipW} y1={PAD.top}
                x2={PAD.left + riddenClipW} y2={PAD.top + innerH}
                stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2" opacity="0.7"
              />
            )}
          </>
        ) : (
          <>
            <path d={areaD} fill="url(#elev-grad)" />
            <path d={pathD} fill="none" stroke="#f97316" strokeWidth="1.5" strokeLinejoin="round" />
          </>
        )}

        {/* Y-axis labels */}
        {yTicks.map((alt, i) => (
          <text key={i} x={PAD.left - 4} y={toY(alt) + 3}
            textAnchor="end" fontSize="9" fill="#64748b">
            {Math.round(alt)}
          </text>
        ))}

        {/* X-axis labels */}
        {xTicks.map((dist, i) => (
          <text key={i} x={toX(dist)} y={H - 4}
            textAnchor="middle" fontSize="9" fill="#64748b">
            {(dist / 1000).toFixed(0)}km
          </text>
        ))}

        {/* Event markers */}
        {(() => {
          const valid = markers
            .map((m, i) => ({ ...m, i, x: toX(m.distanceM) }))
            .filter((m) => m.distanceM >= 0 && m.distanceM <= maxDist)
            .sort((a, b) => a.x - b.x)

          const MIN_GAP = 52
          const rows: number[] = []
          for (let k = 0; k < valid.length; k++) {
            if (k === 0) { rows.push(0); continue }
            rows.push(valid[k].x - valid[k - 1].x < MIN_GAP ? 1 - rows[k - 1] : 0)
          }

          return valid.map((m, k) => {
            const row = rows[k]
            const labelY = row === 0 ? 10 : 22
            const connectorTop = labelY + 3
            return (
              <g key={m.i}>
                <text x={m.x} y={labelY} textAnchor="middle" fontSize="9" fontWeight="bold" fill={m.color}>{m.label}</text>
                <line x1={m.x} y1={connectorTop} x2={m.x} y2={PAD.top} stroke={m.color} strokeWidth="1" opacity="0.5" />
                <line x1={m.x} y1={PAD.top} x2={m.x} y2={PAD.top + innerH} stroke={m.color} strokeWidth="1" strokeDasharray="3 2" opacity="0.6" />
              </g>
            )
          })
        })()}

        {/* Hover indicator */}
        {indicatorX != null && indicatorY != null && indicatorAlt != null && (() => {
          const label = `${Math.round(indicatorAlt)} m`
          const tipW = label.length * 6 + 10
          const tipH = 16
          const tipX = indicatorX + 6 + tipW > PAD.left + innerW ? indicatorX - tipW - 6 : indicatorX + 6
          const tipY = Math.max(PAD.top, indicatorY - tipH / 2)
          return (
            <>
              <line x1={indicatorX} y1={PAD.top} x2={indicatorX} y2={PAD.top + innerH}
                stroke="#f97316" strokeWidth="1.5" opacity="0.8" />
              <circle cx={indicatorX} cy={indicatorY} r={3} fill="#f97316" opacity="0.9" />
              <rect x={tipX} y={tipY} width={tipW} height={tipH} rx={3}
                fill="#0f172a" stroke="#f97316" strokeWidth="0.8" opacity="0.92" />
              <text x={tipX + tipW / 2} y={tipY + 11} textAnchor="middle" fontSize="9.5"
                fontWeight="600" fill="#f97316">{label}</text>
            </>
          )
        })()}
      </svg>
    </div>
  )
}
