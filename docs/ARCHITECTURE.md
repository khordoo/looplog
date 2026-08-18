# LoopLog PWA Architecture

This document turns [PLAN.md](PLAN.md) into an implementation contract. It describes the
boundaries between product content, pure training logic, persistence, and the
React/PWA shell. The initial implementation is local-only, but all user-data
types and identifiers are deliberately suitable for a later
`SupabaseStorageAdapter`.

## 1. Architectural principles

1. **Local-first and offline-first.** A workout can be started, completed,
   reviewed, and backed up without a network connection. YouTube is an optional
   boundary, never a dependency of the workout flow.
2. **UI has no persistence knowledge.** React components and hooks depend on a
   `StorageAdapter`; only the IndexedDB adapter imports Dexie. No component,
   route, domain function, or test fixture reaches for `indexedDB` directly.
3. **Pure domain decisions.** Scheduling, progression, substitution validation,
   summaries, and backup transformations are deterministic functions of their
   inputs. Time, random IDs, browser APIs, and storage are injected at the
   edges.
4. **Version everything that can outlive a release.** User records have UUIDs
   and timestamps; database schema, backup envelope, plan templates, and static
   exercise content have explicit versions.
5. **Preserve history.** Changing a schedule, a band inventory, a substitution,
   or a plan version never rewrites completed sessions, exercise logs, or set
   logs. Recommendations operate on snapshots and current settings while
   history remains factual.
6. **Conservative safety defaults.** Recommendations require user confirmation,
   substitutions are category-checked, and guidance distinguishes nominal band
   ranges from fixed weights.

## 2. Suggested project layout

The following layout keeps stable domain contracts independent from UI and
storage implementations. File names can be adjusted during scaffolding, but
the dependency direction should remain intact.

```text
src/
  app/
    App.tsx                 # Providers, router, global update/offline UI
    routes.tsx              # Route definitions and lazy screen boundaries
    providers/              # Storage, profile, connectivity, update contexts
    errors.ts               # User-facing error mapping
  domain/
    types.ts                # Adapter-neutral entities and value types
    ids.ts                  # UUID/time factories as injected interfaces
    constants.ts            # Plan keys, effort labels, schema versions
    schedule/
      schedule.ts           # Pure flexible/fixed schedule calculations
      schedule.test.ts
    progression/
      progression.ts        # Targets, double progression, recommendations
      progression.test.ts
    substitutions/
      substitutions.ts      # Category compatibility and validation
      substitutions.test.ts
    summaries/
      summaries.ts          # History and recent-performance projections
      summaries.test.ts
    backup/
      backup.ts             # Envelope, checksum, validation, merge/replace
      backup.test.ts
    workout/
      workout.ts            # Session state transitions and target snapshots
      workout.test.ts
  content/
    exercises.ts             # Versioned exercise definitions
    plans.ts                 # A/B/C templates and desk reset metadata
    media.ts                 # Curated YouTube IDs and attribution metadata
    content.test.ts          # Every plan slot resolves to complete content
  storage/
    adapter.ts               # StorageAdapter interface and query contracts
    indexeddb/
      db.ts                  # Dexie database/schema and migrations only
      indexeddb-adapter.ts   # StorageAdapter implementation
      mappers.ts             # DB rows <-> domain records
      indexeddb.test.ts
  features/
    onboarding/              # Setup flow and validation
    today/                   # Next workout/recovery/backup reminders
    workout/                 # Active session state and logging UI
    exercises/               # Searchable guide library and video boundary
    history/                 # Session and exercise progression views
    settings/                # Schedule, bands, swaps, backup, reset
  components/
    ui/                      # Accessible headless primitives
    layout/                  # Mobile shell, navigation, safe areas
    feedback/                # Toasts, dialogs, offline/update notices
  hooks/                     # Small UI hooks; no domain policy
  lib/
    clock.ts                 # Browser clock/time-zone adapter
    crypto.ts                # Web Crypto SHA-256 adapter
    files.ts                 # Download/share/import file boundary
    pwa.ts                   # Service-worker registration/update boundary
    storage.ts                # Persistent-storage request/status boundary
  test/
    fixtures.ts
    setup.ts
public/
  icons/                     # Locally served PWA icons
```

