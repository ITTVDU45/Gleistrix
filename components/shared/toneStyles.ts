/**
 * Zentrale Tonalitäts-Styles für Agenten- und Report-Komponenten.
 * Hält Farbgebung konsistent zum bestehenden Designsystem (Tailwind + Dark Mode).
 */

export type Tone = 'default' | 'positive' | 'warning' | 'critical' | 'info'

interface ToneStyle {
  /** Icon-Container (Ring + Hintergrund) */
  chip: string
  /** Icon-/Akzentfarbe */
  accent: string
  /** dezenter Badge-Hintergrund */
  badge: string
  /** Balken-/Fortschrittsfarbe */
  bar: string
}

const TONE_STYLES: Record<Tone, ToneStyle> = {
  default: {
    chip: 'bg-slate-50 ring-slate-100 dark:bg-slate-700/40 dark:ring-slate-700',
    accent: 'text-slate-600 dark:text-slate-300',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
    bar: 'bg-slate-400 dark:bg-slate-500',
  },
  positive: {
    chip: 'bg-emerald-50 ring-emerald-100 dark:bg-emerald-900/30 dark:ring-emerald-800',
    accent: 'text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    bar: 'bg-emerald-500',
  },
  warning: {
    chip: 'bg-amber-50 ring-amber-100 dark:bg-amber-900/30 dark:ring-amber-800',
    accent: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    bar: 'bg-amber-500',
  },
  critical: {
    chip: 'bg-red-50 ring-red-100 dark:bg-red-900/30 dark:ring-red-800',
    accent: 'text-red-600 dark:text-red-400',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    bar: 'bg-red-500',
  },
  info: {
    chip: 'bg-blue-50 ring-blue-100 dark:bg-blue-900/30 dark:ring-blue-800',
    accent: 'text-blue-600 dark:text-blue-400',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    bar: 'bg-blue-500',
  },
}

export function toneStyle(tone: Tone = 'default'): ToneStyle {
  return TONE_STYLES[tone] ?? TONE_STYLES.default
}
