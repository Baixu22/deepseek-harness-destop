/* Interactive 3D icon cloud (magicui IconCloud port) for the About section:
   brand glyphs from the simple-icons CDN orbit a fibonacci sphere, ease
   toward the pointer, and can be dragged. The CDN color rides the live
   --dsh-about-cloud-ink token, so a scheme flip re-requests the glyphs in
   the matching ink. Plays by default; reduced-motion users get a still
   cloud. No pause control — the motion IS the point. */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import styles from './IconCloud.module.css'

interface CloudIcon {
  x: number
  y: number
  z: number
  scale: number
  opacity: number
  id: number
}

interface TargetRotation {
  x: number
  y: number
  startX: number
  startY: number
  distance: number
  startTime: number
  duration: number
}

/** Token carrying the glyph ink per scheme (ModelsSection.module.css). */
const INK_VARIABLE = '--dsh-about-cloud-ink'
/** Fallback ink when the token is unset. */
const FALLBACK_INK = '#5b6472'

function resolveInk(): string {
  const value = getComputedStyle(document.body).getPropertyValue(INK_VARIABLE).trim()
  return value === '' ? FALLBACK_INK : value
}

/** simple-icons CDN paths want a bare 6-digit hex; normalize hex/rgb() forms. */
function inkToHex(ink: string): string {
  if (ink.startsWith('#')) return ink.slice(1)
  const rgb = /^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(ink)
  /* v8 ignore next -- the shipped token is authored as hex; rgb() only
     arrives from a hand-edited sheet. */
  if (rgb === null) return FALLBACK_INK.slice(1)
  return [rgb[1], rgb[2], rgb[3]]
    .map(part => Number(part).toString(16).padStart(2, '0'))
    .join('')
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/** Props of {@link IconCloud}. */
export interface IconCloudProps {
  /** simple-icons slugs orbiting the sphere (typescript, docker, figma, …). */
  slugs: readonly string[]
}

/**
 * Render the orbiting icon cloud.
 * @param props - see {@link IconCloudProps}.
 * @returns the cloud canvas.
 */
export function IconCloud({ slugs }: IconCloudProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [iconPositions, setIconPositions] = useState<CloudIcon[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 })
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [targetRotation, setTargetRotation] = useState<TargetRotation | null>(null)
  const animationFrameRef = useRef<number>(0)
  const rotationRef = useRef({ x: 0, y: 0 })
  const iconCanvasesRef = useRef<HTMLCanvasElement[]>([])
  const imagesLoadedRef = useRef<boolean[]>([])

  // Live scheme ink: re-request the CDN glyphs when the theme attribute flips.
  const [ink, setInk] = useState<string>(() => resolveInk())
  useEffect(() => {
    const refresh = (): void => { setInk(resolveInk()) }
    const observer = new MutationObserver(refresh)
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] })
    return () => { observer.disconnect() }
  }, [])
  const urls = useMemo(
    () => slugs.map(slug => `https://cdn.simpleicons.org/${slug}/${inkToHex(ink)}`),
    [slugs, ink],
  )

  // A still cloud for reduced-motion users (no control to resume: the
  // preference is the control).
  useEffect(() => {
    /* v8 ignore start -- jsdom has no matchMedia; the browser path pauses
       the cloud for reduced-motion users. */
    if (typeof window.matchMedia === 'function') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
      if (mediaQuery.matches) setIsPaused(true)
      const handleChange = (e: MediaQueryListEvent): void => { setIsPaused(e.matches) }
      mediaQuery.addEventListener('change', handleChange)
      return () => { mediaQuery.removeEventListener('change', handleChange) }
    }
    /* v8 ignore stop -- matchMedia path. */
  }, [])

  // Rasterize each CDN glyph onto a private circular canvas once per url set.
  useEffect(() => {
    imagesLoadedRef.current = new Array<boolean>(urls.length).fill(false)
    iconCanvasesRef.current = urls.map((url, index) => {
      const offscreen = document.createElement('canvas')
      offscreen.width = 40
      offscreen.height = 40
      const offCtx = offscreen.getContext('2d')
      /* v8 ignore next -- jsdom returns no 2d context; exercised in the browser. */
      if (offCtx !== null) {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.src = url
        img.onload = () => {
          offCtx.clearRect(0, 0, offscreen.width, offscreen.height)
          // Circular clip so square brand tiles read as coins on the sphere.
          offCtx.beginPath()
          offCtx.arc(20, 20, 20, 0, Math.PI * 2)
          offCtx.closePath()
          offCtx.clip()
          offCtx.drawImage(img, 0, 0, 40, 40)
          imagesLoadedRef.current[index] = true
        }
      }
      return offscreen
    })
  }, [urls])

  // Generate initial glyph positions on a fibonacci sphere.
  useEffect(() => {
    const newIcons: CloudIcon[] = []
    const numIcons = slugs.length || 20
    const offset = 2 / numIcons
    const increment = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < numIcons; i++) {
      const y = i * offset - 1 + offset / 2
      const r = Math.sqrt(1 - y * y)
      const phi = i * increment
      newIcons.push({
        x: Math.cos(phi) * r * 100,
        y: y * 100,
        z: Math.sin(phi) * r * 100,
        scale: 1,
        opacity: 1,
        id: i,
      })
    }
    setIconPositions(newIcons)
  }, [slugs.length])

  const handleMouseDown = (e: ReactMouseEvent<HTMLCanvasElement>): void => {
    const canvas = canvasRef.current
    const rect = canvas?.getBoundingClientRect()
    if (rect === undefined || canvas === null) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    /* v8 ignore start -- jsdom has no 2d context and zero rects; the
       hit-test and fling math are exercised in the browser. */
    const ctx = canvas.getContext('2d')
    if (ctx === null) return
    iconPositions.forEach((icon) => {
      const cosX = Math.cos(rotationRef.current.x)
      const sinX = Math.sin(rotationRef.current.x)
      const cosY = Math.cos(rotationRef.current.y)
      const sinY = Math.sin(rotationRef.current.y)
      const rotatedX = icon.x * cosY - icon.z * sinY
      const rotatedZ = icon.x * sinY + icon.z * cosY
      const rotatedY = icon.y * cosX + rotatedZ * sinX
      const screenX = canvas.width / 2 + rotatedX
      const screenY = canvas.height / 2 + rotatedY
      const distance = Math.sqrt(Math.pow(screenX - x, 2) + Math.pow(screenY - y, 2))
      if (distance < 25) {
        const startX = rotationRef.current.x
        const startY = rotationRef.current.y
        setTargetRotation({
          x: startX + (Math.random() - 0.5) * Math.PI,
          y: startY + (Math.random() - 0.5) * Math.PI,
          startX,
          startY,
          distance,
          startTime: performance.now(),
          duration: 1000,
        })
      }
    })
    /* v8 ignore stop -- jsdom hit-test math. */
    setIsDragging(true)
    setLastMousePos({ x: e.clientX, y: e.clientY })
  }

  const handleMouseMove = (e: ReactMouseEvent<HTMLCanvasElement>): void => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (rect !== undefined) {
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    }
    if (isDragging) {
      rotationRef.current = {
        x: rotationRef.current.x + (e.clientY - lastMousePos.y) * 0.002,
        y: rotationRef.current.y + (e.clientX - lastMousePos.x) * 0.002,
      }
      setLastMousePos({ x: e.clientX, y: e.clientY })
    }
  }

  const handleMouseUp = (): void => { setIsDragging(false) }

  // Rotation + render loop.
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d') ?? null
    /* v8 ignore start -- the frame loop needs a real 2d context, which
       jsdom does not implement; exercised in the browser. */
    if (canvas !== null && ctx !== null) {
      const animate = (): void => {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        const centerX = canvas.width / 2
        const centerY = canvas.height / 2
        const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY)
        const dx = mousePos.x - centerX
        const dy = mousePos.y - centerY
        const distance = Math.sqrt(dx * dx + dy * dy)
        const speed = 0.003 + (distance / maxDistance) * 0.01

        if (targetRotation !== null) {
          const elapsed = performance.now() - targetRotation.startTime
          const progress = Math.min(1, elapsed / targetRotation.duration)
          const easedProgress = easeOutCubic(progress)
          rotationRef.current = {
            x: targetRotation.startX + (targetRotation.x - targetRotation.startX) * easedProgress,
            y: targetRotation.startY + (targetRotation.y - targetRotation.startY) * easedProgress,
          }
          if (progress >= 1) setTargetRotation(null)
        } else if (!isDragging && !isPaused) {
          rotationRef.current = {
            x: rotationRef.current.x + (dy / canvas.height) * speed,
            y: rotationRef.current.y + (dx / canvas.width) * speed,
          }
        }

        iconPositions.forEach((icon, index) => {
          const cosX = Math.cos(rotationRef.current.x)
          const sinX = Math.sin(rotationRef.current.x)
          const cosY = Math.cos(rotationRef.current.y)
          const sinY = Math.sin(rotationRef.current.y)
          const rotatedX = icon.x * cosY - icon.z * sinY
          const rotatedZ = icon.x * sinY + icon.z * cosY
          const rotatedY = icon.y * cosX + rotatedZ * sinX
          const scale = (rotatedZ + 200) / 300
          const opacity = Math.max(0.2, Math.min(1, (rotatedZ + 150) / 200))
          ctx.save()
          ctx.translate(canvas.width / 2 + rotatedX, canvas.height / 2 + rotatedY)
          ctx.scale(scale, scale)
          ctx.globalAlpha = opacity
          if (iconCanvasesRef.current[index] !== undefined && imagesLoadedRef.current[index] === true) {
            ctx.drawImage(iconCanvasesRef.current[index], -20, -20, 40, 40)
          }
          ctx.restore()
        })

        const hasPendingAssets = !imagesLoadedRef.current.every(loaded => loaded)
        const shouldContinue = !isPaused || isDragging || targetRotation !== null || hasPendingAssets
        if (shouldContinue) animationFrameRef.current = requestAnimationFrame(animate)
      }
      animate()
    }
    /* v8 ignore stop -- canvas 2d pipeline (jsdom has no context). */

    return () => {
      if (animationFrameRef.current !== 0) cancelAnimationFrame(animationFrameRef.current)
    }
  }, [slugs.length, iconPositions, isDragging, isPaused, mousePos, targetRotation])

  return (
    <div className={styles.cloud}>
      <canvas
        ref={canvasRef}
        width={400}
        height={400}
        className={styles.canvas}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        aria-label="Interactive 3D Icon Cloud"
        role="img"
      />
    </div>
  )
}
