import { z } from 'zod'

export type UUID = string
export type ISOInstant = string
export type LocalDate = `${number}-${number}-${number}`
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6
export type WorkoutKey = 'A' | 'B' | 'C'
export type ScheduleMode = 'flexible' | 'fixed'
export type SessionStatus = 'planned' | 'in-progress' | 'completed' | 'skipped'
export type WorkoutPhase = 'warmup' | 'working' | 'cooldown'
export type EffortRating = z.infer<typeof effortRatingSchema>
export type MovementCategory = z.infer<typeof movementCategorySchema>
export type SetupAdjustment = z.infer<typeof setupAdjustmentSchema>

export const effortRatingSchema = z.enum(['easy', 'just-right', 'max-effort', 'form-broke'])
export const movementCategorySchema = z.enum([
  'squat', 'hinge', 'lunge', 'push-horizontal', 'push-vertical',
  'pull-horizontal', 'pull-apart', 'arms', 'core', 'calves',
  'warmup', 'cooldown', 'desk-reset', 'mobility', 'postural-control',
])
export const setupAdjustmentSchema = z.enum([
  'standard', 'shortened-grip', 'lengthened-grip', 'other',
])

export interface EntityMeta {
  id: string
  createdAt: ISOInstant
  updatedAt: ISOInstant
}

export interface ScheduleSettings {
  timezone: string
  daysPerWeek: 2 | 3
  mode: ScheduleMode
  fixedWeekdays: Weekday[]
}

export interface Profile extends EntityMeta, ScheduleSettings {
  id: 'profile'
  planVersion: string
  onboardingCompleted: boolean
  safetyAcknowledged: boolean
}

export interface Band extends EntityMeta {
  key: string
  brand: string
  lengthInches: number
  number: number
  displayColor: string
  nominalMinLb: number
  nominalMaxLb: number
  enabled: boolean
  nickname?: string
}

export interface RepRange {
  min: number
  max: number
}

export interface TargetSnapshot {
  sets: number
  repRange?: RepRange
  durationSeconds?: RepRange
  bandKeys: string[]
  setupAdjustment?: SetupAdjustment
  suggestedReps?: number
  /** A concrete, confirmable setup cue; never silently picks a user's band. */
  progressionCue?: string
  /** Planned rest after a completed set. Optional only for legacy records; readers normalize to 60 seconds. */
  restSeconds?: number
  source: 'default' | 'recommendation' | 'manual'
}

export interface ExerciseMedia {
  provider: 'youtube'
  videoId: string
  title: string
  sourceName: string
  sourceUrl: string
  verifiedAt: ISOInstant
  loopBandNoAnchor: true
}

export interface Exercise extends EntityMeta {
  id: string
  contentVersion: string
  name: string
  category: MovementCategory
  setup: string[]
  steps: string[]
  breathingTempo: string
  primaryMuscles: string[]
  secondaryMuscles: string[]
  formCues: string[]
  commonMistakes: string[]
  easierVariations: string[]
  harderVariations: string[]
  bandWarnings: string[]
  compatibleSubstitutionCategories: MovementCategory[]
  defaultTarget: TargetSnapshot
  media?: ExerciseMedia
  /** Present only for local custom records; built-ins remain static assets. */
  photoDataUrl?: string
  isCustom?: boolean
  archived?: boolean
}

/** Adapter-neutral option shown when replacing a plan-slot exercise. */
export interface ExerciseAlternative {
  exerciseId: string
  category: MovementCategory
  targetKind: 'reps' | 'duration'
  rationale?: string
}

export interface PlanSlot {
  id: string
  workoutKey: WorkoutKey
  order: number
  exerciseId: string
  category: MovementCategory
  pairId?: string
  /** Runtime-only accessory slot linked to its primary movement pair. */
  isAccessory?: boolean
  /** Positive number of planned sets. Legacy templates used the literal 2. */
  defaultSets: number
  /** Planned rest after a set. Legacy records normalize to 60 seconds. */
  restSeconds?: number
  repRange?: RepRange
  durationSeconds?: RepRange
  startingResistance: 'bodyweight' | 'band'
  compatibleSubstitutionCategories?: MovementCategory[]
}

export interface PlanTemplate {
  version: string
  workouts: Record<WorkoutKey, PlanSlot[]>
  warmupMinutes: 4
  cooldownMinutes: number
}

