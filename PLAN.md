# Local-Only Training Tracker PWA

## Summary

Build an installable, mobile-first Progressive Web App for resistance-band workouts. It will run like an app from the iPhone Home Screen while remaining a normal website deployable free to Vercel.

- All personal data stays in the iPhone browser using IndexedDB.
- No account, authentication, Supabase, database server, or backend API.
- Workouts and written exercise guides work offline.
- Curated YouTube demonstrations require internet.
- JSON backup and restore protects against changing phones, clearing Safari data, or losing local storage.
- The storage layer remains replaceable so optional Supabase synchronization can be added later.

Runtime external services are limited to:

1. Vercel for static hosting.
2. YouTube for optional embedded exercise videos.

## Product Experience

### Installation and onboarding

- Explain how to open the site in Safari and select **Share → Add to Home Screen**.
- Collect:
  - Timezone, defaulting to the browser timezone.
  - Two or three training days.
  - Flexible rotation or fixed weekdays.
  - Confirmation of the available Serious Steel bands.
  - Confirmation that the user has no relevant medical restriction.
- Preconfigure the 41-inch Serious Steel set:
  - Purple #1: 5–35 lb nominal range.
  - Red #2: 10–50 lb nominal range.
  - Blue #3: 25–80 lb nominal range.
  - Green #4: 50–120 lb nominal range.
- Explain that these ranges vary with stretch and setup and are not equivalent to lifting a fixed weight.
- Include band-inspection, controlled-motion, pain, and safe-setup guidance.

### Primary screens

- **Today:** next workout, recovery state, duration, and prior workout summary.
- **Active Workout:** one exercise at a time, target, previous result, band selector, set logging, form guide, video, and rest timer.
- **Exercises:** searchable library with written instructions, muscles, alternatives, common errors, and demonstration videos.
- **History:** completed workouts and exercise-level progression.
- **Settings:** schedule, bands, exercise substitutions, backups, storage status, and reset controls.

### Schedule behavior

- Default to three 30-minute sessions in flexible A→B→C order.
- Allow switching between two and three days at any time.
- **Flexible mode:** show the next workout in sequence whenever the user is ready. Missed days do not create overdue sessions.
- **Fixed mode:** assign A/B/C in order to selected weekdays. Show the next date and allow a missed session to be completed late or skipped without shifting the future schedule.
- Two-day mode uses A→B; three-day mode uses A→B→C.
- Changing schedule settings never modifies completed history.
- Compute calendar behavior in the saved user timezone.

### Initial exercise program

Every workout includes a four-minute warm-up, six working movements arranged into pairs, and a short cooldown. Begin with two working sets per movement.

**Workout A**

- Band front squat
- Seated band row around the feet
- Band Romanian deadlift
- Band-resisted or incline push-up
- Standing band overhead press
- Dead bug

**Workout B**

- Reverse lunge, initially bodyweight
- Band floor press
- Band good morning
- Bent-over band row
- Band pull-apart
- Side plank

**Workout C**

- Split squat
- Band-resisted push-up
- Supported single-leg Romanian deadlift
- Seated or staggered-stance band row
- Band biceps curl paired with standing calf raise
- Bird dog

Also provide an optional five-minute desk reset that does not affect workout progression: marching, thoracic rotations, hip-flexor stretch, shoulder-blade retractions, and bodyweight squats.

### Exercise guidance and media

Each exercise definition contains:

- Setup and band placement.
- Step-by-step execution.
- Breathing and tempo guidance.
- Primary and secondary muscles.
- Three to five concise form cues.
- Common mistakes.
- Easier and harder variations.
- Exercise-specific band warnings.
- Compatible substitution category.

Curate one exact YouTube demonstration per exercise from a reputable clinical, coaching, or manufacturer source. Every video must show a 41-inch-style loop band without a door anchor and agree with the written instructions.

Use lazy, click-to-load `youtube-nocookie.com` embeds with attribution and an “Open on YouTube” fallback. Do not scrape the web at runtime or hotlink arbitrary images. When offline, retain all written instructions and show that the video needs connectivity.

