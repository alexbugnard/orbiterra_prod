'use client'

import { useEffect, useRef } from 'react'
import { geoOrthographic, geoPath, geoGraticule } from 'd3-geo'
import type { GeoPermissibleObjects } from 'd3-geo'

interface Props {
  coords: [number, number][]
  riddenCutoff: number
}

const CENTER: [number, number] = [-80, 15]

export function GlobeMap({ coords, riddenCutoff }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || coords.length < 2) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    const radius = Math.min(W, H) / 2 - 4

    const projection = geoOrthographic()
      .scale(radius)
      .translate([W / 2, H / 2])
      .rotate([-CENTER[0], -CENTER[1]])
      .clipAngle(90)

    const path = geoPath(projection, ctx)
    const graticule = geoGraticule()

    // Dot position (computed once)
    let dotPt: [number, number] | null = null
    if (riddenCutoff > 0 && riddenCutoff < coords.length - 1) {
      const [lng, lat] = coords[riddenCutoff]
      dotPt = projection([lng, lat]) as [number, number] | null
    }

    // Offscreen canvas for the static globe (drawn once)
    const offscreen = document.createElement('canvas')
    offscreen.width = W
    offscreen.height = H
    const off = offscreen.getContext('2d')!

    const drawStatic = (land: GeoPermissibleObjects) => {
      const offPath = geoPath(projection, off)

      // Ocean
      off.beginPath()
      offPath({ type: 'Sphere' })
      off.fillStyle = '#0f2744'
      off.fill()

      // Graticule
      off.beginPath()
      offPath(graticule())
      off.strokeStyle = 'rgba(255,255,255,0.05)'
      off.lineWidth = 0.5
      off.stroke()

      // Land
      off.beginPath()
      offPath(land)
      off.fillStyle = '#1e3a5f'
      off.fill()
      off.strokeStyle = 'rgba(255,255,255,0.12)'
      off.lineWidth = 0.5
      off.stroke()

      // Globe outline
      off.beginPath()
      offPath({ type: 'Sphere' })
      off.strokeStyle = 'rgba(255,255,255,0.15)'
      off.lineWidth = 1
      off.stroke()

      // Unridden route
      if (riddenCutoff < coords.length - 1) {
        const unridden: GeoPermissibleObjects = {
          type: 'LineString',
          coordinates: coords.slice(riddenCutoff) as [number, number][],
        }
        off.beginPath()
        offPath(unridden)
        off.strokeStyle = 'rgba(34,211,238,0.55)'
        off.lineWidth = 1.5
        off.setLineDash([5, 4])
        off.stroke()
        off.setLineDash([])
      }

      // Ridden route
      if (riddenCutoff > 0) {
        const ridden: GeoPermissibleObjects = {
          type: 'LineString',
          coordinates: coords.slice(0, riddenCutoff + 1) as [number, number][],
        }
        off.beginPath()
        offPath(ridden)
        off.strokeStyle = '#f97316'
        off.lineWidth = 2.5
        off.stroke()
      }

      // Start dot
      const startPt = projection(coords[0])
      if (startPt) {
        off.beginPath()
        off.arc(startPt[0], startPt[1], 3, 0, Math.PI * 2)
        off.fillStyle = '#94a3b8'
        off.fill()
      }
    }

    let rafId: number
    let startTime: number | null = null

    const animate = (ts: number) => {
      if (startTime === null) startTime = ts
      const elapsed = (ts - startTime) / 1000 // seconds

      ctx.clearRect(0, 0, W, H)
      ctx.drawImage(offscreen, 0, 0)

      // Blinking dot: pulse with a sine wave (1 Hz)
      if (dotPt) {
        const pulse = (Math.sin(elapsed * Math.PI * 2) + 1) / 2 // 0→1→0
        const outerR = 5 + pulse * 6
        const innerR = 5

        // Outer glow ring
        ctx.beginPath()
        ctx.arc(dotPt[0], dotPt[1], outerR, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(249,115,22,${0.4 * pulse})`
        ctx.fill()

        // Core dot
        ctx.beginPath()
        ctx.arc(dotPt[0], dotPt[1], innerR, 0, Math.PI * 2)
        ctx.fillStyle = '#f97316'
        ctx.fill()
        ctx.strokeStyle = '#0f172a'
        ctx.lineWidth = 2
        ctx.stroke()
      }

      rafId = requestAnimationFrame(animate)
    }

    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json')
      .then((r) => r.json())
      .then((world) => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { feature } = require('topojson-client')
        const land = feature(world, world.objects.land)
        drawStatic(land)
        rafId = requestAnimationFrame(animate)
      })
      .catch(() => {
        drawStatic({ type: 'GeometryCollection', geometries: [] })
        rafId = requestAnimationFrame(animate)
      })

    return () => cancelAnimationFrame(rafId)
  }, [coords, riddenCutoff])

  return (
    <canvas
      ref={canvasRef}
      width={420}
      height={420}
      className="w-full h-full object-contain"
      style={{ borderRadius: '50%' }}
    />
  )
}