/** A user-owned, editable copy of one built-in workout template. */
export interface PlanConfiguration extends EntityMeta {
  /** One stable record per workout letter. */
  id: WorkoutKey
  workoutKey: WorkoutKey
  /** Monotonically increasing revision used in session.planVersion. */
  revision: number
  sourceVersion: string
  slots: PlanSlot[]
  warmupMinutes: number
  cooldownMinutes: number
}

export interface ResolvedPlan {
  workoutKey: WorkoutKey
  version: string
  slots: PlanSlot[]
  warmupMinutes: number
  cooldownMinutes: number
  configuration?: PlanConfiguration
}

export interface YouTubeMetadata {
  videoId: string
  sourceUrl: string
  /** Host is retained so the editor can display the canonical URL form. */
  host: 'youtube.com' | 'youtu.be'
}

/** Local-only exercise content. A record is archived instead of deleted once referenced by history. */
export interface CustomExercise extends EntityMeta {
  id: UUID
  name: string
  category: MovementCategory
  targetKind: 'reps' | 'duration'
  targetRange: RepRange
  sets: number
  setup: string[]
  steps: string[]
  formCues: string[]
  photoDataUrl?: string
  youtube?: YouTubeMetadata
  archived: boolean
}

export type NewCustomExercise = Omit<CustomExercise, keyof EntityMeta | 'id'> & { id?: UUID }

export interface Substitution extends EntityMeta {
  planSlotId: string
  originalExerciseId: string
  selectedExerciseId: string
}

export interface WorkoutSession extends EntityMeta {
  workoutKey: WorkoutKey
  planVersion: string
  scheduledDate: LocalDate
  status: SessionStatus
  startedAt?: ISOInstant
  completedAt?: ISOInstant
  durationSeconds?: number
  notes?: string
  /** State needed to resume an interrupted active workout without guessing. */
  activeState?: WorkoutSessionState
}

export interface WorkoutDraft {
  /** Inputs remain strings while editing so a refresh does not lose an in-progress value. */
  reps?: string
  durationSeconds?: string
  bandKeys: string[]
  setupAdjustment: SetupAdjustment
  setupNote?: string
  effort: EffortRating
}

export interface WorkoutSessionState {
  phase: WorkoutPhase
  activeExerciseIndex: number
  draft: WorkoutDraft
  restTimerSeconds: number
  restTimerRunning: boolean
}

export function createDefaultWorkoutSessionState(): WorkoutSessionState {
  return {
    phase: 'warmup',
    activeExerciseIndex: 0,
    draft: { bandKeys: [], setupAdjustment: 'standard', effort: 'just-right' },
    restTimerSeconds: 60,
    restTimerRunning: false,
  }
}

export interface ExerciseLog extends EntityMeta {
  sessionId: UUID
  exerciseId: string
  planSlotId: string
  order: number
  targetSnapshot: TargetSnapshot
  /** Immutable display name captured at session start for renamed/archived custom exercises. */
  exerciseNameSnapshot?: string
  note?: string
}

export interface SetLog extends EntityMeta {
  exerciseLogId: UUID
  setNumber: number
  reps?: number
  durationSeconds?: number
  bandKeys: string[]
  setupAdjustment?: SetupAdjustment
  setupNote?: string
  effort: EffortRating
  completedAt: ISOInstant
}

export interface ExercisePerformanceSet {
  reps?: number
  durationSeconds?: number
  effort: EffortRating
  bandKeys: string[]
  setupAdjustment?: SetupAdjustment
}

export interface ExercisePerformance {
  exerciseId: string
  completedAt: ISOInstant
  target: TargetSnapshot
  sets: ExercisePerformanceSet[]
}

export interface PerformanceRecord extends ExercisePerformance {
  sessionId?: UUID
  exerciseLogId?: UUID
}

export type RecommendationKind =
  | 'increase-reps'
  | 'harder-setup'
  | 'add-set'
  | 'easier-setup'
  | 'reduce-reps'
  | 'regression'
  | 'maintain'

export interface WorkoutRecommendation {
  exerciseId: string
  kind: RecommendationKind
  proposedTarget: TargetSnapshot
  rationale: string
  requiresConfirmation: true
}

export interface AppMeta extends EntityMeta {
  id: 'app'
  databaseVersion: number
  lastSuccessfulExportAt?: ISOInstant
  installState?: 'unknown' | 'browser' | 'installed'
  dismissedNotices: string[]
  updateReady?: boolean
}

export interface BackupData {
  profile?: Profile
  bands: Band[]
  substitutions: Substitution[]
  sessions: WorkoutSession[]
  exerciseLogs: ExerciseLog[]
  setLogs: SetLog[]
  /** Optional for schema-1 callers; schema-2 exports always include these arrays. */
  planConfigurations?: PlanConfiguration[]
  customExercises?: CustomExercise[]
  appMeta?: AppMeta
}

