# AI Context

AI assistants working in this repository should read files in this order:

1. `../org-context/repos.md`
2. `docs/repository-overview.md`
3. `docs/architectural-layers.md`
4. `docs/repo-map.md`
5. `docs/dependency-graph.md`
6. `docs/call-graph.md`
7. `docs/entrypoints.md`

Repository-specific notes:

- This repository is the ContactPit company website repository.
- The repository is currently documentation-first and does not yet contain implementation files, so architecture docs describe the intended client structure and should be tightened as source code lands.
- Consult `../org-context` before making changes that affect shared branding, public messaging, or integrations with other ContactPit systems.
- Keep references to organization context relative. Do not use absolute `/Users/...` paths.

Cross-repo coordination:

- If a website change depends on backend contracts, analytics, lead capture, or shared product messaging, check the relevant repositories listed in `../org-context/repos.md`.
