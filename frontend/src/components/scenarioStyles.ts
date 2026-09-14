import type { ScenarioKind } from '../domain/scenario'

/** All scenario cases, in the order shown in the picker. */
export const KINDS: ScenarioKind[] = ['bull', 'base', 'bear', 'custom']

/** Badge classes per case (border + text + tint). */
export const kindBadge: Record<ScenarioKind, string> = {
  bull: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  base: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
  bear: 'text-red-400 border-red-500/30 bg-red-500/10',
  custom: 'text-ink-400 border-ink-700 bg-ink-800/40',
}

/** Solid bar-fill class per case, for the comparison chart. */
export const kindBar: Record<ScenarioKind, string> = {
  bull: 'bg-emerald-500',
  base: 'bg-sky-500',
  bear: 'bg-red-500',
  custom: 'bg-ink-500',
}
