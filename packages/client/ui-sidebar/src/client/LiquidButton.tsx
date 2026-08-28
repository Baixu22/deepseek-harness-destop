import { forwardRef, type ButtonHTMLAttributes, type CSSProperties } from 'react'
import clsx from 'clsx'
import css from './LiquidButton.module.css'

export interface LiquidButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Hover starts the fill sweep at once; retracting waits this long, so the
   * liquid lingers before receding. */
  delay?: string
  /** Bottom line height the fill rests at while idle. */
  fillHeight?: string
  /** Hover scale factor. */
  hoverScale?: number
  /** Press scale factor. */
  tapScale?: number
}

/**
 * Render one liquid-fill button, ported from animate-ui's LiquidButton
 * (https://animate-ui.com/docs/primitives/buttons/liquid): an oversized
 * gradient sheet parks off-canvas at the bottom edge, hover snaps it to full
 * height and sweeps `background-position` across, and scale feedback rides a
 * single curve. The original drives the scale through motion's springs; this
 * port keeps the same visual with CSS transitions so no animation dependency
 * enters the sidebar.
 * @param props - fill tuning plus native button attributes and children.
 * @returns the button.
 */
export const LiquidButton = forwardRef<HTMLButtonElement, LiquidButtonProps>(function LiquidButton({
  delay = '0.3s',
  fillHeight = '3px',
  hoverScale = 1.05,
  tapScale = 0.95,
  className,
  style,
  type,
  children,
  ...rest
}, ref) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={clsx(css.liquid, className)}
      style={
        {
          '--liquid-delay': delay,
          '--liquid-fill-height': fillHeight,
          '--liquid-hover-scale': hoverScale,
          '--liquid-tap-scale': tapScale,
          ...style,
        } as CSSProperties
      }
      {...rest}
    >
      {children}
    </button>
  )
})
