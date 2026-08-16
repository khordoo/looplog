export const CONTENT_VERSION = 'v1'
export const MEDIA_VERIFIED_ON = '2026-08-16' as const

export type MovementPattern =
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'push-horizontal'
  | 'push-vertical'
  | 'pull-horizontal'
  | 'pull-apart'
  | 'arms'
  | 'core'
  | 'calves'
  | 'warmup'
  | 'mobility'
  | 'postural-control'
  | 'desk-reset'

export type Target =
  | { kind: 'reps'; min: number; max: number; perSide?: boolean }
  | { kind: 'seconds'; min: number; max: number; perSide?: boolean }

export interface ExerciseMedia {
  provider: 'youtube'
  videoId: string
  url: string
  title: string
  source: string
  verifiedOn: typeof MEDIA_VERIFIED_ON
  equipmentFit: '41-inch-loop-no-anchor' | 'bodyweight-no-anchor' | 'needs-replacement'
  lazy: true
  attribution: string
  fitNote: string
}

export interface Exercise {
  id: string
  contentVersion: typeof CONTENT_VERSION
  name: string
  category: MovementPattern
  movementPattern: MovementPattern
  setup: string[]
  steps: string[]
  breathingTempo: string
  primaryMuscles: string[]
  secondaryMuscles: string[]
  formCues: string[]
  commonMistakes: string[]
  easierVariations: string[]
  harderVariations: string[]
  bandWarnings: string[]
  compatibleSubstitutionCategories: MovementPattern[]
  defaultTarget: Target
  media: ExerciseMedia
}

export interface PlanSlot {
  id: string
  exerciseId: string
  target: Target
  /** Optional accessory performed with this primary slot without adding a primary slot. */
  accessory?: PlanAccessory
}

export interface PlanAccessory {
  exerciseId: string
  target: Target
}

export interface PlanPair {
  id: string
  slots: [PlanSlot, PlanSlot]
}

export interface WarmupItem {
  label: string
  seconds: number
}

export interface CooldownItem {
  label: string
  seconds: number
}

export interface PlanTemplate {
  id: 'A' | 'B' | 'C'
  contentVersion: typeof CONTENT_VERSION
  warmup: WarmupItem[]
  pairs: [PlanPair, PlanPair, PlanPair]
  cooldown: CooldownItem[]
  initialSets: 2
}

export interface DeskReset {
  id: 'desk-reset'
  contentVersion: typeof CONTENT_VERSION
  durationMinutes: 5
  progression: false
  items: string[]
}
