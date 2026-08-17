import { exerciseById, plans } from '../lib/content'
import type { PlanConfiguration, PlanSlot, ResolvedPlan, Substitution, TargetSnapshot, WorkoutKey } from './types'
import { DEFAULT_REST_SECONDS, normalizePlanSlot, targetSnapshotFromPlanSlot } from './types'

function clone<T>(value: T): T {
  return structuredClone(value)
}

function targetForExercise(exerciseId: string, fallback: PlanSlot): Pick<PlanSlot, 'repRange' | 'durationSeconds' | 'category' | 'startingResistance' | 'compatibleSubstitutionCategories'> {
  const exercise = exerciseById(exerciseId)
  const target = exercise?.defaultTarget
  if (!exercise || !target) return {
    repRange: fallback.repRange,
    durationSeconds: fallback.durationSeconds,
    category: fallback.category,
    startingResistance: fallback.startingResistance,
    compatibleSubstitutionCategories: fallback.compatibleSubstitutionCategories,
  }
  return {
    ...(target.durationSeconds ? { durationSeconds: { ...target.durationSeconds } } : { repRange: target.repRange ? { ...target.repRange } : undefined }),
    category: exercise.category,
    startingResistance: exercise.bandWarnings.some((warning) => /band/i.test(warning)) ? 'band' : 'bodyweight',
    compatibleSubstitutionCategories: exercise.compatibleSubstitutionCategories,
  }
}

function applySubstitutions(slots: PlanSlot[], substitutions: readonly Substitution[]): PlanSlot[] {
  const bySlot = new Map(substitutions.map((substitution) => [substitution.planSlotId, substitution]))
  return slots.map((input) => {
    const slot = normalizePlanSlot(input)
    if (slot.isAccessory) return slot
    const substitution = bySlot.get(slot.id)
    if (!substitution || substitution.selectedExerciseId === slot.exerciseId) return slot
    const selected = targetForExercise(substitution.selectedExerciseId, slot)
    return normalizePlanSlot({
      ...slot,
      exerciseId: substitution.selectedExerciseId,
      ...selected,
    })
  })
}

export function builtInPlanSlots(workoutKey: WorkoutKey): PlanSlot[] {
  return plans[workoutKey].workouts[workoutKey].map((slot) => normalizePlanSlot(slot))
}

/** Materialize one editable configuration from immutable content and legacy substitutions. */
export function materializePlanConfiguration(
  workoutKey: WorkoutKey,
  substitutions: readonly Substitution[] = [],
  now = new Date().toISOString(),
): PlanConfiguration {
  const source = plans[workoutKey]
  const slots = applySubstitutions(builtInPlanSlots(workoutKey), substitutions)
  return {
    id: workoutKey,
    workoutKey,
    revision: 1,
    sourceVersion: source.version,
    slots,
    warmupMinutes: source.warmupMinutes,
    cooldownMinutes: source.cooldownMinutes,
    createdAt: now,
    updatedAt: now,
  }
}

export function planVersionFor(configuration: Pick<PlanConfiguration, 'workoutKey' | 'sourceVersion' | 'revision'>): string {
  return `${configuration.sourceVersion}:${configuration.workoutKey}:${configuration.revision}`
}

/** Resolve persisted configuration when present; otherwise retain legacy substitutions in the ephemeral default. */
export function resolvePlanConfiguration(
  workoutKey: WorkoutKey,
  configuration: PlanConfiguration | undefined,
  substitutions: readonly Substitution[] = [],
): ResolvedPlan {
  if (configuration) {
    return {
      workoutKey,
      version: planVersionFor(configuration),
      slots: configuration.slots.map(normalizePlanSlot).sort((a, b) => a.order - b.order).map(clone),
      warmupMinutes: configuration.warmupMinutes,
      cooldownMinutes: configuration.cooldownMinutes,
      configuration: clone(configuration),
    }
  }
  const materialized = materializePlanConfiguration(workoutKey, substitutions)
  return {
    workoutKey,
    version: `${materialized.sourceVersion}:${workoutKey}:default`,
    slots: materialized.slots.map(clone),
    warmupMinutes: materialized.warmupMinutes,
    cooldownMinutes: materialized.cooldownMinutes,
  }
}

export function targetSnapshotForSlot(slot: PlanSlot, source: TargetSnapshot['source'] = 'default'): TargetSnapshot {
  return targetSnapshotFromPlanSlot(normalizePlanSlot(slot), source)
}

export function targetKindForSlot(slot: PlanSlot): 'reps' | 'duration' {
  return slot.durationSeconds ? 'duration' : 'reps'
}

export function validatePlanConfigurationSlots(configuration: PlanConfiguration): string[] {
  const errors: string[] = []
  const seenIds = new Set<string>()
  const seenOrders = new Set<number>()
  configuration.slots.forEach((slot, index) => {
    if (seenIds.has(slot.id)) errors.push(`Slot ${index + 1} has a duplicate id.`)
    seenIds.add(slot.id)
    if (seenOrders.has(slot.order)) errors.push(`Slot ${slot.id} has a duplicate order.`)
    seenOrders.add(slot.order)
    if (!Number.isInteger(slot.defaultSets) || slot.defaultSets <= 0) errors.push(`Slot ${slot.id} must have positive sets.`)
    if (!Number.isInteger(slot.restSeconds ?? DEFAULT_REST_SECONDS) || (slot.restSeconds ?? DEFAULT_REST_SECONDS) <= 0) errors.push(`Slot ${slot.id} must have positive rest.`)
    if (!slot.repRange && !slot.durationSeconds) errors.push(`Slot ${slot.id} needs a rep or duration range.`)
    if (slot.repRange && slot.durationSeconds) errors.push(`Slot ${slot.id} cannot use reps and duration together.`)
  })
  return errors
}

export function normalizePlanConfiguration(configuration: PlanConfiguration): PlanConfiguration {
  const normalized: PlanConfiguration = {
    ...configuration,
    slots: configuration.slots.map(normalizePlanSlot).sort((a, b) => a.order - b.order),
  }
  const errors = validatePlanConfigurationSlots(normalized)
  if (errors.length) throw new Error(errors.join(' '))
  return normalized
}
