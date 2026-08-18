# LoopLog UX, Accessibility, and Verification Matrix

This is the implementation-ready verification contract for the local-only LoopLog PWA described in [PLAN.md](PLAN.md). It defines the route and state vocabulary, observable test hooks, user-flow coverage, accessibility expectations, and evidence required before release. It intentionally does not prescribe a visual design beyond the product requirements; tests should assert user-visible behavior and semantics rather than implementation details.

## 1. Test conventions and testability hooks

Use stable semantic roles, accessible names, and labels as the primary selectors. Add the following `data-testid` hooks only where a role/name is not sufficient (for example, a repeated set row or a status region). Test IDs are an API between the UI and verification suite and should not be renamed casually.

### Global hooks

| Hook | Element/state | Required observable value |
|---|---|---|
| `app-shell` | Root application landmark | One `main`, one `nav` where applicable; no uncaught render error |
| `route-loading` | Route/data loading state | Busy status is announced; disappears after persistence read |
| `offline-status` | Online/offline indicator | `Online` or `Offline`; does not block local actions |
| `update-status` | Service-worker update notice | Ready update message, `Update` and `Later` actions |
| `storage-status` | Settings storage panel | Persistence support/request/result and last export status |
| `toast-region` | Polite status live region | Save/export/import/recommendation outcomes; no critical information only in toast |
| `confirm-dialog` | Modal confirmation | `role="dialog"`, labelled title, focus trapped, Escape behavior documented |

### Route and domain hooks

| Hook | Required use |
|---|---|
| `onboarding-step-{timezone,days,schedule,bands,safety,complete}` | Current onboarding step and progress state |
| `onboarding-next`, `onboarding-back`, `onboarding-finish` | Navigation actions with disabled/validation state |
| `schedule-days-{2,3}`, `schedule-mode-{flexible,fixed}` | Frequency/mode controls; selected state is queryable |
| `weekday-{mon..sun}` | Fixed-weekday toggle; unavailable/duplicate-day validation |
| `band-row-{bandKey}` and `band-enabled-{bandKey}` | Band inventory row and enabled state |
| `today-next-workout`, `today-recovery-state`, `today-prior-summary` | Today summary regions |
| `start-workout`, `resume-workout`, `finish-workout`, `skip-workout` | Session lifecycle actions |
| `active-exercise`, `active-target`, `previous-result`, `band-selector`, `setup-adjustment`, `effort-{easy,just-right,max-effort,form-broke}` | Active workout data and controls |
| `set-row-{exerciseLogId}-{setNumber}`, `set-reps`, `set-duration`, `set-complete` | Per-set entry and completion |
| `rest-timer`, `rest-timer-pause`, `rest-timer-skip` | Timer state and controls |
| `exercise-search`, `exercise-card-{exerciseId}`, `exercise-guide` | Exercise library/search/detail |
| `history-list`, `history-session-{sessionId}`, `history-exercise-{exerciseId}` | Completed sessions and progression |
| `substitution-row-{planSlotId}`, `substitution-select`, `restore-substitution` | Compatible swap and restore |
| `backup-export`, `backup-file-input`, `backup-preview`, `backup-merge`, `backup-replace`, `backup-cancel`, `backup-error` | Backup/restore flow |
| `reset-local-data`, `reset-confirm`, `reset-cancel` | Destructive reset confirmation |

Fixtures should use deterministic UUIDs, fixed timestamps, and an injectable clock/timezone. Playwright should use a test-only storage adapter or clearable IndexedDB seeded through an app-supported fixture path; do not make tests depend on private Dexie tables or production-only data.

Recommended test-only seams:

1. `MemoryStorageAdapter` implementing the same storage interface as IndexedDB, for unit/component tests.
2. A Playwright fixture that seeds a valid profile, bands, sessions, and logs through the adapter or an explicit `window.__TEST__` bridge enabled only in test builds.
3. Injectable `now`, `timezone`, `navigator.onLine`, service-worker registration, file picker, share/download, `confirm`, and persistent-storage request capabilities.
4. A deterministic UUID provider for unit tests; production UUIDs remain stable and random enough for backup deduplication.
5. A `window.__TEST__.getState()` read-only diagnostic in test builds, or equivalent visible UI assertions, to verify persistence after reload without importing database internals.