Dependency rules:

```text
content -> domain types
domain -> domain types/constants only
storage/indexeddb -> storage adapter + domain types + Dexie
features/components -> domain + StorageAdapter hooks
app/lib -> browser APIs and feature composition
```

`domain` must not import React, Dexie, router APIs, `window`, `document`, or
`navigator`. `content` must not import storage. Static media metadata may carry
an external URL, but the media renderer owns whether and when it is loaded.

## 3. Adapter-neutral domain model

Use ISO-8601 UTC strings for persisted instants (`createdAt`, `updatedAt`,
`completedAt`, etc.) and an IANA timezone string on `Profile` for calendar
calculations. Date-only schedule values use `YYYY-MM-DD` in the user's saved
timezone; they are not parsed as local machine dates. All persisted entities
have `id`, `createdAt`, and `updatedAt` unless explicitly singleton/config
records. UUID v4 (or `crypto.randomUUID`) is generated by an injected ID
factory; never use array indexes or band display numbers as identifiers.

Representative TypeScript contracts:

```ts
type UUID = string;
type ISOInstant = string;
type LocalDate = `${number}-${number}-${number}`;
type WorkoutKey = 'A' | 'B' | 'C';
type ScheduleMode = 'flexible' | 'fixed';
type EffortRating = 'easy' | 'just-right' | 'max-effort' | 'form-broke';
type MovementCategory =
  | 'squat' | 'hinge' | 'lunge' | 'push-horizontal' | 'push-vertical'
  | 'pull-horizontal' | 'pull-apart' | 'arms' | 'core' | 'calves' | 'warmup'
  | 'cooldown' | 'desk-reset';

interface EntityMeta {
  id: UUID;
  createdAt: ISOInstant;
  updatedAt: ISOInstant;
}

interface Profile extends EntityMeta {
  id: 'profile';
  timezone: string;
  daysPerWeek: 2 | 3;
  scheduleMode: ScheduleMode;
  fixedWeekdays: number[];       // 0 Sunday ... 6 Saturday, unique/sorted
  planVersion: string;
  onboardingCompleted: boolean;
}

interface Band extends EntityMeta {
  key: string;                   // stable catalog key, e.g. serious-steel-1
  brand: string;
  lengthInches: number;
  number: number;
  displayColor: string;
  nominalMinLb: number;
  nominalMaxLb: number;
  enabled: boolean;
  nickname?: string;
}

interface Exercise extends EntityMeta {
  id: string;                    // stable content ID, not a UUID
  contentVersion: string;
  name: string;
  category: MovementCategory;
  setup: string[];
  steps: string[];
  breathingTempo: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  formCues: string[];            // 3–5 concise cues
  commonMistakes: string[];
  easierVariations: string[];
  harderVariations: string[];
  bandWarnings: string[];
  compatibleSubstitutionCategories: MovementCategory[];
  media?: ExerciseMedia;
}

interface ExerciseMedia {
  provider: 'youtube';
  videoId: string;
  title: string;
  sourceName: string;
  sourceUrl: string;
  verifiedAt: ISOInstant;
  loopBandNoAnchor: true;
}

interface PlanTemplate {
  version: string;
  workouts: Record<WorkoutKey, PlanSlot[]>;
  warmupMinutes: 4;
  cooldownMinutes: number;
}

interface PlanSlot {
  id: string;                    // e.g. A-1; stable across app versions
  workoutKey: WorkoutKey;
  order: number;
  exerciseId: string;
  category: MovementCategory;
  pairId?: string;
  defaultSets: 2;
  repRange?: { min: number; max: number };
  durationSeconds?: { min: number; max: number };
  startingResistance: 'bodyweight' | 'band';
}

interface ScheduleSettings {
  timezone: string;
  daysPerWeek: 2 | 3;
  mode: ScheduleMode;
  fixedWeekdays: number[];
}

interface WorkoutSession extends EntityMeta {
  workoutKey: WorkoutKey;
  planVersion: string;
  scheduledDate: LocalDate;
  status: 'planned' | 'in-progress' | 'completed' | 'skipped';
  startedAt?: ISOInstant;
  completedAt?: ISOInstant;
  durationSeconds?: number;
  notes?: string;
}

interface ExerciseLog extends EntityMeta {
  sessionId: UUID;
  exerciseId: string;
  planSlotId: string;
  order: number;
  targetSnapshot: TargetSnapshot;
  note?: string;
}

interface SetLog extends EntityMeta {
  exerciseLogId: UUID;
  setNumber: number;
  reps?: number;
  durationSeconds?: number;
  bandKeys: string[];            // [] means bodyweight
  setupAdjustment?: 'standard' | 'shortened-grip' | 'lengthened-grip' | 'other';
  setupNote?: string;
  effort: EffortRating;
  completedAt: ISOInstant;
}

interface TargetSnapshot {
  sets: number;
  repRange?: { min: number; max: number };
  durationSeconds?: { min: number; max: number };
  bandKeys: string[];
  setupAdjustment?: SetLog['setupAdjustment'];
  source: 'default' | 'recommendation' | 'manual';
}

interface WorkoutRecommendation {
  exerciseId: string;
  kind: 'increase-reps' | 'harder-setup' | 'add-set' | 'easier-setup'
    | 'reduce-reps' | 'regression' | 'maintain';
  proposedTarget: TargetSnapshot;
  rationale: string;
  requiresConfirmation: true;
}

interface BackupEnvelope {
  schemaVersion: number;
  appVersion: string;
  exportedAt: ISOInstant;
  checksum: { algorithm: 'SHA-256'; value: string };
  profile: Profile;
  bands: Band[];
  substitutions: Substitution[];
  sessions: WorkoutSession[];
  exerciseLogs: ExerciseLog[];
  setLogs: SetLog[];
}
```

