import type { Band, ISOInstant } from './types'

export const DEFAULT_SERIOUS_STEEL_BANDS = [
  { key: 'serious-steel-1', brand: 'Serious Steel', number: 1, displayColor: 'purple', nominalMinLb: 5, nominalMaxLb: 35 },
  { key: 'serious-steel-2', brand: 'Serious Steel', number: 2, displayColor: 'red', nominalMinLb: 10, nominalMaxLb: 50 },
  { key: 'serious-steel-3', brand: 'Serious Steel', number: 3, displayColor: 'blue', nominalMinLb: 25, nominalMaxLb: 80 },
  { key: 'serious-steel-4', brand: 'Serious Steel', number: 4, displayColor: 'green', nominalMinLb: 50, nominalMaxLb: 120 },
] as const

export function createDefaultBands(now: ISOInstant = new Date().toISOString()): Band[] {
  return DEFAULT_SERIOUS_STEEL_BANDS.map((band) => ({
    ...band,
    id: band.key,
    lengthInches: 41,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  }))
}

export const defaultBands = createDefaultBands

