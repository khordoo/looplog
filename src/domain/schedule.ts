import type {
  LocalDate,
  Profile,
  ScheduleDecision,
  ScheduleSettings,
  SessionStatus,
  Weekday,
  WorkoutKey,
  WorkoutSession,
} from './types'

const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6]
const WEEKDAY_NAMES: Record<string, Weekday> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
}

export interface ScheduleInput {
  settings: ScheduleSettings | Pick<Profile, 'timezone' | 'daysPerWeek' | 'mode' | 'fixedWeekdays'>
  now: string | Date
  sessions: WorkoutSession[]
  /** Local date on which this profile became active; prevents pre-onboarding debt. */
  trainingStartDate?: LocalDate
}

export interface ScheduleValidation {
  valid: boolean
  errors: string[]
}

export function validateScheduleSettings(settings: ScheduleSettings): ScheduleValidation {
  const errors: string[] = []
  if (!settings.timezone || !isValidTimeZone(settings.timezone)) {
    errors.push('Choose a valid IANA timezone.')
  }
  if (settings.daysPerWeek !== 2 && settings.daysPerWeek !== 3) {
    errors.push('Training days must be two or three.')
  }
  const unique = new Set(settings.fixedWeekdays)
  if (unique.size !== settings.fixedWeekdays.length || settings.fixedWeekdays.some((day) => !WEEKDAYS.includes(day))) {
    errors.push('Fixed weekdays must be unique values from Sunday through Saturday.')
  }
  if (settings.mode === 'fixed' && unique.size !== settings.daysPerWeek) {
    errors.push(`Fixed mode requires exactly ${settings.daysPerWeek} weekdays.`)
  }
  return { valid: errors.length === 0, errors }
}

function isValidTimeZone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format()
    return true
  } catch {
    return false
  }
}

function toDate(now: string | Date): Date {
  const date = now instanceof Date ? new Date(now.getTime()) : new Date(now)
  if (Number.isNaN(date.getTime())) throw new Error('Schedule time must be a valid instant.')
  return date
}

export function getLocalDate(instant: string | Date, timezone: string): LocalDate {
  const date = toDate(instant)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  if (!year || !month || !day) throw new Error(`Unable to resolve date in timezone ${timezone}.`)
  return `${year}-${month}-${day}` as LocalDate
}

export function getLocalWeekday(instant: string | Date, timezone: string): Weekday {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(toDate(instant))
  return WEEKDAY_NAMES[weekday] ?? (() => { throw new Error(`Unable to resolve weekday ${weekday}.`) })()
}

export function getScheduleSequence(daysPerWeek: 2 | 3): WorkoutKey[] {
  return daysPerWeek === 2 ? ['A', 'B'] : ['A', 'B', 'C']
}

function dateToUtc(date: LocalDate): Date {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function utcToDate(date: Date): LocalDate {
  return date.toISOString().slice(0, 10) as LocalDate
}

export function addLocalDays(date: LocalDate, days: number): LocalDate {
  const result = dateToUtc(date)
  result.setUTCDate(result.getUTCDate() + days)
  return utcToDate(result)
}

function isFinalized(status: SessionStatus): boolean {
  return status === 'completed' || status === 'skipped'
}

function hasFinalizedSession(sessions: WorkoutSession[], scheduledDate: LocalDate): boolean {
  return sessions.some((session) => session.scheduledDate === scheduledDate && isFinalized(session.status))
}

function findResume(sessions: WorkoutSession[]): WorkoutSession | undefined {
  return [...sessions]
    .filter((session) => session.status === 'in-progress')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
}

interface FixedOccurrence {
  workoutKey: WorkoutKey
  scheduledDate: LocalDate
  weekday: Weekday
}

function fixedOccurrence(date: LocalDate, weekdays: Weekday[], sequence: WorkoutKey[]): FixedOccurrence | undefined {
  const weekday = dateToUtc(date).getUTCDay() as Weekday
  const index = weekdays.indexOf(weekday)
  return index < 0 ? undefined : { workoutKey: sequence[index], scheduledDate: date, weekday }
}

export function resolveFlexibleSchedule(input: ScheduleInput): ScheduleDecision {
  const { settings, sessions } = input
  const validation = validateScheduleSettings(settings)
  if (!validation.valid) throw new Error(validation.errors.join(' '))
  const localDate = getLocalDate(input.now, settings.timezone)
  const resume = findResume(sessions)
  if (resume) {
    return {
      mode: 'flexible', localDate, resume, missed: [],
      next: { workoutKey: resume.workoutKey, scheduledDate: resume.scheduledDate, weekday: getLocalWeekday(resume.startedAt ?? input.now, settings.timezone) },
      reason: 'resume-in-progress',
    }
  }
  const sequence = getScheduleSequence(settings.daysPerWeek)
  const advanced = sessions.filter((session) => isFinalized(session.status)).length
  const workoutKey = sequence[advanced % sequence.length]
  return {
    mode: 'flexible', localDate, missed: [],
    next: { workoutKey, scheduledDate: localDate, weekday: getLocalWeekday(input.now, settings.timezone) },
    reason: 'on-sequence',
  }
}

export function resolveFixedSchedule(input: ScheduleInput): ScheduleDecision {
  const { settings, sessions } = input
  const validation = validateScheduleSettings(settings)
  if (!validation.valid) throw new Error(validation.errors.join(' '))
  const localDate = getLocalDate(input.now, settings.timezone)
  const weekdays = [...settings.fixedWeekdays].sort((a, b) => a - b)
  const sequence = getScheduleSequence(settings.daysPerWeek)
  const resume = findResume(sessions)
  if (resume) {
    return {
      mode: 'fixed', localDate, resume, missed: [],
      next: { workoutKey: resume.workoutKey, scheduledDate: resume.scheduledDate, weekday: getLocalWeekday(resume.startedAt ?? input.now, settings.timezone) },
      reason: 'resume-in-progress',
    }
  }

  const earliestSessionDate = sessions
    .map((session) => session.scheduledDate)
    .sort()[0]
  const inferredStart = input.trainingStartDate ?? earliestSessionDate ?? localDate
  const sevenDaysAgo = addLocalDays(localDate, -7)
  const startDate = inferredStart > sevenDaysAgo ? inferredStart : sevenDaysAgo
  const missed: FixedOccurrence[] = []
  // Only recent unresolved assignments are actionable. The profile start date
  // prevents a new user from inheriting calendar debt from before onboarding.
  for (let date = startDate; date < localDate; date = addLocalDays(date, 1)) {
    const occurrence = fixedOccurrence(date, weekdays, sequence)
    if (occurrence && !hasFinalizedSession(sessions, date)) missed.push(occurrence)
  }

  let next: FixedOccurrence | undefined
  for (let offset = 0; offset <= 14; offset += 1) {
    const date = addLocalDays(localDate, offset)
    const occurrence = fixedOccurrence(date, weekdays, sequence)
    if (occurrence && !hasFinalizedSession(sessions, date)) {
      next = occurrence
      break
    }
  }
  return {
    mode: 'fixed', localDate, next, missed,
    reason: missed.length > 0 ? 'missed-fixed-slot' : 'next-fixed-slot',
  }
}

export function resolveSchedule(input: ScheduleInput): ScheduleDecision {
  return input.settings.mode === 'fixed' ? resolveFixedSchedule(input) : resolveFlexibleSchedule(input)
}

export const resolveToday = resolveSchedule
export const determineTodaysWorkout = resolveSchedule