`Substitution` is a user preference record keyed by `planSlotId`, containing
`selectedExerciseId` and timestamps. Static `Exercise` and `PlanTemplate`
records are never exported as user data; the backup carries their IDs and
`planVersion`, and an import rejects or flags IDs unavailable in the installed
content version.

Validation should be shared at boundaries using Zod schemas generated beside
the domain contracts or hand-maintained from the same definitions. Runtime
validation is required for imported JSON and user-entered settings; TypeScript
types alone are not a trust boundary.

## 4. `StorageAdapter` contract

The interface should expose every persistence operation used by a feature and
return domain records, not Dexie tables or database rows. Methods should be
transaction-safe where the operation changes more than one related record.

```ts
interface StorageAdapter {
  getProfile(): Promise<Profile | undefined>;
  saveProfile(profile: Profile): Promise<void>;
  getBands(): Promise<Band[]>;
  replaceBands(bands: Band[]): Promise<void>;
  listSubstitutions(): Promise<Substitution[]>;
  saveSubstitution(substitution: Substitution): Promise<void>;
  removeSubstitution(planSlotId: string): Promise<void>;

  createSession(input: NewSession): Promise<WorkoutSession>;
  getSession(sessionId: UUID): Promise<WorkoutSession | undefined>;
  updateSession(session: WorkoutSession): Promise<void>;
  listSessions(query?: SessionQuery): Promise<WorkoutSession[]>;

  createExerciseLog(input: NewExerciseLog): Promise<ExerciseLog>;
  getExerciseLogs(sessionId: UUID): Promise<ExerciseLog[]>;
  createSetLog(input: NewSetLog): Promise<SetLog>;
  updateSetLog(log: SetLog): Promise<void>;
  getSetLogs(exerciseLogId: UUID): Promise<SetLog[]>;
  listRecentPerformance(exerciseId: string, limit: number):
    Promise<PerformanceRecord[]>;

  exportData(): Promise<BackupData>; // raw normalized user records
  importData(mode: 'merge' | 'replace', data: BackupData): Promise<ImportReport>;
  getAppMeta(): Promise<AppMeta>;
  saveAppMeta(meta: AppMeta): Promise<void>;
  requestReset(): Promise<void>; // explicit, called only after UI confirmation
}
```

