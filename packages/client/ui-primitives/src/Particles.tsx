/* Ambient particle field (magicui Particles port): a canvas of slow-drifting
   motes that ease away from the pointer. Pure decoration — pointer-events
   none, aria-hidden, and skipped entirely for reduced-motion users.
   Color: the `color` prop, or — omitted — the live value of the
   --dsh-particles-ink token on body, re-resolved whenever the theme
   attribute flips, so the field follows the light/dark palette. */

import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import css from './Particles.module.css'

interface MousePosition {
  x: number
  y: number
}

function useMousePosition(): MousePosition {
  const [mousePosition, setMousePosition] = useState<MousePosition>({ x: 0, y: 0 })
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent): void => {
      setMousePosition({ x: event.clientX, y: event.clientY })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => { window.removeEventListener('mousemove', handleMouseMove) }
  }, [])
  return mousePosition
}

interface Circle {
  x: number
  y: number
  translateX: number
  translateY: number
  size: number
  alpha: number
  targetAlpha: number
  dx: number
  dy: number
  magnetism: number
}

function hexToRgb(hex: string): number[] {
  let value = hex.replace('#', '')
  if (value.length === 3) value = value.split('').map(char => char + char).join('')
  const hexInt = parseInt(value, 16)
  return [(hexInt >> 16) & 255, (hexInt >> 8) & 255, hexInt & 255]
}

/** Token carrying the particle ink per theme; the field reads it live. */
const THEME_VARIABLE = '--dsh-particles-ink'
/** Fallback when the token is unset (a hero-glow blue that reads in both schemes). */
const FALLBACK_COLOR = '#6187d8'

function resolveThemeColor(): string {
  const value = getComputedStyle(document.body).getPropertyValue(THEME_VARIABLE).trim()
  return value === '' ? FALLBACK_COLOR : value
}

/** Props of {@link Particles}. */
export interface ParticlesProps {
  /** Extra class for the positioning owner (the container fills its box). */
  className?: string | undefined
  /** Particle count. */
  quantity?: number | undefined
  /** How strongly particles resist the pointer (higher = calmer). */
  staticity?: number | undefined
  /** Pointer-follow easing (higher = lazier). */
  ease?: number | undefined
  /** Base particle radius in px. */
  size?: number | undefined
  /** Particle ink; defaults to the live --dsh-particles-ink body token. */
  color?: string | undefined
  /** Constant horizontal drift per frame. */
  vx?: number | undefined
  /** Constant vertical drift per frame. */
  vy?: number | undefined
}

/**
 * Render the ambient particle field.
 * @param props - see {@link ParticlesProps}.
 * @returns the canvas container, or nothing for reduced-motion users.
 */