## 2. Route, screen, and state map

| Route | Screen purpose | Entry/exit | Required states and assertions |
|---|---|---|---|
| `/` | Bootstrap/redirect | Open app | Read profile and metadata; show `route-loading`; redirect to `/onboarding` when incomplete, otherwise `/today`; no flash of the wrong screen |
| `/onboarding` | Guided first-run setup | First launch or incomplete profile | Step progress, back/next, validation, safe guidance, timezone, 2/3 days, flexible/fixed schedule, bands, safety acknowledgement; refresh preserves only completed valid steps; final save is atomic |
| `/today` | Daily home | Bottom navigation or post-onboarding | Next workout, recovery state, duration, prior summary, next recommendation, backup reminder, online/offline status; empty/new-user state; active-session resume CTA; no overdue claim in flexible mode |
| `/workout/:sessionId` | Active workout | Start/resume Today or History | Warm-up → six movements → cooldown; one exercise at a time; target/previous result/band/set controls above fold; pause/leave/resume; autosave each meaningful edit; rest timer; video connectivity fallback; finish and skip outcomes |
| `/exercises` | Searchable exercise library | Navigation | Search is labelable and case-insensitive; no-results state; cards expose name/category/muscles; keyboard and screen-reader usable |
| `/exercises/:exerciseId` | Written guide and optional demo | Exercise card | Setup, steps, breathing/tempo, muscles, 3–5 cues, mistakes, easier/harder variants, warnings, compatible substitution category; video lazy-loads only on request; offline retains guide and says video needs connectivity |
| `/history` | Completed sessions/progression | Navigation or post-finish | Chronological completed sessions, duration/date/workout key, exercise-level progression, empty state; original exercise remains represented after substitution |
| `/history/:sessionId` | Session detail | History row | Read-only completed logs, target snapshot, band/setup/effort, notes; no accidental mutation of history |
| `/settings` | Settings hub | Navigation | Schedule, bands, substitutions, backups, storage status, update notice, reset; changes save locally and do not alter completed history |
| `/settings/schedule` | Schedule editor | Settings | 2/3 days, flexible/fixed, valid weekdays, preview of next date/workout, Toronto timezone/DST handling, late/skip semantics, save/cancel |
| `/settings/bands` | Inventory editor | Settings | Four preconfigured 41-inch bands with number/color/text/range; enable/disable/nickname; color never sole identifier; save persistence |
| `/settings/substitutions` | Compatible movement swaps | Settings | Only compatible category options; save and restore defaults; completed history retains original exercise ID |
| `/settings/backups` | Export/import/reset | Settings or reminder | Last successful export, export action/share/download, file validation preview, merge default, replace behind second destructive confirmation, rollback on failure |
| `/settings/storage` | Local data and update status | Settings | IndexedDB/persistent-storage status, last export, offline warning, production-domain/Safari-data loss guidance, update ready state |

Modal/overlay states are part of the route contract: recommendation confirmation, leave-active-workout confirmation, replace-all confirmation, reset confirmation, import preview, import error, and update-ready confirmation. Each must preserve the invoking route, restore focus on close, and never discard unsaved local writes silently.

### Cross-cutting state model

Every screen should model these independently rather than using a single ambiguous loading flag:

| State | User-visible behavior | Verification |
|---|---|---|
| `loading` | Skeleton/busy status; controls unavailable only when necessary | No duplicate submit; status announced |
| `ready` | Normal interactive screen | Correct persisted values shown |
| `saving` | Save affordance indicates progress | Reload after completion shows saved value |
| `save-error` | Clear recoverable error and retry | Existing value remains intact |
| `offline` | Banner/status, local writes continue | Workout/history/settings/backup validation remain usable; video says connectivity required |
| `active-session` | Resume/leave behavior and autosave | Refresh restores exact current exercise and entered sets |
| `update-ready` | Non-blocking prompt | Update can wait; active workout never activates update without confirmation |
| `import-preview` | Counts/date range/bands/export date and Merge default | No local mutation before confirmation |
| `importing` | Progress/busy state | Double submit prevented |
| `import-success` | Summary of added/updated/unchanged records | Reload confirms result |
| `import-error` | Specific malformed/future/checksum/transaction error | Local data unchanged or safety snapshot restored |

