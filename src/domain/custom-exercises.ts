import { customExerciseSchema, type CustomExercise, type Exercise, type NewCustomExercise, type RepRange, type YouTubeMetadata } from './types'

export const MAX_CUSTOM_PHOTO_BYTES = 1_500_000

function clone<T>(value: T): T {
  return structuredClone(value)
}

/** Parse only ordinary watch and short YouTube URLs; no network request is made. */
export function parseYouTubeUrl(input: string): YouTubeMetadata | undefined {
  const value = input.trim()
  if (!value) return undefined
  let url: URL
  try { url = new URL(value) } catch { return undefined }
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  let videoId: string | undefined
  if (host === 'youtu.be') videoId = url.pathname.split('/').filter(Boolean)[0]
  else if (host === 'youtube.com' || host === 'm.youtube.com') {
    if (url.pathname === '/watch') videoId = url.searchParams.get('v') ?? undefined
    else if (/^\/(shorts|embed)\//.test(url.pathname)) videoId = url.pathname.split('/')[2]
  }
  if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) return undefined
  return { videoId, sourceUrl: value, host: host === 'youtu.be' ? 'youtu.be' : 'youtube.com' }
}

export function validateCustomPhotoDataUrl(value: string): boolean {
  if (!/^data:image\/webp;base64,[A-Za-z0-9+/]+=*$/.test(value)) return false
  const comma = value.indexOf(',')
  return comma >= 0 && Math.floor((value.length - comma - 1) * 3 / 4) <= MAX_CUSTOM_PHOTO_BYTES
}

export function validateCustomExercise(input: unknown): CustomExercise {
  const parsed = customExerciseSchema.safeParse(input)
  if (!parsed.success) throw new Error(`Custom exercise validation failed: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`)
  return clone(parsed.data)
}

export function createCustomExercise(input: NewCustomExercise, now: string, id: string): CustomExercise {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new Error('Custom exercise identifiers must be UUIDs.')
  return validateCustomExercise({ ...input, id, createdAt: now, updatedAt: now })
}

/** Adapt local records to the same read model used by built-in exercise content. */
export function customExerciseToExercise(custom: CustomExercise): Exercise {
  const target: Exercise['defaultTarget'] = custom.targetKind === 'duration'
    ? { sets: custom.sets, durationSeconds: { ...custom.targetRange }, restSeconds: 60, bandKeys: [], source: 'default' }
    : { sets: custom.sets, repRange: { ...custom.targetRange }, restSeconds: 60, bandKeys: [], source: 'default' }
  return {
    id: custom.id,
    contentVersion: `custom:${custom.updatedAt}`,
    name: custom.name,
    category: custom.category,
    setup: [...custom.setup],
    steps: [...custom.steps],
    breathingTempo: 'Breathe steadily and stop if form becomes unsafe.',
    primaryMuscles: [],
    secondaryMuscles: [],
    formCues: [...custom.formCues],
    commonMistakes: [],
    easierVariations: [],
    harderVariations: [],
    bandWarnings: [],
    compatibleSubstitutionCategories: [custom.category],
    defaultTarget: target,
    photoDataUrl: custom.photoDataUrl,
    isCustom: true,
    archived: custom.archived,
    ...(custom.youtube ? {
      media: {
        provider: 'youtube' as const,
        videoId: custom.youtube.videoId,
        title: custom.name,
        sourceName: 'YouTube',
        sourceUrl: custom.youtube.sourceUrl,
        verifiedAt: custom.updatedAt,
        loopBandNoAnchor: true as const,
      },
    } : {}),
    createdAt: custom.createdAt,
    updatedAt: custom.updatedAt,
  }
}

export function targetRangeForCustom(custom: CustomExercise): RepRange {
  return { ...custom.targetRange }
}
