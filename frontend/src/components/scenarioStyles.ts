import type { ScenarioKind } from '../domain/scenario'

/** All scenario cases, in the order shown in the picker. */
export const KINDS: ScenarioKind[] = ['bull', 'base', 'bear', 'custom']

/** Badge classes per case (border + text + tint). */
export const kindBadge: Record<ScenarioKind, string> = {
  bull: 'text-emerald-700 border-emerald-600/40 bg-emerald-600/10',
  base: 'text-sky-700 border-sky-600/40 bg-sky-600/10',
  bear: 'text-rose-700 border-rose-600/40 bg-rose-600/10',
  custom: 'text-ink-400 border-ink-700 bg-ink-800/40',
}

/** Solid bar-fill class per case, for the comparison chart. */
export const kindBar: Record<ScenarioKind, string> = {
  bull: 'bg-emerald-500',
  base: 'bg-sky-500',
  bear: 'bg-red-500',
  custom: 'bg-ink-500',
}