Recommended constraints:

- `createSession` is idempotent for a caller-provided session UUID. Starting a
  second active session for the same scheduled workout should return the
  existing one or require an explicit resume decision.
- `updateSession`, set logging, and import merge use `updatedAt` consistently.
- `listSessions` supports date range, status, and descending completion/date
  ordering so History does not load unbounded data unnecessarily.
- `listRecentPerformance` returns normalized, completed set data plus the
  target snapshot; it does not calculate recommendations itself.
- `exportData` is a read transaction over all user stores. `importData` is one
  transaction for merge/replace, with the adapter taking an in-memory snapshot
  before replacement.
- A future Supabase adapter can implement the same methods and map UUIDs and
  timestamps directly. It may add synchronization methods behind a separate
  optional interface rather than polluting the local contract.

Use a React provider or a small `useStorage()` hook to inject the adapter. The
default production provider constructs `IndexedDbStorageAdapter`; tests inject
an in-memory adapter implementing the same interface.

## 5. Dexie schema and migration strategy

Use one consistently named Dexie database and a monotonic
schema version. Keep the database version separate from `BackupEnvelope`'s
portable schema version.

Initial logical stores and indexes:

```text
profile       id (singleton), updatedAt
bands         key (stable key), enabled, updatedAt
substitutions planSlotId (unique), selectedExerciseId, updatedAt
sessions      id (UUID), workoutKey, scheduledDate, status, completedAt, updatedAt
exerciseLogs  id (UUID), sessionId, exerciseId, [sessionId+order], updatedAt
setLogs       id (UUID), exerciseLogId, [exerciseLogId+setNumber], completedAt, updatedAt
appMeta       key (singleton), updatedAt
```

The Dexie schema declaration must contain only storage concerns. Domain-to-row
mappers should normalize optional fields and avoid persisting `undefined`
where an upgrade would make field presence ambiguous. Do not use Dexie's
auto-increment keys for user records.

Migration rules:

1. Start at version 1 with all stores and indexes required by the plan.
2. Every schema change adds `db.version(n + 1).stores(...)` and, where needed,
   an explicit `.upgrade(tx => ...)` that is idempotent and preserves records.
3. Add fields with safe defaults; never silently reinterpret a historical value.
4. If a plan/content migration changes a slot or exercise ID, retain the old
   ID in history and add an explicit mapping for future recommendations.
5. Do not delete or rebuild history in a schema upgrade. If an index is removed,
   preserve the underlying property until a later, separately reviewed version.
6. On open failure, surface a recoverable error with export/reset guidance;
   never automatically clear the database.
7. Migration tests should create a fixture at every prior version, open it with
   the current adapter, assert data preservation, and exercise a subsequent
   export.

The adapter should group a session start (session plus its exercise logs) and a
completed-set write in Dexie transactions. A failed transaction must leave no
partial set or session state. Browser termination can still interrupt a write,
so the active-workout UI should reload persisted state on resume.

## 6. Pure domain services

### Scheduling

`resolveToday(input: ScheduleInput): ScheduleDecision` accepts a profile,
completed/skipped sessions, current local date, and plan templates. It returns
the next workout key, scheduled date, reason, and whether a session may be
resumed. It must not mutate sessions.

- Flexible mode uses the configured sequence (`A → B` or `A → B → C`) and
  advances only after a session is completed (or explicitly skipped if the
  product chooses skip-as-advance). There is no overdue queue and missed days
  do not create extra sessions.
- Fixed mode maps selected weekdays to sequence positions. It returns the next
  matching weekday/date and leaves future weekday assignments unchanged when a
  session is completed late or skipped.
- All date arithmetic uses the saved IANA timezone. The browser timezone is
  only the onboarding default and must not silently replace a saved timezone.
