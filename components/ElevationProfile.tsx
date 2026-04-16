'use client'

import { useEffect, useRef, useState } from 'react'

interface ElevationProfileProps {
  points: [number, number][] // [distanceMeters, altitudeMeters]
  hoveredDistance?: number | null
  onHoverDistance?: (d: number | null) => void
}

const H = 88
const PAD = { top: 6, right: 8, bottom: 20, left: 36 }

export function ElevationProfile({ points, hoveredDistance, onHoverDistance }: ElevationProfileProps) {
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
  const xTickCount = Math.min(4, Math.floor(maxDist / 1000))
  const xTicks: number[] = []
  for (let i = 1; i <= xTickCount; i++) {
    xTicks.push((maxDist / (xTickCount + 1)) * i)
  }

  // Compute indicator values when hoveredDistance is set
  let indicatorX: number | null = null
  let indicatorY: number | null = null
  if (hoveredDistance != null) {
    const clamped = Math.max(0, Math.min(maxDist, hoveredDistance))
    indicatorX = toX(clamped)
    // Find nearest point
    let nearest = points[0]
    let minDiff = Math.abs(points[0][0] - clamped)
    for (const p of points) {
      const diff = Math.abs(p[0] - clamped)
      if (diff < minDiff) { minDiff = diff; nearest = p }
    }
    indicatorY = toY(nearest[1])
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!onHoverDistance) return
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
    const offsetX = e.clientX - rect.left
    const dist = ((offsetX - PAD.left) / innerW) * maxDist
    const clamped = Math.max(0, Math.min(maxDist, dist))
    onHoverDistance(clamped)
  }

  function handleMouseLeave() {
    onHoverDistance?.(null)
  }

  return (
    <div ref={containerRef}>
      <div className="flex items-center justify-between mb-1.5 text-xs text-slate-500">
        <span>↑ {Math.round(totalGain).toLocaleString()} m gain</span>
        <span>{Math.round(minAlt)} – {Math.round(maxAlt)} m</span>
      </div>

      <svg
        width={width}
        height={H}
        style={{ display: 'block', cursor: onHoverDistance ? 'crosshair' : undefined }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <linearGradient id="elev-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yTicks.map((alt, i) => (
          <line key={i} x1={PAD.left} y1={toY(alt)} x2={PAD.left + innerW} y2={toY(alt)}
            stroke="#334155" strokeWidth="0.5" />
        ))}

        {/* Area */}
        <path d={areaD} fill="url(#elev-grad)" />

        {/* Line */}
        <path d={pathD} fill="none" stroke="#f97316" strokeWidth="1.5" strokeLinejoin="round" />

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

        {/* Hover indicator */}
        {indicatorX != null && indicatorY != null && (
          <>
            <line
              x1={indicatorX} y1={PAD.top}
              x2={indicatorX} y2={PAD.top + innerH}
              stroke="#f97316" strokeWidth="1.5" opacity="0.8"
            />
            <circle
              cx={indicatorX} cy={indicatorY}
              r={3} fill="#f97316" opacity="0.9"
            />
          </>
        )}
      </svg>
    </div>
  )
}
