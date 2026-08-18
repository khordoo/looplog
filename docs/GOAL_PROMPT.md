# Implementation Goal Prompt

Paste the following prompt into a fresh Codex session opened at `~/Projects/looplog`:

```text
/goal Build the complete local-only LoopLog PWA described in docs/PLAN.md. Continue until the application is deploy-ready and all required verification passes.

Act as the primary orchestrator, technical lead, and final reviewer. Read docs/PLAN.md completely before doing any implementation.

Sub-agent requirements:
- Explicitly delegate substantial, bounded work to sub-agents.
- Every spawned sub-agent must use model `gpt-5.6-luna` with reasoning effort `high`.
- Use at most three concurrent sub-agents.
- Give each agent clear, non-overlapping file ownership and acceptance criteria.
- Wait for agents to finish, inspect their actual changes, and provide follow-up tasks when their work is incomplete.
- Do not accept agent summaries as proof; review diffs, inspect files, and run verification yourself.
- You may make integration and corrective edits as the orchestrator, but delegate most implementation work.

Execution approach:
1. Inspect docs/PLAN.md and the empty repository.
2. Create a concise implementation sequence based on dependencies.
3. Use an initial delegation wave for independent architecture, exercise-content/media research, and testing/UX analysis if useful.
4. Synthesize those results before assigning implementation.
5. Delegate implementation in bounded packages with non-overlapping ownership, such as:
   - project scaffold, domain types, scheduling, progression, and storage adapter;
   - IndexedDB persistence, backup/restore, migrations, and tests;
   - application UI, workout flow, history, settings, PWA behavior, and accessibility.
6. Integrate the work, resolve inconsistencies, and send focused follow-up tasks to the same agents for corrections.
7. Perform final end-to-end review and verification.

Hard requirements:
- Follow docs/PLAN.md as the source of truth.
- Store all user data locally in IndexedDB through an adapter interface.
- No authentication, Supabase, backend API, database server, analytics, or tracking.
- Preserve an easy future path to a `SupabaseStorageAdapter`; UI components must never access Dexie or IndexedDB directly.
- The installed PWA must support the full workout flow offline, except for YouTube videos.
- Implement validated JSON export/import with merge and replace behavior.
- Curate and verify credible exercise demonstration videos matching long loop bands with no door anchor.
- Build mobile-first for iPhone while retaining accessible desktop behavior.
- Preserve docs/PLAN.md.
- Do not commit, push, publish, or deploy unless I explicitly request it.
- Do not ask routine implementation questions when docs/PLAN.md provides enough direction; make conservative, documented assumptions.

Verification required before completion:
- Dependency installation succeeds.
- Type checking, linting, unit tests, component tests, and production build pass.
- Relevant Playwright flows pass, including offline workout use and backup/restore.
- Inspect the running application in a browser at an iPhone viewport.
- Check browser console errors, responsive layout, keyboard accessibility, and PWA manifest/service-worker behavior.
- Review the final repository for direct IndexedDB access outside the storage adapter, unfinished placeholders, fake data paths, missing exercise guides, and obvious accessibility regressions.
- Update README with local development, testing, Vercel deployment, iPhone installation, backup/restore, and future Supabase-adapter guidance.

The goal is complete only when the implementation matches docs/PLAN.md, verification passes, and the repository is ready for a later Vercel deployment. At completion, report:
- what was built;
- verification commands and results;
- any remaining limitations;
- exact steps I should take to deploy to Vercel and install it on my iPhone.
```