- Invalid weekday counts, duplicate weekdays, and a three-day schedule with
  fewer than three selected weekdays are rejected before persistence.

`advanceFlexibleRotation` should use completed session order (and explicit
  skips, if enabled), not wall-clock elapsed days. Changing days per week from
  two to three changes future sequence resolution and never changes history.

### Progression

`recommendNextTarget(exercise, previousPerformances, currentBands)` implements
double progression from the plan:

1. Start with two sets at the exercise's default rep/duration range and a
   confirmed band/setup target.
2. While all required sets reach the top of the range with `easy` or
   `just-right` and clean form, propose more reps on the same resistance.
3. After two consecutive qualifying performances at the top of the range,
   propose a harder setup/band or a third set, depending on the exercise's
   available progression options.
4. If minimum reps are missed or any set is `form-broke`, propose fewer reps,
   an easier band/setup, or the defined regression.
5. `max-effort` does not qualify as an increase; maintain or reduce based on
   completion quality.

The function returns a recommendation with a human-readable rationale and
`requiresConfirmation: true`. Applying it creates a new target snapshot; it
does not rewrite previous logs. Duration-based core movements use the same
quality rules with duration thresholds.

### Substitutions and summaries

`validateSubstitution(planSlot, candidateExercise, content)` requires a
candidate ID that exists, is enabled, and belongs to a category declared
compatible by the original exercise/slot. The saved substitution is keyed by
slot, so the original plan and completed history remain intact. A replacement
must retain target semantics (reps versus duration) or define an explicit
conversion in content.

`summarizeWorkout` and `summarizeExerciseHistory` are pure projections. They
compute completed count, duration, previous result, trend, and recent target
without treating skipped/planned sessions as completed performance. Missing or
partially logged sets are shown as incomplete rather than fabricated.

### Backup transformations

`buildBackupEnvelope(rawData, appVersion, clock, sha256)` canonicalizes records
in stable store/key order, computes SHA-256 over the canonical payload (not the
checksum field), then wraps it with schema and app versions. `parseBackup`:

- parses JSON and validates the complete Zod envelope;
- rejects unsupported future schema versions;
- recomputes and compares the checksum using constant-time-safe comparison;
- checks UUIDs, timestamps, dates, enum values, relationship references, and
  duplicate IDs;
- reports actionable errors without touching storage.

`mergeBackup(local, incoming)` deduplicates by UUID/key and keeps the record
with the later `updatedAt`. Singleton profile/app metadata needs explicit field
merge rules; user preferences from the incoming backup may replace local values
only with a preview and clear explanation. `replaceBackup` validates first,
creates an in-memory local snapshot, replaces all stores transactionally, and
restores that snapshot if the write fails. The UI owns the second destructive
confirmation; the domain function only receives an already-confirmed mode.

## 7. Content and plan boundary

Exercise definitions and A/B/C templates are checked-in, versioned static
TypeScript (or JSON validated at build time). They include every field in
[PLAN.md](PLAN.md): setup, steps, breathing/tempo, muscles, 3–5 cues, errors,
regressions/progressions, band warnings, compatible category, and exactly one
curated YouTube demonstration where available. Content tests should fail if a
plan slot points at a missing exercise, a media entry lacks attribution, or a
video is not marked as verified for a 41-inch loop band with no door anchor.

Keep the plan's six movements per workout, pair metadata, four-minute warm-up,
short cooldown, and optional five-minute desk reset in content rather than
hard-coding them in components. The desk reset is a separate content item and
never creates progression logs or advances the workout rotation.

The media renderer receives `ExerciseMedia` and an `isOnline` signal. It uses a
click-to-load `https://www.youtube-nocookie.com/embed/<id>` iframe only after
the user requests it, includes an attribution label and “Open on YouTube”
fallback, and displays written guidance/offline messaging when unavailable.
No runtime scraping, arbitrary image hotlinking, or YouTube response caching is
allowed.

## 8. PWA and browser integration boundaries

`vite-plugin-pwa`/Workbox owns the application shell, local static content,
icons, fonts, and service-worker lifecycle. Runtime data is still IndexedDB;
the service worker must not become a second database.

