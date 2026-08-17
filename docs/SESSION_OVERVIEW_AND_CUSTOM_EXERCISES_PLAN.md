# Session overview and custom exercises plan

Status: proposed for review; no implementation has started.

## Recommendation

Use **Session A, Session B, and Session C**, not weekday names, as the primary
organization. A flexible schedule is a rotation rather than a Monday/Wednesday/
Friday plan. Fixed-schedule users can still see the assigned weekday as secondary
text.

Keep the Exercises page as the exercise library, but add a compact **Your
sessions** section above it. Today should show the complete next-session outline
without requiring another tap. Session editing should open on a dedicated page so
the library remains easy to browse.

Deliver this in three phases:

1. Complete the missing artwork and make every current session visible.
2. Allow built-in exercises to be added, removed, reordered, or retargeted in a
   session.
3. Add locally stored custom exercises with an optional photo and YouTube link.

This ordering gives the immediate clarity improvement first and prevents custom
content from being added before history, backup, and migration behavior is safe.

## UX specification

### Today

The next-workout card remains the primary action, but its exercise outline is
expanded by default:

```text
NEXT SESSION                         6 movements · about 30 min
Session A

[image] Band front squat             2 × 8–12
[image] Seated band row              2 × 8–12
[image] Band Romanian deadlift       2 × 8–12
[image] Band-resisted push-up        2 × 6–10
[image] Standing overhead press      2 × 8–12
[image] Dead bug                     2 × 6–10 / side

[ Start Session A ]
```

- Show every movement, not only the first three. The list is the information the
  user needs before committing to a session, so it must not be hidden in a
  disclosure.
- Show a small thumbnail, movement name, sets, reps or seconds, and per-side
  status.
- Session A and B currently contain six movements. Session C contains six primary
  movements plus the calf-raise accessory, so its displayed total is seven.
- A resumed session reads its outline from its existing exercise-log snapshot,
  not from a plan that may have been edited later.
- Keep the Start/Resume action after the outline. Missed-session actions retain
  their current behavior.

### Exercises

Place **Your sessions** above the search field. Show only the sessions enabled by
the profile: A/B for a two-day rotation and A/B/C for a three-day rotation.

Each card shows:

- Session letter and optional fixed weekday.
- Movement count and approximate duration.
- A small stack or row of exercise thumbnails.
- The first few exercise names plus a clear `View session` action.

The existing searchable **All exercises** gallery stays below this section. It
continues to answer “how do I perform this movement?” while session cards answer
“what am I doing in each workout?”

### Session detail

Add `/sessions/:workoutKey` as the canonical overview/editor route. In read mode it
shows the warm-up, ordered pairs, accessory movements, targets, and cooldown. It
must be useful before editing exists.

In edit mode:

- Reorder movements with accessible up/down controls; drag-and-drop may be an
  enhancement, never the only control.
- Add an exercise from the library, with compatible movement filters and search.
- Remove an exercise after confirmation.
- Edit sets and the rep or duration range.
- Restore the entire session to its built-in default.
- Save or cancel as an explicit transaction; do not partially apply edits.

Use `Remove from session` for plan changes. Reserve `Delete exercise` for a custom
exercise record so the two actions are not confused.

### Custom exercise form

The first version should be intentionally small:

- Required: name, movement category, target kind, target range, and sets.
- Optional: one photo, one YouTube URL, setup notes, movement steps, and up to
  three concise cues.
- Parse normal `youtube.com` and `youtu.be` URLs into a video ID and continue to
  use the privacy-enhanced, click-to-load player.
- Crop/resize a selected photo locally to a 640×640 WebP and enforce a compressed
  size limit before saving. The photo is stored only on the device; “upload” must
  not imply a server transfer.
- Show a generated icon fallback when no photo is supplied.

Custom exercises can be edited. “Delete” archives an exercise that has ever been
used, so old history remains readable; an unused custom exercise may be removed
permanently after confirmation.

## Missing artwork

Generate and review matching 640×640 local illustrations for:

- `reset-march` — Marching in place
- `reset-thoracic-rotation` — Thoracic rotation / book opener
- `reset-hip-flexor-stretch` — Half-kneeling hip-flexor stretch
- `reset-scapular-setting` — Shoulder-blade retractions
- `reset-bodyweight-squat` — Bodyweight squat

Use the same educational illustration language, neutral background, model,
lighting, and framing as the existing set. Review anatomy and final posture before
conversion to WebP. Expand the artwork coverage test from plan movements to the
entire 22-exercise built-in catalog. The assets remain local and precached.

## Data and history design

### User plan configuration

Do not mutate the built-in A/B/C templates. Add a persisted user plan
configuration that is materialized from the defaults only when the user first
edits a session.

