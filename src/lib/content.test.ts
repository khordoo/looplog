import { describe, expect, it } from 'vitest'
import { slotsFor } from './content'

describe('runtime workout content', () => {
  it('flattens C-5 calf accessory without changing the six primary slots', () => {
    const slots = slotsFor('C')
    expect(slots.filter((slot) => !slot.isAccessory)).toHaveLength(6)
    expect(slots.map((slot) => slot.id)).toEqual(['C-1', 'C-2', 'C-3', 'C-4', 'C-5', 'C-5-accessory', 'C-6'])
    expect(slots[4]).toMatchObject({ id: 'C-5', exerciseId: 'upper-curl-band' })
    expect(slots[5]).toMatchObject({ id: 'C-5-accessory', exerciseId: 'lower-calf-raise', pairId: 'C-5', isAccessory: true })
    expect(slots[6].exerciseId).toBe('core-bird-dog')
  })
})