export interface BackupEnvelope extends BackupData {
  schemaVersion: number
  appVersion: string
  exportedAt: ISOInstant
  checksum: { algorithm: 'SHA-256'; value: string }
}

export interface ScheduleDecision {
  mode: ScheduleMode
  localDate: LocalDate
  next: {
    workoutKey: WorkoutKey
    scheduledDate: LocalDate
    weekday: Weekday
  } | undefined
  resume?: WorkoutSession
  missed: Array<{ workoutKey: WorkoutKey; scheduledDate: LocalDate; weekday: Weekday }>
  reason: 'on-sequence' | 'resume-in-progress' | 'next-fixed-slot' | 'missed-fixed-slot'
}

export interface SessionQuery {
  from?: LocalDate
  to?: LocalDate
  status?: SessionStatus | SessionStatus[]
  limit?: number
}

export interface NewSession {
  workoutKey: WorkoutKey
  planVersion: string
  scheduledDate: LocalDate
  id?: UUID
  startedAt?: ISOInstant
  notes?: string
  activeState?: WorkoutSessionState
}

export interface NewExerciseLog {
  sessionId: UUID
  exerciseId: string
  planSlotId: string
  order: number
  targetSnapshot: TargetSnapshot
  exerciseNameSnapshot?: string
  id?: UUID
  note?: string
}

export interface NewSetLog {
  exerciseLogId: UUID
  setNumber: number
  reps?: number
  durationSeconds?: number
  bandKeys: string[]
  setupAdjustment?: SetupAdjustment
  setupNote?: string
  effort: EffortRating
  completedAt?: ISOInstant
  id?: UUID
}

const isoInstantSchema = z.string().datetime({ offset: true })
const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const entityMetaSchema = z.object({
  id: z.string().min(1),
  createdAt: isoInstantSchema,
  updatedAt: isoInstantSchema,
})
export const repRangeSchema = z.object({ min: z.number().int().nonnegative(), max: z.number().int().positive() }).superRefine((range, ctx) => {
  if (range.min > range.max) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'The minimum cannot exceed the maximum.' })
  }
})
export const targetSnapshotSchema = z.object({
  sets: z.number().int().positive(),
  repRange: repRangeSchema.optional(),
  durationSeconds: repRangeSchema.optional(),
  bandKeys: z.array(z.string().min(1)),
  setupAdjustment: setupAdjustmentSchema.optional(),
  suggestedReps: z.number().int().nonnegative().optional(),
  progressionCue: z.string().min(1).optional(),
  restSeconds: z.number().int().positive().optional(),
  source: z.enum(['default', 'recommendation', 'manual']),
}).superRefine((target, ctx) => {
  if (!target.repRange && !target.durationSeconds) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A target needs reps or duration.' })
  }
  if (target.repRange && target.durationSeconds) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A target cannot use reps and duration together.' })
  }
})

export const planSlotSchema = z.object({
  id: z.string().min(1),
  workoutKey: z.enum(['A', 'B', 'C']),
  order: z.number().int().nonnegative(),
  exerciseId: z.string().min(1),
  category: movementCategorySchema,
  pairId: z.string().min(1).optional(),
  isAccessory: z.boolean().optional(),
  defaultSets: z.number().int().positive(),
  restSeconds: z.number().int().positive().optional(),
  repRange: repRangeSchema.optional(),
  durationSeconds: repRangeSchema.optional(),
  startingResistance: z.enum(['bodyweight', 'band']),
  compatibleSubstitutionCategories: z.array(movementCategorySchema).optional(),
}).superRefine((slot, ctx) => {
  if (!slot.repRange && !slot.durationSeconds) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A plan slot needs reps or duration.' })
  if (slot.repRange && slot.durationSeconds) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A plan slot cannot use reps and duration together.' })
  if (slot.isAccessory && !slot.pairId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pairId'], message: 'An accessory slot needs a pair.' })
})

export const planConfigurationSchema = entityMetaSchema.extend({
  id: z.enum(['A', 'B', 'C']),
  workoutKey: z.enum(['A', 'B', 'C']),
  revision: z.number().int().positive(),
  sourceVersion: z.string().min(1),
  slots: z.array(planSlotSchema).min(1),
  warmupMinutes: z.number().int().nonnegative(),
  cooldownMinutes: z.number().int().nonnegative(),
}).superRefine((configuration, ctx) => {
  if (configuration.id !== configuration.workoutKey) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['id'], message: 'Configuration id must match workout key.' })
  const ids = new Set<string>()
  const orders = new Set<number>()
  configuration.slots.forEach((slot, index) => {
    if (ids.has(slot.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['slots', index, 'id'], message: 'Slot identifiers must be unique.' })
    ids.add(slot.id)
    if (orders.has(slot.order)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['slots', index, 'order'], message: 'Slot order values must be unique.' })
    orders.add(slot.order)
    if (slot.workoutKey !== configuration.workoutKey) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['slots', index, 'workoutKey'], message: 'Slot workout key does not match configuration.' })
  })
})

