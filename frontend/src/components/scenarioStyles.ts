import type { ScenarioKind } from '../domain/scenario'

/** All scenario cases, in the order shown in the picker. */
export const KINDS: ScenarioKind[] = ['bull', 'base', 'bear', 'custom']

/**
 * Minimalist status-dot colour per case — a small dot beside the label instead
 * of a filled pill. Warm palette, no blue.
 */
export const kindDot: Record<ScenarioKind, string> = {
  bull: 'bg-emerald-600',
  base: 'bg-stone-500',
  bear: 'bg-rose-600',
  custom: 'bg-stone-400',
}

/** Solid bar-fill class per case, for the comparison chart. */
export const kindBar: Record<ScenarioKind, string> = {
  bull: 'bg-emerald-500',
  base: 'bg-stone-500',
  bear: 'bg-rose-500',
  custom: 'bg-stone-400',
}