export function Particles({ className, quantity = 90, staticity = 50, ease = 50, size = 0.4, color, vx = 0, vy = 0 }: ParticlesProps) {
  const reduceMotion = useReducedMotion()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const canvasContainerRef = useRef<HTMLDivElement | null>(null)
  const context = useRef<CanvasRenderingContext2D | null>(null)
  const circles = useRef<Circle[]>([])
  const mousePosition = useMousePosition()
  const mouse = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const canvasSize = useRef<{ w: number; h: number }>({ w: 0, h: 0 })
  const dpr = window.devicePixelRatio
  const rafID = useRef<number | null>(null)
  const resizeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initCanvasRef = useRef<() => void>(() => {})
  const onMouseMoveRef = useRef<() => void>(() => {})
  const animateRef = useRef<() => void>(() => {})

  // Theme-aware default color: resolve the body token and follow the theme
  // attribute so a light/dark flip re-inks the field.
  const [autoColor, setAutoColor] = useState<string | null>(null)
  useEffect(() => {
    if (color !== undefined) return
    const refresh = (): void => { setAutoColor(resolveThemeColor()) }
    refresh()
    const observer = new MutationObserver(refresh)
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] })
    return () => { observer.disconnect() }
  }, [color])
  const resolvedColor = color ?? autoColor ?? FALLBACK_COLOR

  useEffect(() => {
    if (canvasRef.current !== null) context.current = canvasRef.current.getContext('2d')
    initCanvasRef.current()
    animateRef.current()

    const handleResize = (): void => {
      if (resizeTimeout.current !== null) clearTimeout(resizeTimeout.current)
      resizeTimeout.current = setTimeout(() => { initCanvasRef.current() }, 200)
    }
    window.addEventListener('resize', handleResize)
    return () => {
      if (rafID.current !== null) window.cancelAnimationFrame(rafID.current)
      if (resizeTimeout.current !== null) clearTimeout(resizeTimeout.current)
      window.removeEventListener('resize', handleResize)
    }
  }, [resolvedColor])

  useEffect(() => {
    onMouseMoveRef.current()
  }, [mousePosition.x, mousePosition.y])

  /* v8 ignore start -- the drawing pipeline needs a real 2d context, which
     jsdom does not implement; exercised in the browser. */
  const resizeCanvas = (): void => {
    if (canvasContainerRef.current && canvasRef.current && context.current) {
      canvasSize.current.w = canvasContainerRef.current.offsetWidth
      canvasSize.current.h = canvasContainerRef.current.offsetHeight
      canvasRef.current.width = canvasSize.current.w * dpr
      canvasRef.current.height = canvasSize.current.h * dpr
      canvasRef.current.style.width = `${canvasSize.current.w}px`
      canvasRef.current.style.height = `${canvasSize.current.h}px`
      context.current.scale(dpr, dpr)
      circles.current = []
      for (let i = 0; i < quantity; i++) drawCircle(circleParams())
    }
  }

  const circleParams = (): Circle => {
    const x = Math.floor(Math.random() * canvasSize.current.w)
    const y = Math.floor(Math.random() * canvasSize.current.h)
    return {
      x,
      y,
      translateX: 0,
      translateY: 0,
      size: Math.floor(Math.random() * 2) + size,
      alpha: 0,
      targetAlpha: Number.parseFloat((Math.random() * 0.6 + 0.1).toFixed(1)),
      dx: (Math.random() - 0.5) * 0.1,
      dy: (Math.random() - 0.5) * 0.1,
      magnetism: 0.1 + Math.random() * 4,
    }
  }

  const rgb = hexToRgb(resolvedColor)

  const drawCircle = (circle: Circle, update = false): void => {
    if (context.current) {
      const { x, y, translateX, translateY, size: r, alpha } = circle
      context.current.translate(translateX, translateY)
      context.current.beginPath()
      context.current.arc(x, y, r, 0, 2 * Math.PI)
      context.current.fillStyle = `rgba(${rgb.join(', ')}, ${alpha})`
      context.current.fill()
      context.current.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (!update) circles.current.push(circle)
    }
  }

  const clearContext = (): void => {
    if (context.current) context.current.clearRect(0, 0, canvasSize.current.w, canvasSize.current.h)
  }

  const drawParticles = (): void => {
    clearContext()
    for (let i = 0; i < quantity; i++) drawCircle(circleParams())
  }

  const remapValue = (value: number, start1: number, end1: number, start2: number, end2: number): number => {
    const remapped = ((value - start1) * (end2 - start2)) / (end1 - start1) + start2
    return remapped > 0 ? remapped : 0
  }

  const animate = (): void => {
    clearContext()
    circles.current.forEach((circle, i) => {
      const edge = [
        circle.x + circle.translateX - circle.size,
        canvasSize.current.w - circle.x - circle.translateX - circle.size,
        circle.y + circle.translateY - circle.size,
        canvasSize.current.h - circle.y - circle.translateY - circle.size,
      ]
      const closestEdge = edge.reduce((a, b) => Math.min(a, b))
      const remapClosestEdge = Number.parseFloat(remapValue(closestEdge, 0, 20, 0, 1).toFixed(2))
      if (remapClosestEdge > 1) {
        circle.alpha += 0.02
        if (circle.alpha > circle.targetAlpha) circle.alpha = circle.targetAlpha
      } else {
        circle.alpha = circle.targetAlpha * remapClosestEdge
      }
      circle.x += circle.dx + vx
      circle.y += circle.dy + vy
      circle.translateX += (mouse.current.x / (staticity / circle.magnetism) - circle.translateX) / ease
      circle.translateY += (mouse.current.y / (staticity / circle.magnetism) - circle.translateY) / ease
      drawCircle(circle, true)
      if (
        circle.x < -circle.size
        || circle.x > canvasSize.current.w + circle.size
        || circle.y < -circle.size
        || circle.y > canvasSize.current.h + circle.size
      ) {
        circles.current.splice(i, 1)
        drawCircle(circleParams())
      }
    })
    rafID.current = window.requestAnimationFrame(animateRef.current)
  }
  /* v8 ignore stop -- canvas 2d pipeline (jsdom has no context). */

  const initCanvas = (): void => {
    resizeCanvas()
    drawParticles()
  }

  const onMouseMove = (): void => {
    if (canvasRef.current !== null) {
      const rect = canvasRef.current.getBoundingClientRect()
      const { w, h } = canvasSize.current
      const x = mousePosition.x - rect.left - w / 2
      const y = mousePosition.y - rect.top - h / 2
      const inside = x < w / 2 && x > -w / 2 && y < h / 2 && y > -h / 2
      /* v8 ignore next -- jsdom canvas size stays zero, so the pointer can
         never register inside; exercised in the browser. */
      if (inside) {
        mouse.current.x = x
        mouse.current.y = y
      }
    }
  }

  initCanvasRef.current = initCanvas
  onMouseMoveRef.current = onMouseMove
  animateRef.current = animate

  if (reduceMotion) return null
  return (
    <div className={className === undefined ? css.container : `${css.container} ${className}`} ref={canvasContainerRef} aria-hidden="true">
      <canvas ref={canvasRef} className={css.canvas} />
    </div>
  )
}