## 3. End-to-end and component flow matrix

Priority `P0` means release-blocking; `P1` is required before public deployment; `P2` is a useful regression guard.

| ID | Priority | Flow / setup | Expected assertions and evidence |
|---|---|---|---|
| UX-001 | P0 | Fresh browser, no profile | `/` redirects to onboarding; no backend/network dependency; install guidance explains Safari Share → Add to Home Screen |
| UX-002 | P0 | Complete onboarding with browser timezone, 3 days, flexible, all four bands, safety acknowledgement | Profile has timezone/days/mode/bands/onboarding completion; `/today` shows Workout A; refresh remains complete; screenshot at iPhone viewport |
| UX-003 | P0 | Onboarding invalid/partial values | Cannot continue without required safety acknowledgement, valid day count, valid fixed weekdays, and band confirmation; inline semantic errors are associated with fields and announced |
| UX-004 | P1 | Refresh/close during each onboarding step | Completed writes resume at the last valid step; no partially committed profile is treated as complete |
| UX-005 | P0 | New profile on Today | Next workout, recovery state, default 30-minute duration, no prior summary, and backup guidance are visible above/near fold; offline status does not block |
| UX-006 | P0 | Start Workout A, log sets, refresh mid-exercise | Active session restores same session/exercise/order, target snapshot, bands, entered reps/duration, setup, effort, and completion state; no duplicate set |
| UX-007 | P0 | Leave active workout, choose resume | Confirmation warns about progress; resume returns to exact state; cancel leaves active route intact |
| UX-008 | P0 | Complete full workout including cooldown | Session marked completed once, duration/completion time saved, Today/history updated, next recommendation shown; finish is idempotent |
| UX-009 | P1 | Skip a workout in fixed schedule | Session is skipped/late per choice; future weekday assignments do not shift; history is not falsely marked completed |
| UX-010 | P1 | Exercises search/filter/detail | Search result is keyboard accessible; guide includes all required fields; lazy YouTube embed loads only after explicit action; offline guide remains available |
| UX-011 | P1 | History after completed and substituted workout | Session and exercise progression render; original exercise remains in historical record even when current slot has a substitution |
| UX-012 | P0 | Change schedule 3→2 and 2→3 | Current rotation/settings update as specified; completed history unchanged; Today preview recomputes; no duplicate/missing completed records |
| UX-013 | P0 | Flexible mode missed dates | Advancing the clock across missed days leaves next sequence item ready, with no overdue session or calendar-date obligation |
| UX-014 | P0 | Fixed mode selected weekdays, late and skip | A/B/C assigned in order to selected weekdays; late completion allowed; skip does not shift future schedule; saved timezone governs calendar date |
| UX-015 | P1 | Toronto timezone around midnight and DST | Today/next-date and fixed schedule use saved Toronto time, not device display timezone; DST spring/fall boundary has no duplicate or skipped assignment |
| UX-016 | P1 | Swap exercise within compatible category | Only compatible alternatives selectable; confirmation required; active/current slot uses replacement; completed history preserves original |
| UX-017 | P1 | Restore default substitution | Slot returns to plan exercise and persists after reload; existing history untouched |
| UX-018 | P0 | Export after first completed workout | Human-readable JSON download/share has schema/app/export metadata, all required stores, UUIDs/timestamps, SHA-256 checksum, and expected filename; Today/Settings show last successful export |
| UX-019 | P0 | Import valid backup with non-conflicting data | Preview shows workout count/date range/bands/export date; Merge is default; confirmation mutates only after approval; reload verifies records |
| UX-020 | P0 | Merge same UUID with older/newer `updatedAt` | Latest record wins; duplicate UUIDs are not created; unchanged local records remain; result summary reports added/updated/unchanged |
| UX-021 | P0 | Replace all local data | Requires second destructive confirmation; replacement restores profile/bands/substitutions/sessions/logs; history is identical to source backup |
| UX-022 | P0 | Malformed, future-version, checksum-invalid, or failing import | Clear error identifies validation class; no partial writes; in-memory snapshot automatically restores local data after transaction failure |
| UX-023 | P1 | Reset local data | Explicit warning names irreversibility/unexported data; cancel has no effect; confirm clears all local records and returns onboarding; no server call |
| UX-024 | P0 | Full workout with network disabled before load | App shell, guides, schedule, logging, recommendation, history, and backup validation work offline; only video unavailable with explicit fallback |
| UX-025 | P1 | Toggle offline/online during active workout | Offline indicator changes without losing edits; local writes succeed; reconnect does not unexpectedly reload or end session |
| UX-026 | P1 | Service worker update ready during active workout | Non-blocking notice; choosing Later leaves session; choosing Update requires confirmation and does not silently activate mid-workout |
| UX-027 | P1 | Persistent-storage supported/denied/unknown | Settings reports browser result accurately and displays Safari/PWA data-loss warning; no false cloud-backup claim |
| UX-028 | P0 | iPhone portrait 320–430 CSS px width, normal and large text | No horizontal scrolling or clipped primary controls; active exercise/last result/band/set controls remain above fold where practical; touch targets are at least 44×44 CSS px |
| UX-029 | P0 | Keyboard-only desktop pass | Logical tab order, visible focus, Escape closes dialogs, Enter/Space activate controls, no focus trap outside modal, no keyboard-only dead end |
| UX-030 | P0 | Screen-reader pass | Landmarks/headings, labels, errors, live save/offline/timer status, selected/disabled states, and dialog focus are announced meaningfully |
| UX-031 | P1 | `prefers-reduced-motion: reduce` | Timers/transitions/celebrations become instant or non-animated; information and focus behavior remain intact |
| UX-032 | P0 | Contrast/semantics scan | WCAG AA text/non-text contrast, form labels, button names, heading hierarchy, link purpose, alt text, no color-only band/effort meaning; axe scan has no serious/critical violations |