const dataUrlSchema = z.string().regex(/^data:image\/webp;base64,[A-Za-z0-9+/]+=*$/, 'Photo must be a compressed WebP data URL.').refine((value) => {
  const comma = value.indexOf(',')
  if (comma < 0) return false
  // Base64 is four thirds of the byte count; this guards IndexedDB growth even
  // when callers bypass the image-picker helper.
  return Math.floor((value.length - comma - 1) * 3 / 4) <= 1_500_000
}, 'Photo is larger than the 1.5 MB local limit.')

export const youtubeMetadataSchema = z.object({
  videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  sourceUrl: z.string().url(),
  host: z.enum(['youtube.com', 'youtu.be']),
})

export const customExerciseSchema = entityMetaSchema.extend({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  category: movementCategorySchema,
  targetKind: z.enum(['reps', 'duration']),
  targetRange: repRangeSchema,
  sets: z.number().int().positive(),
  setup: z.array(z.string().trim().min(1)).max(20),
  steps: z.array(z.string().trim().min(1)).max(30),
  formCues: z.array(z.string().trim().min(1)).max(3),
  photoDataUrl: dataUrlSchema.optional(),
  youtube: youtubeMetadataSchema.optional(),
  archived: z.boolean(),
})

export const profileSchema = entityMetaSchema.extend({
  id: z.literal('profile'),
  timezone: z.string().min(1),
  daysPerWeek: z.union([z.literal(2), z.literal(3)]),
  mode: z.enum(['flexible', 'fixed']),
  fixedWeekdays: z.array(z.number().int().min(0).max(6)),
  planVersion: z.string().min(1),
  onboardingCompleted: z.boolean(),
  safetyAcknowledged: z.boolean(),
}).superRefine((profile, ctx) => {
  const unique = new Set(profile.fixedWeekdays)
  if (unique.size !== profile.fixedWeekdays.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fixedWeekdays'], message: 'Fixed weekdays must be unique.' })
  }
  if (profile.mode === 'fixed' && unique.size !== profile.daysPerWeek) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fixedWeekdays'], message: `Fixed mode requires exactly ${profile.daysPerWeek} weekdays.` })
  }
})

export const scheduleSettingsSchema = z.object({
  timezone: z.string().min(1),
  daysPerWeek: z.union([z.literal(2), z.literal(3)]),
  mode: z.enum(['flexible', 'fixed']),
  fixedWeekdays: z.array(z.number().int().min(0).max(6)),
}).superRefine((settings, ctx) => {
  const unique = new Set(settings.fixedWeekdays)
  if (unique.size !== settings.fixedWeekdays.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fixedWeekdays'], message: 'Fixed weekdays must be unique.' })
  }
  if (settings.mode === 'fixed' && unique.size !== settings.daysPerWeek) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fixedWeekdays'], message: `Fixed mode requires exactly ${settings.daysPerWeek} weekdays.` })
  }
})

export const bandSchema = entityMetaSchema.extend({
  key: z.string().min(1),
  brand: z.string().min(1),
  lengthInches: z.number().positive(),
  number: z.number().int().positive(),
  displayColor: z.string().min(1),
  nominalMinLb: z.number().nonnegative(),
  nominalMaxLb: z.number().positive(),
  enabled: z.boolean(),
  nickname: z.string().optional(),
}).superRefine((band, ctx) => {
  if (band.nominalMinLb > band.nominalMaxLb) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nominalMinLb'], message: 'The nominal minimum cannot exceed the maximum.' })
  }
})

export const substitutionSchema = entityMetaSchema.extend({
  planSlotId: z.string().min(1),
  originalExerciseId: z.string().min(1),
  selectedExerciseId: z.string().min(1),
})