### Workout logging and recommendations

For every set, record:

- Repetitions or duration.
- Band color or bodyweight.
- Optional multiple-band combination.
- Setup adjustment, such as standard or shortened grip.
- Effort:
  - Easy: at least three clean reps remained.
  - Just right: one or two clean reps remained.
  - Max effort: no clean reps remained.
  - Form broke: resistance or target was too difficult.

Before an exercise, display the last result and a proposed target. Use double progression:

- Most exercises begin at 2×8–12.
- Increase reps while retaining the same band and clean form.
- After two consecutive performances at the top of the range with “easy” or “just right” effort, suggest a harder setup, band, or third set.
- If the minimum reps cannot be completed or form breaks, suggest an easier band, fewer reps, or the defined regression.
- Require confirmation before applying every recommendation.

Permit exercise swaps only within compatible movement categories. Preserve completed history under the original exercise.

## Technical Implementation

### Application stack

- Vite, React, and TypeScript.
- Tailwind CSS and accessible headless components.
- React Router for application routes.
- Dexie as the typed IndexedDB wrapper.
- Zod for imported-backup and form validation.
- `vite-plugin-pwa` with Workbox for manifest generation, service worker updates, and offline caching.
- Vitest, Testing Library, and Playwright for verification.
- Static Vercel deployment from the generated `dist` directory.

The application has no server routes, secrets, authentication SDK, database credentials, or environment-specific backend configuration.

### Storage architecture and future Supabase support

Define a storage interface that contains every persistence operation used by the UI and domain layer. The initial `IndexedDbStorageAdapter` implements it with Dexie. Components must never import Dexie or access IndexedDB directly.

The interface covers:

- Profile and schedule reads/writes.
- Band inventory reads/writes.
- Exercise substitution reads/writes.
- Workout session lifecycle.
- Exercise and set log persistence.
- History and recent-performance queries.
- Full data export/import.

A future `SupabaseStorageAdapter` will implement the same interface. UUID identifiers, timestamps, normalized records, and adapter-neutral domain types must be used from the start so adding synchronization does not require rewriting screens or training logic.

### Local data model

Use a versioned Dexie database with these stores:

- `profile`
  - Singleton ID, timezone, days per week, schedule mode, fixed weekdays, plan version, onboarding completion, timestamps.
- `bands`
  - Stable key, brand, length, number, display color, nominal range, enabled state, and optional nickname.
- `substitutions`
  - Plan slot ID, selected exercise ID, and timestamp.
- `sessions`
  - UUID, workout key, plan version, scheduled date, status, start/completion time, duration, and notes.
- `exerciseLogs`
  - UUID, session ID, exercise ID, order, confirmed target snapshot, and note.
- `setLogs`
  - UUID, exercise-log ID, set number, reps or duration, band keys, setup adjustment, effort, and completion time.
- `appMeta`
  - Database version, last successful export time, install state, dismissed notices, and update metadata.

Use UUIDs so future cloud synchronization can be added without changing identifiers. Every record includes timestamps. Dexie schema upgrades must migrate existing data without deleting workout history.

Exercise definitions and program templates remain versioned static TypeScript/JSON content rather than user data.

### Domain interfaces

Define shared types for:

- `Profile`
- `Band`
- `Exercise`
- `ExerciseAlternative`
- `PlanTemplate`
- `PlanSlot`
- `ScheduleSettings`
- `WorkoutSession`
- `ExerciseLog`
- `SetLog`
- `EffortRating`
- `WorkoutRecommendation`
- `BackupEnvelope`

Implement pure functions for:

- Determining today’s workout.
- Advancing flexible rotation.
- Resolving fixed schedules and missed days.
- Recommending the next target.
- Validating substitutions.
- Summarizing completed workouts.
- Exporting, validating, merging, and replacing backup data.

### Backup and restore

Export a single human-readable JSON file with:

- Schema version.
- App version.
- Export timestamp.
- Profile and schedule.
- Band inventory.
- Substitutions.
- Sessions, exercise logs, and set logs.
- A SHA-256 content checksum.

Use a filename such as `training-tracker-backup-2026-08-16.json` and invoke the iOS share sheet so it can be saved to Files or iCloud Drive.

Backup behavior:

- Prompt for the first backup after the first completed workout.
- Remind the user after seven days or five additional workouts without an export.
- Show the last successful backup date on Today and Settings.
- Never claim that an automatic cloud backup exists.

Restore behavior:

- Validate the file and supported schema before changing data.
- Show a preview with workout count, date range, bands, and export date.
- Default to **Merge**, deduplicating by UUID and keeping the record with the latest `updatedAt`.
- Offer **Replace all local data** only behind a second destructive confirmation.
- Create an in-memory safety snapshot before replacement and restore it automatically if import fails.
- Reject malformed, future-version, or checksum-invalid files with a clear error.

### PWA and offline behavior

Cache:

- Application shell.
- Fonts, icons, and local visual assets.
- Exercise definitions and written guidance.
- Program templates.

Do not cache arbitrary YouTube responses. The entire workout, history, schedule, recommendation, and backup experience must work offline; only videos are unavailable.

- Show offline/online status without blocking local writes.
- Display an update prompt when a new service worker is ready.
- Never activate an update in the middle of an active workout without confirmation.
- Request persistent browser storage where supported and display the reported storage status.
- Warn that deleting Safari website data, uninstalling the PWA, or changing the production domain can remove access to unexported history.
- Use one stable Vercel production URL from the first public deployment.

### Visual and accessibility direction

- Optimize first for an iPhone-sized portrait viewport.
- Use large one-handed controls during workouts.
- Keep the current exercise, last result, band choice, and set completion controls above the fold.
- Represent every band with color, number, and text; never rely on color alone.
- Meet WCAG AA contrast and support keyboard navigation, visible focus, reduced motion, semantic errors, and screen-reader labels.
- Use a calm neutral palette with band colors reserved for equipment identification.

## Deployment and Verification

### Deployment handoff

Provide:

- A Vercel-compatible repository with build configuration.
- PWA manifest, icons, iOS home-screen metadata, and service worker.
- A stable production deployment guide.
- Instructions for installing on iPhone.
- Backup, restore, phone-migration, and recovery instructions.
- A media-maintenance document listing every video source and verification date.
- No environment variables unless optional analytics are explicitly added later.

### Tests

- Unit-test flexible and fixed schedules, two/three-day changes, missed workouts, Toronto timezone boundaries, and daylight-saving transitions.
- Unit-test every progression outcome.
- Validate movement-pattern coverage in all program configurations.
- Test IndexedDB creation, migrations, session resume, and cascade deletion.
- Test backup round trips, merge conflicts, replacement rollback, checksum failure, malformed data, and future schema versions.
- Component-test onboarding, band selection, last-performance display, effort controls, substitutions, offline messaging, and backup reminders.
- Playwright-test:
  - Installation metadata and offline startup.
  - Complete onboarding.
  - Start a workout, refresh, resume, and finish.
  - Verify history and the next recommendation.
  - Switch schedule modes and frequency.
  - Swap and restore an exercise.
  - Export, reset, restore, and verify identical history.
  - Complete a full workout with the network disabled.
- Run type checking, linting, unit tests, production build, accessibility scanning, and mobile-browser tests in CI.

## Assumptions

- The app is intended for one person on one primary iPhone.
- Manual JSON export to Files or iCloud is an acceptable backup mechanism.
- Cross-device synchronization and browser-based login are out of scope for V1.
- Data is protected by the iPhone’s device security but is not separately encrypted inside IndexedDB or the exported JSON file.
- The product provides general exercise guidance, not medical diagnosis, rehabilitation, or clinician-supervised programming.
- Push notifications, social functionality, calorie tracking, live form analysis, and AI-generated workouts are out of scope.
- Supabase can be added later through the storage adapter without changing the workout UI, identifiers, or core domain logic.
