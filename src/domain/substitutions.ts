import type { Exercise, MovementCategory, PlanSlot } from './types'

export interface SubstitutionValidation {
  valid: boolean
  errors: string[]
}

type SubstitutionSource = Pick<Exercise, 'id' | 'category' | 'compatibleSubstitutionCategories'> | Pick<PlanSlot, 'exerciseId' | 'category' | 'compatibleSubstitutionCategories'>

function sourceId(source: SubstitutionSource): string {
  return 'id' in source ? source.id : source.exerciseId
}

export function isCompatibleSubstitution(source: SubstitutionSource, candidate: Exercise): boolean {
  return validateSubstitution(source, candidate).valid
}

export function validateSubstitution(source: SubstitutionSource, candidate: Exercise): SubstitutionValidation {
  const errors: string[] = []
  const allowed = source.compatibleSubstitutionCategories ?? [source.category]
  if (candidate.id === sourceId(source)) {
    return { valid: false, errors: ['Choose a different exercise for a substitution.'] }
  }
  if (!allowed.includes(candidate.category)) {
    errors.push(`This exercise is not compatible with the ${source.category} movement category.`)
  }
  if (candidate.compatibleSubstitutionCategories.length === 0) {
    errors.push('The selected exercise has no compatible movement category.')
  }
  return { valid: errors.length === 0, errors }
}

export function assertValidSubstitution(source: SubstitutionSource, candidate: Exercise): void {
  const result = validateSubstitution(source, candidate)
  if (!result.valid) throw new Error(result.errors.join(' '))
}

export function compatibleCategories(source: SubstitutionSource): MovementCategory[] {
  return [...(source.compatibleSubstitutionCategories ?? [source.category])]
}

