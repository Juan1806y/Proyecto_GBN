/** Primitivas visuales compartidas: paneles, etiquetas, sliders y métricas. */

import type { ReactNode } from 'react'
import { cx } from '../lib/cx'

interface PanelProps {
  title?: ReactNode
  subtitle?: ReactNode
  aside?: ReactNode
  className?: string
  bodyClassName?: string
  children: ReactNode
}

export function Panel({ title, subtitle, aside, className, bodyClassName, children }: PanelProps) {
  return (
    <section
      className={cx(
        'rounded-2xl border border-white/10 bg-slate-900/50 shadow-lg shadow-black/30 backdrop-blur-sm',
        className,
      )}
    >
      {(title || aside) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div>
            {title && (
              <h2 className="text-[13px] font-semibold tracking-[0.14em] text-slate-200 uppercase">
                {title}
              </h2>
            )}
            {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
          </div>
          {aside}
        </header>
      )}
      <div className={cx('p-4', bodyClassName)}>{children}</div>
    </section>
  )
}

export function Tag({
  children,
  tone = 'slate',
  className,
}: {
  children: ReactNode
  tone?: 'slate' | 'sky' | 'emerald' | 'rose' | 'amber' | 'indigo'
  className?: string
}) {
  const tones = {
    slate: 'border-slate-500/40 bg-slate-500/10 text-slate-300',
    sky: 'border-sky-400/40 bg-sky-400/10 text-sky-200',
    emerald: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
    rose: 'border-rose-400/40 bg-rose-400/10 text-rose-200',
    amber: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
    indigo: 'border-indigo-400/40 bg-indigo-400/10 text-indigo-200',
  }
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Stat({
  label,
  value,
  hint,
  tone = 'slate',
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: 'slate' | 'sky' | 'emerald' | 'rose' | 'amber' | 'indigo'
}) {
  const tones = {
    slate: 'text-slate-100',
    sky: 'text-sky-300',
    emerald: 'text-emerald-300',
    rose: 'text-rose-300',
    amber: 'text-amber-300',
    indigo: 'text-indigo-300',
  }
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <div className="text-[10px] font-medium tracking-[0.12em] text-slate-400 uppercase">
        {label}
      </div>
      <div className={cx('font-mono text-lg leading-tight font-semibold', tones[tone])}>{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-slate-500">{hint}</div>}
    </div>
  )
}

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  format?: (value: number) => string
  hint?: ReactNode
  disabled?: boolean
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  hint,
  disabled,
}: SliderProps) {
  return (
    <label className={cx('block', disabled && 'opacity-50')}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-slate-300">{label}</span>
        <span className="font-mono text-xs font-semibold text-indigo-300">
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {hint && <p className="mt-1 text-[11px] leading-snug text-slate-500">{hint}</p>}
    </label>
  )
}

interface ButtonProps {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  title?: string
  variant?: 'primary' | 'ghost' | 'danger' | 'warning' | 'success'
  className?: string
}

export function Button({
  children,
  onClick,
  disabled,
  title,
  variant = 'ghost',
  className,
}: ButtonProps) {
  const variants = {
    primary:
      'border-indigo-400/60 bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/35 hover:border-indigo-300',
    ghost: 'border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/10 hover:border-white/25',
    danger: 'border-rose-400/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/25',
    warning: 'border-amber-400/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/25',
    success: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/25',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cx(
        'rounded-xl border px-3 py-2 text-sm font-medium transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-white/[0.02] disabled:text-slate-600',
        variants[variant],
        className,
      )}
    >
      {children}
    </button>
  )
}

/** Anillo de progreso usado por el temporizador del emisor. */
export function ProgressRing({
  fraction,
  size = 46,
  stroke = 5,
  color,
  children,
}: {
  fraction: number
  size?: number
  stroke?: number
  color: string
  children?: ReactNode
}) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(148,163,184,0.18)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - Math.min(1, Math.max(0, fraction)))}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}