Browser-only services belong under `src/lib`:

- `clock.ts`: current instant, local date in an IANA timezone, and monotonic
  duration support. Domain code receives a clock interface.
- `crypto.ts`: Web Crypto SHA-256 implementation used by backup code through an
  injected function.
- `files.ts`: JSON serialization, `<input type=file>`, download, and iOS share
  sheet (`navigator.share` with file fallback). It must never report a backup as
  successful until the write/share handoff succeeds as defined by the UI.
- `pwa.ts`: service-worker registration, update-ready state, and deferred
  activation. If an active workout exists, prompt before `skipWaiting`.
- `storage.ts`: `navigator.storage.persist()` request and quota/persistence
  status. Failure is informational and must not block local writes.

Routes should be lazy where useful but all workout-critical code and static
content must be precached. The Today, Active Workout, History, and backup flows
must be usable with `navigator.onLine === false`. Offline/online state is a
non-blocking status indicator; writes continue to IndexedDB.

Use a mobile shell with safe-area padding, touch targets at least 44 CSS px,
visible focus styles, semantic headings/labels, keyboard-operable dialogs and
timers, and accessible text alternatives for color-coded bands. Retain usable
desktop layouts rather than assuming a phone width.

## 9. Dependency recommendations

Runtime dependencies:

- React + React DOM + TypeScript.
- Vite and `vite-plugin-pwa` (Workbox under the plugin).
- React Router for route boundaries.
- Dexie for typed IndexedDB transactions and migrations.
- Zod for backup, form, and import validation.
- Tailwind CSS for responsive styling.
- A small accessible headless component set (for example Radix primitives)
  only where it reduces dialog/menu/focus risk; avoid a large visual framework.
- `date-fns` plus `date-fns-tz` (or equivalent Temporal polyfill) for explicit
  timezone/date-only calculations. Do not rely on `new Date('YYYY-MM-DD')`
  semantics for user schedule dates.
- `lucide-react` or local SVGs for icons; no remote icon/font dependency.

Development/test dependencies:

- Vitest for pure domain, content, adapter, and migration tests.
- Testing Library + `@testing-library/user-event` for accessible component
  behavior.
- Playwright for iPhone-sized offline workout and backup/restore flows.
- `eslint`, `typescript --noEmit`, and a formatter (Prettier or the chosen
  ESLint formatting rules).
- `fake-indexeddb` for fast adapter tests where a real browser is unnecessary.

Avoid authentication clients, Supabase SDKs, analytics, tracking scripts,
server APIs, remote font loaders, and packages that require a backend. A future
Supabase integration should be a separate adapter package/dependency, not part
of the local build.

## 10. Key invariants and risk controls

| Invariant / risk | Control and test expectation |
| --- | --- |
| User data remains local | Only `IndexedDbStorageAdapter` imports Dexie/IndexedDB; static grep/review enforces this. |
| History is immutable in meaning | Schedule/band/substitution/plan changes create future state or snapshots; completed records are never rewritten. |
| Schedule timezone drift | Persist IANA timezone; test DST boundary and device timezone changes. |
| Flexible missed days create debt | Rotation advances from completed/explicitly skipped sessions, never elapsed calendar days. |
| Fixed missed days shift future plan | Resolve by weekday; late completion has original scheduled date and does not shift assignments. |
| Bad progression advice | Require two qualifying top-range performances, honor effort/form, and require confirmation. |
| Unsafe swap | Validate movement category and show the replacement guide before starting. |
| Partial persistence on interruption | Use Dexie transactions and resume from persisted session/set state. |
| Backup corruption or hostile JSON | Validate schema, references, versions, and checksum before any write. |
| Destructive replace loses data | Preview, second confirmation, in-memory snapshot, transactional restore on failure. |
| Checksum instability | Canonical stable serialization with deterministic key/order rules and tests. |
| YouTube unavailable/offline | Written content is complete; video is click-to-load and optional. |
| Service-worker update disrupts workout | Defer activation while active; prompt before reload. |
| Safari storage loss | Request persistence, show status, and prompt export after first workout/7 days/5 workouts. |
| Color/effort accessibility | Pair color with band number/name and text labels; test keyboard and screen-reader names. |
| Future cloud sync conflict | UUIDs, `updatedAt`, normalized records, and adapter-only persistence contract from v1. |

