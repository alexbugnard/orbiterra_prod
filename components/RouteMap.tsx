// Pure SVG — no Leaflet, no basemap. Projects [lng,lat][] using equirectangular projection.
interface Props {
  coords: [number, number][]
  riddenCutoff: number // index up to which the route is considered ridden
}

function project(coords: [number, number][], W: number, H: number, pad: number) {
  if (coords.length === 0) return []
  const lngs = coords.map(([lng]) => lng)
  const lats = coords.map(([, lat]) => lat)
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
  const minLat = Math.min(...lats), maxLat = Math.max(...lats)
  const scaleX = (W - pad * 2) / (maxLng - minLng || 1)
  const scaleY = (H - pad * 2) / (maxLat - minLat || 1)
  const scale = Math.min(scaleX, scaleY)
  const offX = (W - (maxLng - minLng) * scale) / 2
  const offY = (H - (maxLat - minLat) * scale) / 2
  return coords.map(([lng, lat]) => [
    offX + (lng - minLng) * scale,
    offY + (maxLat - lat) * scale,   // invert Y
  ] as [number, number])
}

function toPolyline(pts: [number, number][]) {
  return pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
}

export function RouteMap({ coords, riddenCutoff }: Props) {
  const W = 220, H = 480, PAD = 12

  const pts = project(coords, W, H, PAD)
  const ridden = pts.slice(0, riddenCutoff + 1)
  const unridden = pts.slice(riddenCutoff)

  // Dot at the frontier (current position)
  const dot = riddenCutoff > 0 && riddenCutoff < pts.length - 1 ? pts[riddenCutoff] : null

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-full"
      style={{ minHeight: 300 }}
    >
      {/* Unridden — dashed cyan */}
      {unridden.length > 1 && (
        <polyline
          points={toPolyline(unridden)}
          fill="none"
          stroke="#22d3ee"
          strokeWidth="2"
          strokeDasharray="6 4"
          strokeLinecap="round"
          strokeOpacity="0.5"
        />
      )}
      {/* Ridden — solid orange */}
      {ridden.length > 1 && (
        <polyline
          points={toPolyline(ridden)}
          fill="none"
          stroke="#f97316"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {/* Current position dot */}
      {dot && (
        <circle cx={dot[0].toFixed(1)} cy={dot[1].toFixed(1)} r="5" fill="#f97316" stroke="#0f172a" strokeWidth="2" />
      )}
      {/* Start dot */}
      {pts.length > 0 && (
        <circle cx={pts[0][0].toFixed(1)} cy={pts[0][1].toFixed(1)} r="3" fill="#94a3b8" />
      )}
      {/* End dot */}
      {pts.length > 1 && (
        <circle cx={pts[pts.length - 1][0].toFixed(1)} cy={pts[pts.length - 1][1].toFixed(1)} r="3" fill="#94a3b8" />
      )}
    </svg>
  )
}
