import { z } from 'zod'

export type UUID = string
export type ISOInstant = string
export type LocalDate = `${number}-${number}-${number}`
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6
export type WorkoutKey = 'A' | 'B' | 'C'
export type ScheduleMode = 'flexible' | 'fixed'
export type SessionStatus = 'planned' | 'in-progress' | 'completed' | 'skipped'
export type EffortRating = z.infer<typeof effortRatingSchema>
export type MovementCategory = z.infer<typeof movementCategorySchema>
export type SetupAdjustment = z.infer<typeof setupAdjustmentSchema>

export const effortRatingSchema = z.enum(['easy', 'just-right', 'max-effort', 'form-broke'])
export const movementCategorySchema = z.enum([
  'squat', 'hinge', 'lunge', 'push-horizontal', 'push-vertical',
  'pull-horizontal', 'pull-apart', 'arms', 'core', 'calves',
  'warmup', 'cooldown', 'desk-reset',
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
}

export interface PlanSlot {
  id: string
  workoutKey: WorkoutKey
  order: number
  exerciseId: string
  category: MovementCategory
  pairId?: string
  defaultSets: 2
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
}

export interface ExerciseLog extends EntityMeta {
  sessionId: UUID
  exerciseId: string
  planSlotId: string
  order: number
  targetSnapshot: TargetSnapshot
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
}

export interface NewExerciseLog {
  sessionId: UUID
  exerciseId: string
  planSlotId: string
  order: number
  targetSnapshot: TargetSnapshot
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
  source: z.enum(['default', 'recommendation', 'manual']),
}).superRefine((target, ctx) => {
  if (!target.repRange && !target.durationSeconds) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A target needs reps or duration.' })
  }
  if (target.repRange && target.durationSeconds) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A target cannot use reps and duration together.' })
  }
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
})

export const exerciseLogSchema = entityMetaSchema.extend({
  sessionId: z.string().min(1),
  exerciseId: z.string().min(1),
  planSlotId: z.string().min(1),
  order: z.number().int().nonnegative(),
  targetSnapshot: targetSnapshotSchema,
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