## 4. Unit-test matrix

Unit tests should target pure domain functions and adapter contract behavior. Each test uses a fixed clock and explicit IANA timezone.

### Scheduling and time

| Unit area | Required cases |
|---|---|
| `determineTodaysWorkout` | New profile; flexible A→B→C and A→B; completed session advances; skipped session; active session takes precedence; no overdue label in flexible mode |
| Fixed resolver | Selected weekdays map A/B/C in order; two-day A/B; late completion; explicit skip; future assignments unchanged after missed day; duplicate/invalid weekday rejection |
| Schedule changes | 3→2 and 2→3 preserve completed sessions and UUIDs; current rotation is deterministic; changing mode/frequency does not rewrite history |
| Timezone | Toronto (`America/Toronto`) date boundary around 23:59/00:01; device timezone differs from saved timezone; UTC conversion does not alter saved calendar date |
| DST | Spring-forward and fall-back in Toronto; fixed weekday remains one assignment; no duplicate workout or missing day; session timestamps retain offset/instant correctly |
| Progression | Top-range twice + easy/just-right suggests harder setup/third set; max effort/form broke/minimum failure suggests regression; middle-range/no qualifying effort holds target; every recommendation requires confirmation before persistence |
| Substitutions | Compatible category accepted; incompatible category rejected; restore defaults; historical exercise ID unaffected |
| Summaries | Duration, completion, prior result, and exercise progression aggregate deterministically; optional desk reset never affects progression |

### Storage, backup, and adapters

| Unit area | Required cases |
|---|---|
| Adapter contract | Profile/bands/substitution CRUD; session lifecycle; exercise/set logs; history queries; recent performance; export/import all callable without UI importing Dexie |
| Dexie creation/migration | Fresh schema creation; each schema upgrade; existing records survive; timestamps/UUIDs retained; no destructive migration |
| Cascade deletion | Reset removes profile, bands, substitutions, sessions, exercise logs, set logs, and app metadata; orphan logs are not left behind |
| Export | All required stores, schema/app/export metadata, stable UUIDs, normalized timestamps, human-readable JSON, deterministic checksum over defined canonical payload |
| Import validation | Malformed JSON, missing fields, invalid Zod values, unsupported future schema, checksum mismatch, duplicate IDs, invalid references |
| Merge | Deduplicate by UUID; newest `updatedAt` wins; imported/local additions and unchanged records retained; transaction is atomic |
| Replace/rollback | Snapshot made before replacement; successful replace exactly matches source; injected failure restores snapshot; no partial data |