- Add a `planConfigurations` IndexedDB store and adapter methods in a database
  migration.
- Give each editable slot a stable ID. Preserve existing default IDs such as
  `A-1`; added slots receive UUIDs.
- Change `defaultSets: 2` from a literal type to a validated positive integer.
- Resolve a session from user configuration when present, otherwise from the
  built-in template and existing substitutions.
- When a legacy substitution exists, materialize it into the first edited config
  so there is only one source of truth afterward.
- Record a configuration revision in `WorkoutSession.planVersion`.

Starting a session must snapshot its exact ordered exercise logs and targets.
Editing tomorrow's plan must never alter an in-progress or completed workout.

### Custom exercise records

Add a `customExercises` store through a later database migration. A record needs a
stable UUID, timestamps, archived state, exercise fields, optional YouTube video
ID, and optional compressed WebP data URL. Static and custom exercises are exposed
through one repository/adapter read API rather than imported directly by feature
components.

Add an optional `exerciseNameSnapshot` to exercise logs. This preserves the name
shown in history even if a custom exercise is renamed or archived later.

### Backup and restore

Both plan configurations and custom exercises, including compressed photo data,
must participate in export, Merge, Replace, checksum calculation, strict schema
validation, and rollback. Bump the backup schema and keep imports of the current
schema working. Reference validation must accept built-in IDs plus custom IDs.

No plan edit may rewrite old sessions, exercise logs, set logs, or progression
history.

## Delivery phases and acceptance criteria

### Phase 1 — Visibility and complete artwork

- Add the five missing images and full-catalog coverage test.
- Add reusable session-summary selectors/components.
- Show the expanded next-session list on Today.
- Add Your sessions to Exercises and a read-only session-detail route.
- Respect two-day versus three-day profiles and flexible versus fixed labels.
- Verify mobile layout, keyboard navigation, offline images, and service-worker
  updates.

Acceptance: before starting, the user can name and count every movement in the
next session; every built-in exercise card has an image.

### Phase 2 — Session builder using the built-in library

- Add the plan-configuration model, migration, adapter, backup support, and
  validation.
- Add transactional edit mode, add/remove/reorder/target controls, and restore
  defaults.
- Snapshot the resolved plan at session start.
- Preserve substitutions, active sessions, history, and progression behavior.

Acceptance: a changed session survives reload and backup/restore, and a newly
started workout exactly matches the saved order and targets. Earlier workouts are
unchanged.

### Phase 3 — Custom exercises

- Add local custom-exercise persistence and repository merging.
- Add create/edit/archive flows, local photo processing, and YouTube URL parsing.
- Allow custom exercises in session add/search.
- Include custom records and photos in backup/restore.
- Keep archived exercises readable from historical sessions.

Acceptance: a user can create an exercise offline, add it to a session, complete
it, export/restore the data, and still see the correct historical name and image.

## Test plan

- Unit: session resolution, stable IDs, configuration validation, migration,
  restore-default behavior, YouTube parsing, and archived-reference rules.
- Adapter: plan/custom CRUD, transactional saves, schema upgrades, Merge/Replace,
  and failed-import rollback.
- Component: Today outline, two/three-session display, fixed/flexible labels,
  editor keyboard controls, validation, and custom form.
- End to end: customize Session A, reload, start it, finish it, edit the plan again,
  confirm history is unchanged, then export/reset/restore.
- Visual/accessibility: iPhone viewport, long exercise names, no-image fallback,
  focus management, reduced motion, offline state, and no serious axe violations.

All existing typecheck, lint, unit, component, production build, PWA, end-to-end,
and accessibility gates remain required after each phase.

## Agent implementation sequence after approval

1. **Beauvoir (`content_correction`)**: generate and verify the five missing
   illustrations, refine session/custom-exercise microcopy, and extend content
   coverage tests.
2. **Rawls (`workout_correction`)**: own plan resolution, types, migrations,
   adapter/backup behavior, and snapshot invariants before UI editing begins.
3. **Halley (`ux_correction`)**: build Today/session overview UI first, then the
   session editor and custom-exercise form against Rawls's settled contracts.
4. **Primary integration**: resolve shared-file changes, run browser review and all
   quality gates, and commit each approved phase separately.

Phase 1 content and UI work may run in parallel after shared selectors are agreed.
Phases 2 and 3 should keep the domain/persistence contract one step ahead of UI
work to avoid conflicting data models.

## Decisions requested before implementation

Approval of this plan also approves these defaults:

1. Use Session A/B/C rather than naming sessions after weekdays.
2. Show the full next-session list on Today by default.
3. Keep All exercises as a library with Your sessions above it.
4. Deliver built-in session editing before custom exercise creation.
5. Store custom photos locally and include them in manual backups.

Any of these can be changed before Phase 1 begins.