## 11. Acceptance criteria mapped to [PLAN.md](PLAN.md)

### Product and content

- Onboarding saves browser-timezone default, 2/3-day choice, flexible/fixed
  mode, fixed weekdays when applicable, Serious Steel 41-inch inventory, plan
  version, and safety acknowledgements.
- A/B/C content includes warm-up, six working movements in pairs, cooldown,
  initial two sets, and the optional desk reset excluded from progression.
- Every exercise guide contains all required written fields; every listed video
  is an exact, attributed, verified long-loop/no-door-anchor demonstration.
- Today, Active Workout, Exercises, History, and Settings routes work at iPhone
  width and remain keyboard/accessibility usable on desktop.

### Scheduling and training logic

- Flexible A→B or A→B→C behavior has no overdue queue and advances correctly
  after completion/explicit skip.
- Fixed weekdays show next date, permit late completion or skip, and preserve
  future weekday assignments.
- Date calculations use saved timezone; changing schedule settings leaves
  completed history untouched.
- Set logs capture reps/duration, one or multiple bands, setup adjustment, and
  all four effort states.
- Previous results and proposed targets are shown; double progression follows
  the two-performance rule and each recommendation requires confirmation.
- Swaps are category-limited and history remains under the original exercise.

### Storage and backup

- Components never directly import Dexie/IndexedDB; all persistence goes via
  `StorageAdapter` and the initial Dexie adapter.
- Versioned stores exist for profile, bands, substitutions, sessions,
  exercise logs, set logs, and app metadata; migrations preserve history.
- Export contains the required records, schema/app/export metadata, and valid
  SHA-256 checksum with a date-based filename/share path.
- Import previews contents, rejects malformed/future/checksum-invalid files,
  supports latest-`updatedAt` UUID merge, and protects replace behind a second
  confirmation and rollback snapshot.

### Offline/PWA and delivery

- Shell, written guides, templates, schedule, workout, history, and backup work
  offline; only YouTube media requires connectivity.
- Service-worker readiness is surfaced and activation is deferred during an
  active workout. Persistent-storage status and local-data-loss warnings are
  visible.
- Production build is a static Vercel `dist` deployment with no secrets,
  routes, backend API, auth, Supabase, analytics, or tracking.
- Type checking, linting, unit/component tests, Playwright offline and
  backup/restore flows, browser console review, responsive iPhone inspection,
  manifest/service-worker checks, and a direct-storage-access audit all pass.

## 12. Recommended implementation sequence

1. Scaffold Vite/React/TypeScript, test tooling, Tailwind, router, PWA, and
   strict lint/type settings.
2. Implement `domain/types`, content schemas, versioned plans/exercises, and
   pure schedule/progression/substitution/summary tests.
3. Define `StorageAdapter`, Dexie v1 schema/mappers, migrations, and adapter
   tests with an in-memory test adapter.
4. Implement backup canonicalization, checksum, validation, merge/replace, and
   file/share boundaries with failure tests.
5. Add onboarding and providers, then Today/Active Workout persistence and
   recovery flows.
6. Add Exercises/media, History, Settings, substitution UI, reminders, and
   storage status.
7. Integrate PWA caching/update behavior and accessibility/mobile polish.
8. Run unit/component/Playwright verification, inspect at iPhone viewport,
   review direct-storage imports and placeholders, then document local/Vercel/
   iPhone/backup/future-adapter use in `README.md`.

The architecture is complete when a screen can be switched from the IndexedDB
adapter to a deterministic in-memory adapter in tests without changing domain
logic or component contracts, and when a future cloud adapter can preserve all
UUIDs, timestamps, and normalized relationships without a history migration.
