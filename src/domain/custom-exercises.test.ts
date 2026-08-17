import { describe, expect, it } from 'vitest'
import { createCustomExercise, customExerciseToExercise, parseYouTubeUrl, validateCustomPhotoDataUrl } from './custom-exercises'

const now = '2026-08-17T12:00:00.000Z'
const id = '11111111-1111-4111-8111-111111111111'

describe('custom exercise content', () => {
  it('parses ordinary YouTube watch and short URLs without network access', () => {
    expect(parseYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s')).toMatchObject({ videoId: 'dQw4w9WgXcQ', host: 'youtube.com' })
    expect(parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toMatchObject({ videoId: 'dQw4w9WgXcQ', host: 'youtu.be' })
    expect(parseYouTubeUrl('https://example.com/watch?v=dQw4w9WgXcQ')).toBeUndefined()
  })

  it('validates local WebP data URLs and adapts custom content to the exercise read model', () => {
    const photo = 'data:image/webp;base64,UklGRg=='
    expect(validateCustomPhotoDataUrl(photo)).toBe(true)
    const custom = createCustomExercise({
      name: 'My split squat', category: 'lunge', targetKind: 'reps', targetRange: { min: 6, max: 10 }, sets: 3,
      setup: ['Stand near a support'], steps: ['Lower with control'], formCues: ['Front heel heavy'], photoDataUrl: photo,
      youtube: parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ'), archived: false,
    }, now, id)
    expect(custom.id).toBe(id)
    expect(customExerciseToExercise(custom).defaultTarget).toMatchObject({ sets: 3, repRange: { min: 6, max: 10 } })
    expect(customExerciseToExercise(custom).media?.videoId).toBe('dQw4w9WgXcQ')
  })

  it('rejects non-UUID custom identifiers and non-WebP photos', () => {
    expect(() => createCustomExercise({ name: 'Bad', category: 'core', targetKind: 'duration', targetRange: { min: 10, max: 20 }, sets: 1, setup: [], steps: [], formCues: [], archived: false }, now, 'custom-1')).toThrow(/UUID/i)
    expect(validateCustomPhotoDataUrl('data:image/png;base64,UklGRg==')).toBe(false)
  })
})
