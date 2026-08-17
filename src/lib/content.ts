import { exercises as sourceExercises } from '../content/exercises'
import { planTemplates, workingSlots } from '../content/plans'
import type { Exercise as DomainExercise, PlanSlot, PlanTemplate as DomainPlan, TargetSnapshot, WorkoutKey } from '../domain/types'
import { DEFAULT_REST_SECONDS } from '../domain/types'
import type { Exercise as SourceExercise, Target } from '../content/types'

const STATIC_META = '2000-01-01T00:00:00.000Z'

function targetSnapshot(target: Target): TargetSnapshot {
  return target.kind === 'seconds'
    ? { sets: 2, durationSeconds: { min: target.min, max: target.max }, bandKeys: [], restSeconds: DEFAULT_REST_SECONDS, source: 'default' }
    : { sets: 2, repRange: { min: target.min, max: target.max }, bandKeys: [], restSeconds: DEFAULT_REST_SECONDS, source: 'default' }
}

function domainExercise(source: SourceExercise): DomainExercise {
  return {
    id: source.id,
    contentVersion: source.contentVersion,
    name: source.name,
    category: source.category === 'mobility' || source.category === 'postural-control' ? 'desk-reset' : source.category,
    setup: source.setup,
    steps: source.steps,
    breathingTempo: source.breathingTempo,
    primaryMuscles: source.primaryMuscles,
    secondaryMuscles: source.secondaryMuscles,
    formCues: source.formCues,
    commonMistakes: source.commonMistakes,
    easierVariations: source.easierVariations,
    harderVariations: source.harderVariations,
    bandWarnings: source.bandWarnings,
    compatibleSubstitutionCategories: source.compatibleSubstitutionCategories.map((category) => category === 'mobility' || category === 'postural-control' ? 'desk-reset' : category),
    defaultTarget: targetSnapshot(source.defaultTarget),
    media: {
      provider: 'youtube',
      videoId: source.media.videoId,
      title: source.media.title,
      sourceName: source.media.source,
      sourceUrl: source.media.url,
      verifiedAt: `${source.media.verifiedOn}T00:00:00.000Z`,
      loopBandNoAnchor: true,
    },
    createdAt: STATIC_META,
    updatedAt: STATIC_META,
  }
}

export const exercises: DomainExercise[] = sourceExercises.map(domainExercise)

function categoryFor(id: string): DomainExercise['category'] {
  return exerciseById(id)?.category ?? 'core'
}

function toSlot(workoutKey: WorkoutKey, slot: ReturnType<typeof workingSlots>[number], order: number, accessory = false): PlanSlot {
  const target = slot.target
  const base = {
    id: accessory ? `${slot.id}-accessory` : slot.id,
    workoutKey,
    order,
    exerciseId: slot.exerciseId,
    category: categoryFor(slot.exerciseId),
    ...(accessory ? { pairId: slot.id } : {}),
    isAccessory: accessory,
    defaultSets: 2,
    restSeconds: DEFAULT_REST_SECONDS,
    startingResistance: 'band' as const,
    compatibleSubstitutionCategories: exerciseById(slot.exerciseId)?.compatibleSubstitutionCategories,
  }
  return target.kind === 'seconds'
    ? { ...base, durationSeconds: { min: target.min, max: target.max } }
    : { ...base, repRange: { min: target.min, max: target.max } }
}

function runtimeSlots(workoutKey: WorkoutKey): PlanSlot[] {
  const sourceSlots = workingSlots(planTemplates[workoutKey])
  const result: PlanSlot[] = []
  for (const sourceSlot of sourceSlots) {
    result.push(toSlot(workoutKey, sourceSlot, result.length))
    if (sourceSlot.accessory) {
      const accessorySlot = {
        ...sourceSlot,
        exerciseId: sourceSlot.accessory.exerciseId,
        target: sourceSlot.accessory.target,
      }
      result.push(toSlot(workoutKey, accessorySlot, result.length, true))
    }
  }
  return result
}

export const exerciseById = (id: string) => exercises.find((exercise) => exercise.id === id)

function buildPlan(workoutKey: WorkoutKey): DomainPlan {
  const source = planTemplates[workoutKey]
  const sourceSlots = runtimeSlots(workoutKey)
  return { version: source.contentVersion, warmupMinutes: 4, cooldownMinutes: Math.max(1, Math.round(source.cooldown.reduce((sum, item) => sum + item.seconds, 0) / 60)), workouts: { A: workoutKey === 'A' ? sourceSlots : [], B: workoutKey === 'B' ? sourceSlots : [], C: workoutKey === 'C' ? sourceSlots : [] } }
}

export const plans: Record<WorkoutKey, DomainPlan> = { A: buildPlan('A'), B: buildPlan('B'), C: buildPlan('C') }
export const plan: DomainPlan = { version: 'v1', warmupMinutes: 4, cooldownMinutes: 2, workouts: { A: plans.A.workouts.A, B: plans.B.workouts.B, C: plans.C.workouts.C } }
export function slotsFor(workoutKey: WorkoutKey): PlanSlot[] { return plan.workouts[workoutKey] }
