# Repository Overview

- ContactPit website is the web client for the same business domain served by the ContactPit mobile and backend repositories.
- The repository currently ships a static multi-page website built from top-level HTML, CSS, and JavaScript entrypoints, with serverless helpers under `api/`.
- Local development should run through Vite so browser pages and local `/api/*` helper routes work together during development.
- The website should act as a client-facing product surface for discovery, lead generation, account flows, and marketing or conversion journeys.
- Shared business concepts are expected to align with the existing ContactPit ecosystem: companies, people, search, leadlists, orders, authentication, and account management.
- Cross-repo integration is likely to include ContactPit backend APIs, analytics or telemetry, authentication providers, and shared public messaging.
- The current visual baseline is the home page design system documented in `docs/design-language.md`. New public-facing pages should stay aligned with that implementation unless an existing route already establishes an intentional variant.
- As the implementation grows, update this overview to distinguish current static behavior from future framework or build-system changes.
