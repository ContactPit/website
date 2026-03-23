# AI Context

AI assistants working in this repository should read files in this order:

1. `../org-context/repos.md`
2. `docs/repository-overview.md`
3. `docs/architectural-layers.md`
4. `docs/design-language.md`
5. `docs/repo-map.md`
6. `docs/dependency-graph.md`
7. `docs/call-graph.md`
8. `docs/entrypoints.md`

Repository-specific notes:

- This repository is the ContactPit company website repository.
- The repository contains a live static website implementation rooted in `index.html`, `styles.css`, `script.js`, and page-specific HTML entrypoints under top-level route folders.
- Treat `docs/design-language.md` as the canonical visual reference for new public-facing pages. Match the home page's palette, typography, spacing, glass surfaces, and gradient usage unless a route already establishes an intentional variant.
- Consult `../org-context` before making changes that affect shared branding, public messaging, or integrations with other ContactPit systems.
- Keep references to organization context relative. Do not use absolute `/Users/...` paths.

Cross-repo coordination:

- If a website change depends on backend contracts, analytics, lead capture, or shared product messaging, check the relevant repositories listed in `../org-context/repos.md`.
