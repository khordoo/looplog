import { describe, expect, it } from 'vitest'
import { createDefaultBands } from './bands'

describe('default band inventory', () => {
  it('creates the four configured 41-inch Serious Steel bands', () => {
    const bands = createDefaultBands('2026-01-01T00:00:00.000Z')
    expect(bands).toHaveLength(4)
    expect(bands.map((band) => [band.number, band.displayColor, band.nominalMinLb, band.nominalMaxLb])).toEqual([
      [1, 'purple', 5, 35], [2, 'red', 10, 50], [3, 'blue', 25, 80], [4, 'green', 50, 120],
    ])
    expect(new Set(bands.map((band) => band.key)).size).toBe(4)
    expect(bands.every((band) => band.lengthInches === 41 && band.enabled)).toBe(true)
  })
})