export const sessionSchema = entityMetaSchema.extend({
  workoutKey: z.enum(['A', 'B', 'C']),
  planVersion: z.string().min(1),
  scheduledDate: localDateSchema,
  status: z.enum(['planned', 'in-progress', 'completed', 'skipped']),
  startedAt: isoInstantSchema.optional(),
  completedAt: isoInstantSchema.optional(),
  durationSeconds: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  activeState: z.lazy(() => workoutSessionStateSchema).optional(),
})

export const workoutDraftSchema = z.object({
  reps: z.string().optional(),
  durationSeconds: z.string().optional(),
  bandKeys: z.array(z.string().min(1)),
  setupAdjustment: setupAdjustmentSchema,
  setupNote: z.string().optional(),
  effort: effortRatingSchema,
})

export const workoutSessionStateSchema = z.object({
  phase: z.enum(['warmup', 'working', 'cooldown']),
  activeExerciseIndex: z.number().int().nonnegative(),
  draft: workoutDraftSchema,
  restTimerSeconds: z.number().int().nonnegative(),
  restTimerRunning: z.boolean(),
})

export const exerciseLogSchema = entityMetaSchema.extend({
  sessionId: z.string().min(1),
  exerciseId: z.string().min(1),
  planSlotId: z.string().min(1),
  order: z.number().int().nonnegative(),
  targetSnapshot: targetSnapshotSchema,
  exerciseNameSnapshot: z.string().trim().min(1).optional(),
  note: z.string().optional(),
})

export const setLogSchema = entityMetaSchema.extend({
  exerciseLogId: z.string().min(1),
  setNumber: z.number().int().positive(),
  reps: z.number().int().nonnegative().optional(),
  durationSeconds: z.number().int().nonnegative().optional(),
  bandKeys: z.array(z.string()),
  setupAdjustment: setupAdjustmentSchema.optional(),
  setupNote: z.string().optional(),
  effort: effortRatingSchema,
  completedAt: isoInstantSchema,
}).superRefine((set, ctx) => {
  if (set.reps === undefined && set.durationSeconds === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A set needs reps or duration.' })
  }
  if (set.reps !== undefined && set.durationSeconds !== undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A set cannot use reps and duration together.' })
  }
  if (set.setupAdjustment === 'other' && !set.setupNote?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['setupNote'], message: 'Describe an other setup.' })
  }
})

export const appMetaSchema = entityMetaSchema.extend({
  id: z.literal('app'),
  databaseVersion: z.number().int().positive(),
  lastSuccessfulExportAt: isoInstantSchema.optional(),
  installState: z.enum(['unknown', 'browser', 'installed']).optional(),
  dismissedNotices: z.array(z.string()),
  updateReady: z.boolean().optional(),
})

export const backupDataSchema = z.object({
  profile: profileSchema.optional(),
  bands: z.array(bandSchema),
  substitutions: z.array(substitutionSchema),
  sessions: z.array(sessionSchema),
  exerciseLogs: z.array(exerciseLogSchema),
  setLogs: z.array(setLogSchema),
  planConfigurations: z.array(planConfigurationSchema).optional(),
  customExercises: z.array(customExerciseSchema).optional(),
  appMeta: appMetaSchema.optional(),
})

export const backupEnvelopeSchema = backupDataSchema.extend({
  schemaVersion: z.number().int().positive(),
  appVersion: z.string().min(1),
  exportedAt: isoInstantSchema,
  checksum: z.object({ algorithm: z.literal('SHA-256'), value: z.string().regex(/^[a-f0-9]{64}$/i) }),
})

export function isLocalDate(value: string): value is LocalDate {
  return localDateSchema.safeParse(value).success
}

export const DEFAULT_REST_SECONDS = 60

/** Additive compatibility normalization for schema-1 targets. */
export function normalizeTargetSnapshot(target: TargetSnapshot): TargetSnapshot {
  return { ...target, sets: Math.max(1, Math.trunc(target.sets)), restSeconds: target.restSeconds ?? DEFAULT_REST_SECONDS }
}

/** Additive compatibility normalization for legacy/default plan slots. */
export function normalizePlanSlot(slot: PlanSlot): PlanSlot {
  return { ...slot, defaultSets: Math.max(1, Math.trunc(slot.defaultSets)), restSeconds: slot.restSeconds ?? DEFAULT_REST_SECONDS }
}

export function targetSnapshotFromPlanSlot(slot: PlanSlot, source: TargetSnapshot['source'] = 'default'): TargetSnapshot {
  return normalizeTargetSnapshot({
    sets: slot.defaultSets,
    repRange: slot.repRange,
    durationSeconds: slot.durationSeconds,
    bandKeys: [],
    restSeconds: slot.restSeconds,
    source,
  })
}
