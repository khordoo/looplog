import { exerciseById } from './exercises'
import type { DeskReset, MovementPattern, PlanAccessory, PlanPair, PlanSlot, PlanTemplate, Target } from './types'
import { CONTENT_VERSION } from './types'

const reps = (min: number, max: number, perSide = false): Target => ({ kind: 'reps', min, max, ...(perSide ? { perSide: true } : {}) })
const seconds = (min: number, max: number): Target => ({ kind: 'seconds', min, max })
const slot = (id: string, exerciseId: string, target: Target, accessory?: PlanAccessory): PlanSlot => ({ id, exerciseId, target, ...(accessory ? { accessory } : {}) })
const pair = (id: string, first: PlanSlot, second: PlanSlot): PlanPair => ({ id, slots: [first, second] })

const warmup = [
  { label: 'Easy march in place', seconds: 60 },
  { label: 'Bodyweight squat to comfortable depth', seconds: 60 },
  { label: 'Shoulder-blade retractions and arm circles', seconds: 60 },
  { label: 'Hip hinge rehearsal with relaxed breathing', seconds: 60 },
] as const

const cooldown = [
  { label: 'Easy breathing and walk around', seconds: 30 },
  { label: 'Half-kneeling hip-flexor stretch', seconds: 30 },
  { label: 'Book opener / thoracic rotation', seconds: 30 },
] as const

export const planTemplates: Readonly<Record<'A' | 'B' | 'C', PlanTemplate>> = {
  A: {
    id: 'A', contentVersion: CONTENT_VERSION, warmup: [...warmup], initialSets: 2, cooldown: [...cooldown],
    pairs: [
      pair('A-1-A-2', slot('A-1', 'lower-front-squat-band', reps(8, 12)), slot('A-2', 'upper-row-seated-feet', reps(8, 12))),
      pair('A-3-A-4', slot('A-3', 'lower-rdl-band', reps(8, 12)), slot('A-4', 'upper-pushup-band', reps(6, 10))),
      pair('A-5-A-6', slot('A-5', 'upper-press-overhead-band', reps(8, 12)), slot('A-6', 'core-dead-bug', reps(6, 10, true))),
    ],
  },
  B: {
    id: 'B', contentVersion: CONTENT_VERSION, warmup: [...warmup], initialSets: 2, cooldown: [...cooldown],
    pairs: [
      pair('B-1-B-2', slot('B-1', 'lower-reverse-lunge', reps(6, 10, true)), slot('B-2', 'upper-floor-press-band', reps(8, 12))),
      pair('B-3-B-4', slot('B-3', 'lower-good-morning-band', reps(8, 12)), slot('B-4', 'upper-row-bentover-band', reps(8, 12))),
      pair('B-5-B-6', slot('B-5', 'upper-pull-apart-band', reps(8, 15)), slot('B-6', 'core-side-plank', seconds(15, 30))),
    ],
  },
  C: {
    id: 'C', contentVersion: CONTENT_VERSION, warmup: [...warmup], initialSets: 2, cooldown: [...cooldown],
    pairs: [
      pair('C-1-C-2', slot('C-1', 'lower-split-squat', reps(6, 10, true)), slot('C-2', 'upper-pushup-band', reps(6, 10))),
      pair('C-3-C-4', slot('C-3', 'lower-single-leg-rdl-supported', reps(6, 10, true)), slot('C-4', 'upper-row-seated-feet', reps(8, 12))),
      pair('C-5-C-6', slot('C-5', 'upper-curl-band', reps(8, 12), { exerciseId: 'lower-calf-raise', target: reps(10, 15) }), slot('C-6', 'core-bird-dog', reps(6, 10, true))),
    ],
  },
}

export const deskReset: DeskReset = {
  id: 'desk-reset', contentVersion: CONTENT_VERSION, durationMinutes: 5, progression: false,
  items: ['reset-march', 'reset-thoracic-rotation', 'reset-hip-flexor-stretch', 'reset-scapular-setting', 'reset-bodyweight-squat'],
}

export const resolvePlan = (daysPerWeek: 2 | 3): PlanTemplate[] => daysPerWeek === 2
  ? [planTemplates.A, planTemplates.B]
  : [planTemplates.A, planTemplates.B, planTemplates.C]

export const workingSlots = (plan: PlanTemplate): PlanSlot[] => plan.pairs.flatMap((workPair) => workPair.slots)

export const planSlotIds = (plan: PlanTemplate): string[] => workingSlots(plan).map((workSlot) => workSlot.id)

export const primarySlotIds = planSlotIds

/** All exercise definitions used by a workout, including an accessory on a primary slot. */
export const referencedExerciseIds = (plan: PlanTemplate): string[] => workingSlots(plan).flatMap((workSlot) => [workSlot.exerciseId, ...(workSlot.accessory ? [workSlot.accessory.exerciseId] : [])])

export const primaryExerciseIds = (plan: PlanTemplate): string[] => workingSlots(plan).map((workSlot) => workSlot.exerciseId)

/** Kept as the public plan exercise helper; it includes accessory definitions. */
export const planExerciseIds = referencedExerciseIds

export const resolvePlanExercises = (plan: PlanTemplate) => referencedExerciseIds(plan).map((id) => exerciseById[id]).filter((exercise): exercise is NonNullable<typeof exercise> => Boolean(exercise))

export const resolveReferencedExercises = resolvePlanExercises

export const unresolvedPlanExerciseIds = (plan: PlanTemplate): string[] => [...new Set(referencedExerciseIds(plan).filter((id) => !exerciseById[id]))]

export const planReferencesResolve = (plan: PlanTemplate): boolean => unresolvedPlanExerciseIds(plan).length === 0

export const planPatterns = (plan: PlanTemplate): MovementPattern[] => [...new Set(planExerciseIds(plan).map((id) => exerciseById[id]?.movementPattern).filter((pattern): pattern is MovementPattern => Boolean(pattern)))]

export const allWorkingExerciseIds = [...new Set(resolvePlan(3).flatMap(planExerciseIds))]

export const workoutPlans = planTemplates
export const DESK_RESET = deskReset