## 5. Component-test matrix (Testing Library/Vitest)

Component tests should use `MemoryStorageAdapter`, fake timers, and mocked browser capabilities. Assert rendered semantics, calls through the storage interface, and visible state transitions.

| Component | Tests |
|---|---|
| Onboarding wizard | Step navigation; required validation; timezone default; two/three-day controls; flexible/fixed weekdays; all bands and safety acknowledgement; refresh/partial save; final atomic profile save |
| Today screen | New-user empty state; next workout/recovery/prior summary; active-session resume; recommendation confirmation; backup reminder thresholds; offline and update notices |
| Active workout | Target/previous result; band and multiple-band selection; setup adjustment; reps/duration validation; effort options; set autosave; rest timer; next exercise; leave/resume; finish/skip; offline video fallback; update confirmation |
| Exercise library/detail | Search/no results; required guide sections; alternatives; lazy video activation; attribution/fallback; offline wording; semantic headings and labels |
| History | Empty/list/detail; chronological sorting; exercise progression; substituted current slot vs original historical exercise |
| Settings/schedule | Save/cancel; mode/frequency/weekday validation; preview; timezone/DST fixture; no history mutation |
| Settings/bands | Four defaults; color+number+text; enable/disable/nickname; persistence and keyboard controls |
| Settings/substitutions | Compatible-only options; confirmation; restore defaults; history unaffected |
| Backup UI | Export metadata/status; file picker; preview; Merge default; replace second confirmation; validation errors; rollback message; reset confirmation |
| Status/dialog primitives | Live regions; focus trap/restore; Escape; visible focus; disabled/busy semantics; reduced-motion behavior |

## 6. Playwright flow specifications

Use Chromium for deterministic CI and a WebKit project for iPhone-like Safari coverage where available. Each P0 flow should collect a trace on failure, screenshot at the key assertion, console/page errors, and an IndexedDB/storage snapshot through the supported test seam.

1. `pwa-install-metadata`: build/serve production output; verify manifest name/start URL/display/icons, iOS home-screen metadata, service worker registration, app shell startup, and no console errors.
2. `onboarding-to-today`: clear storage; complete every onboarding step; assert `/today`, profile persistence after reload, Workout A, 30-minute duration, and installation guidance.
3. `active-workout-resume-finish`: start A, log at least one set with band/setup/effort, reload, resume, finish all movements, assert completed history and next recommendation.
4. `schedule-modes-and-missed`: seed deterministic sessions; change flexible/fixed and 2/3 days; advance mocked clock across missed day and Toronto DST fixture; assert dates/order/history.
5. `exercise-swap-history`: swap compatible movement, complete a session, restore default, and assert current slot plus original historical exercise.
6. `backup-round-trip`: create history, export, reset, import file, choose Merge or Replace, reload, and assert identical session/log values and checksum metadata.
7. `backup-errors-and-rollback`: import malformed, future, checksum-invalid, and transaction-failure fixtures; assert clear error and unchanged state after each.
8. `offline-complete-workout`: install/prime app, disable network, reload, complete full workout, inspect written guide and video fallback, assert history and local writes.
9. `update-during-workout`: mock waiting service worker while session active; assert update notice is non-blocking and activation requires confirmation.
10. `responsive-accessibility`: run at 320×667, 375×812, 390×844, and 430×932; keyboard traversal; reduced-motion context; axe scan; assert no horizontal overflow, clipped controls, focus loss, or serious/critical violations.

## 7. Accessibility and iPhone acceptance checklist

These are release gates, not optional polish:

