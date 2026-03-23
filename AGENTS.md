# Organization Context Pointer

Use the ContactPit organization context system for cross-repo coordination.

- Canonical organization context reference: `../org-context`
- Repository index: `../org-context/repos.md`
- Usage rule: load only files directly relevant to the current task.
- Deprecation: absolute `/Users/...` org-context paths and legacy refresh-script workflows are deprecated.

## Task Routing And Workspace Rule

- Repo-local manual tasks for this repository live in `../org-context/tasks/manual/website/`.
- Automation backlog tasks for this repository live in `../org-context/tasks/automation/website/`.
- Cross-repo manual tasks live in `../org-context/tasks/manual/cross-repo/`.
- When creating a task from this repository, route repo-local work to the matching repo folder and multi-repo or uncertain work to `manual/cross-repo/`.
- Automation-generated tasks must stay repo-local and must not be written as cross-repo tasks.
- When implementing work tracked anywhere under `../org-context/tasks/**/TASK-*.md`, use a dedicated git worktree for that task in this repository.
- Prefer worktree path `$HOME/worktrees/<repo>/<task-id>-<task-slug>`.
- Before editing, create or reuse a named branch in that worktree. Prefer `codex/<task-id>-<task-slug>`.
- If a task does not exist yet, create it first so the branch can use the task ID and slug.
- If an existing task file has no slug yet, derive a short kebab-case slug from its title and add it when you update the task.
- Do not leave task work on detached `HEAD`.

## Repo-Specific Working Rules

- Treat this repository as a client application boundary. Keep UI concerns, application state, domain contracts, and transport/integration code separated.
- Prefer relative `../org-context` references everywhere. Do not introduce absolute org-context paths.
- If you add a new page, route, API client module, or static asset, update the relevant repository docs in the same change so the documented map stays usable.
- If a change affects shared messaging, backend contracts, analytics, auth, or lead capture behavior, check the relevant repository entries in `../org-context/repos.md` before finalizing.

# Repository Context

After loading organization context, read repository documentation:

- docs/ai-context.md
- docs/repository-overview.md
- docs/architectural-layers.md
- docs/design-language.md
- docs/repo-map.md
- docs/dependency-graph.md
- docs/call-graph.md
- docs/entrypoints.md

Visual consistency rule:

- For new public-facing pages, use the home page in `index.html` and the canonical guidance in `docs/design-language.md` as the default design reference.
- Match the implemented palette, typography, spacing, surface treatment, and overall visual tone unless an existing route already establishes an intentional variant.

## Project File Requirement

- If you add a new page, component group, route definition, public asset, or environment-dependent integration, keep the app shell, router, and build configuration in sync in the same change.
