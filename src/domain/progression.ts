import type {
  EffortRating,
  Exercise,
  ExercisePerformance,
  ExercisePerformanceSet,
  RepRange,
  TargetSnapshot,
  WorkoutRecommendation,
} from './types'

export interface ProgressionInput {
  exercise: Exercise
  previousPerformances: ExercisePerformance[]
  currentTarget?: TargetSnapshot
}

function targetFor(exercise: Exercise, currentTarget?: TargetSnapshot): TargetSnapshot {
  return currentTarget ? cloneTarget(currentTarget) : cloneTarget(exercise.defaultTarget)
}

function cloneTarget(target: TargetSnapshot): TargetSnapshot {
  return {
    ...target,
    repRange: target.repRange ? { ...target.repRange } : undefined,
    durationSeconds: target.durationSeconds ? { ...target.durationSeconds } : undefined,
    bandKeys: [...target.bandKeys],
    source: 'recommendation',
  }
}

function effortQualifies(effort: EffortRating): boolean {
  return effort === 'easy' || effort === 'just-right'
}

function rangeFor(target: TargetSnapshot): RepRange {
  return target.repRange ?? target.durationSeconds ?? { min: 0, max: 0 }
}

function valueFor(set: ExercisePerformanceSet, target: TargetSnapshot): number | undefined {
  return target.repRange ? set.reps : set.durationSeconds
}

export function performanceAtTop(performance: ExercisePerformance): boolean {
  const range = rangeFor(performance.target)
  const sets = performance.sets.slice(0, performance.target.sets)
  return sets.length >= performance.target.sets
    && sets.every((set) => {
      const value = valueFor(set, performance.target)
      return value !== undefined && value >= range.max && effortQualifies(set.effort)
    })
}

export function performanceBelowMinimum(performance: ExercisePerformance): boolean {
  const range = rangeFor(performance.target)
  const sets = performance.sets.slice(0, performance.target.sets)
  return sets.length < performance.target.sets
    || sets.some((set) => {
      const value = valueFor(set, performance.target)
      return value === undefined || value < range.min
    })
}

export function performanceFormBroke(performance: ExercisePerformance): boolean {
  return performance.sets.some((set) => set.effort === 'form-broke')
}

function sameResistance(a: ExercisePerformance, b: ExercisePerformance): boolean {
  return a.target.setupAdjustment === b.target.setupAdjustment
    && a.target.bandKeys.length === b.target.bandKeys.length
    && a.target.bandKeys.every((key, index) => key === b.target.bandKeys[index])
}

function maxObservedValue(performance: ExercisePerformance): number {
  const values = performance.sets
    .map((set) => valueFor(set, performance.target))
    .filter((value): value is number => value !== undefined)
  return values.length ? Math.max(...values) : rangeFor(performance.target).min
}

function withSuggestedValue(target: TargetSnapshot, suggested: number): TargetSnapshot {
  return target.repRange || target.durationSeconds
    ? { ...target, suggestedReps: suggested }
    : target
}

function recommendation(
  exercise: Exercise,
  kind: WorkoutRecommendation['kind'],
  target: TargetSnapshot,
  rationale: string,
): WorkoutRecommendation {
  return { exerciseId: exercise.id, kind, proposedTarget: target, rationale, requiresConfirmation: true }
}

/**
 * Apply the plan's double-progression rule to the most recent performances.
 * The array is expected newest first; sorting is intentionally left to the
 * storage adapter so this function remains independent of persistence.
 */
export function recommendNextTarget(input: ProgressionInput): WorkoutRecommendation {
  const { exercise, previousPerformances } = input
  const target = targetFor(exercise, input.currentTarget)
  const latest = previousPerformances[0]
  if (!latest) {
    return recommendation(exercise, 'maintain', target, 'Start with the default target and confirm a comfortable setup.')
  }

  if (performanceFormBroke(latest)) {
    return recommendation(
      exercise,
      'regression',
      withSuggestedValue(target, rangeFor(target).min),
      'Form broke on the previous performance; use an easier defined variation before adding resistance.',
    )
  }

  if (latest.sets.some((set) => set.effort === 'max-effort')) {
    return recommendation(
      exercise,
      'maintain',
      target,
      'The previous performance reached max effort; keep the confirmed target until it feels controlled.',
    )
  }

  if (performanceBelowMinimum(latest)) {
    const kind = target.bandKeys.length > 0 ? 'easier-setup' : 'reduce-reps'
    return recommendation(
      exercise,
      kind,
      withSuggestedValue(target, rangeFor(target).min),
      target.bandKeys.length > 0
        ? 'The minimum target was not completed; use an easier band or setup and keep clean form.'
        : 'The minimum target was not completed; reduce the rep or duration target while keeping clean form.',
    )
  }

  const latestAtTop = performanceAtTop(latest)
  const previous = previousPerformances[1]
  const twoConsecutiveAtTop = latestAtTop
    && previous !== undefined
    && performanceAtTop(previous)
    && sameResistance(latest, previous)

  if (twoConsecutiveAtTop) {
    if (target.sets < 3) {
      return recommendation(
        exercise,
        'add-set',
        { ...target, sets: target.sets + 1 },
        'Two consecutive clean performances reached the top of the range; confirm adding a third set.',
      )
    }
    return recommendation(
      exercise,
      'harder-setup',
      {
        ...target,
        progressionCue: target.bandKeys.length > 0
          ? 'Use the next heavier enabled band or a shorter grip; keep the same rep range.'
          : 'Use a harder defined variation or add controlled resistance; keep the same rep range.',
      },
      target.bandKeys.length > 0
        ? 'Two consecutive clean performances reached the top of the range; confirm the next heavier enabled band or a shorter grip. The app will not select a band for you.'
        : 'Two consecutive clean performances reached the top of the range; confirm a harder defined variation or controlled resistance. The app will not select a band for you.',
    )
  }

  if (latestAtTop) {
    return recommendation(
      exercise,
      'maintain',
      withSuggestedValue(target, rangeFor(target).max),
      'You reached the top of the range once; repeat it with clean form before progressing.',
    )
  }

  const range = rangeFor(target)
  const nextValue = Math.min(range.max, Math.max(range.min, maxObservedValue(latest) + 1))
  return recommendation(
    exercise,
    'increase-reps',
    withSuggestedValue(target, nextValue),
    'Keep the same resistance and add a clean rep or small duration increment within the target range.',
  )
}

export const calculateRecommendation = recommendNextTarget
export const getNextRecommendation = recommendNextTarget