- Every page has a meaningful title, one primary `main`, logical heading hierarchy, and a skip link or equivalent route navigation shortcut.
- All inputs have visible labels; errors identify the field, explain correction, and are programmatically associated. Do not rely on placeholder text.
- All controls have accessible names and selected/checked/disabled/busy states. Band identity always combines color, number, and text/range.
- Focus is visible against every background, remains inside modal dialogs, moves to the dialog heading on open, and returns to the invoking control on close.
- Live regions announce offline/online changes, save completion/failure, import results, recommendation confirmation, and timer completion without repeatedly interrupting typing.
- Contrast meets WCAG 2.2 AA: normal text 4.5:1, large text 3:1, and meaningful non-text controls/focus indicators 3:1. Verify with axe plus a manual contrast sample for band colors.
- Touch targets are at least 44×44 CSS px with adequate spacing. Workout actions are reachable one-handed and are not hidden behind a timer or video.
- Motion honors `prefers-reduced-motion`; no required information is communicated only through animation, color, sound, or vibration.
- YouTube iframes have a useful title and are not auto-loaded; “Open on YouTube” has a descriptive accessible name. Offline text explicitly explains that written guidance remains available.
- At 320 px width and iPhone portrait widths, content does not require horizontal scrolling. Test Dynamic Type/large browser text, safe-area insets, keyboard appearance, and long exercise names.
- iOS Safari/PWA checks include Share → Add to Home Screen guidance, standalone launch metadata, file share/download fallback, and behavior after Safari website-data deletion warning. Do not claim automatic cloud backup.

## 8. CI commands, dependencies, and artifacts

The exact package scripts may be named differently, but CI must expose equivalent commands and fail on non-zero exit:

```sh
npm ci
npm run typecheck
npm run lint
npm run test:unit -- --run
npm run test:component -- --run
npm run build
npx playwright install --with-deps chromium webkit
npm run test:e2e
npm run test:a11y
```

Recommended `package.json` dev dependencies are TypeScript, Vite/React type packages, Vitest, Testing Library (`@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`), Playwright, `axe-playwright` or `@axe-core/playwright`, ESLint with React/TypeScript plugins, and a formatter. Runtime requirements come from the plan: React, React Router, Dexie, Zod, Tailwind CSS, `vite-plugin-pwa`, and Workbox integration. CI should cache npm and Playwright browsers, run the production build before E2E, and serve `dist` using the same static shape intended for Vercel.

Required CI artifacts on failure: Playwright HTML report/trace/screenshots/videos, axe JSON or SARIF, unit/component coverage, TypeScript/lint logs, and the built `dist` manifest/service-worker inspection output. A release job should also run a static scan that fails if UI/domain code imports Dexie/IndexedDB outside the storage adapter and a scan for backend/auth/analytics SDKs or environment secrets.

## 9. Requirement-to-evidence traceability

| PLAN requirement | Minimum evidence |
|---|---|
| Local-only IndexedDB through replaceable adapter | Adapter contract unit tests; static import scan; E2E reload persistence; no backend/auth/network calls in request log |
| Onboarding and safety guidance | UX-001–004 Playwright traces/screenshots; onboarding component tests; accessible labels/errors |
| Two/three-day flexible/fixed schedule | Schedule unit cases; UX-012–015 E2E with deterministic timezone/DST fixtures; history unchanged assertion |
| Complete workout offline except video | UX-024/025 trace with network disabled; written-guide assertion; video fallback assertion |
| Resume, logging, recommendations, finish/history | UX-006–008 E2E plus active-workout component/unit coverage; persisted state snapshot |
| Exercise guidance/media/substitutions | UX-010/016/017; content-schema validation; guide completeness test; lazy iframe/network assertion |
| Backup/export/share and reminders | UX-018; export schema/checksum unit test; Today/Settings reminder component test; filename/share fallback evidence |
| Merge/replace/validation/rollback | UX-019–022; malformed/future/checksum/transaction unit fixtures; before/after storage snapshots |
| PWA/update/storage warnings | UX-026/027; manifest/service-worker E2E; mocked persistent-storage outcomes; active-session update evidence |
| Mobile-first iPhone and accessibility | UX-028–032; responsive screenshots; axe report; keyboard and screen-reader checklist; reduced-motion run |
| Migration/cascade safety | Dexie migration/cascade unit tests; reset E2E; static schema review; history-preservation assertion |
| Verification and Vercel-ready static build | CI logs for typecheck/lint/unit/component/build/E2E/a11y; `dist` served successfully; no required runtime secrets |

## 10. Release gate

Release is blocked if any P0 row fails, if a serious/critical accessibility violation remains, if a full offline workout cannot be completed and persisted, if import can partially mutate data on validation/transaction failure, if schedule changes rewrite history, or if a UI component accesses IndexedDB directly. P1 rows must pass before the first public Vercel deployment; P2 regressions may be tracked with an owner and due date but must not hide a P0 failure.
