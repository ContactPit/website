# Architectural Layers

## UI / Presentation Layer

- Responsibility: Render pages, sections, forms, navigation, and feedback states for browser users.
- Expected modules/files:
  - `src/pages/**` or framework-equivalent route files
  - `src/components/**` shared UI primitives and page sections
  - `public/**` static assets

## Application Layer (State + Routing Orchestration)

- Responsibility: Coordinate page state, navigation, loading states, and user-session-aware behavior without owning transport details.
- Expected modules/files:
  - `src/app/**` or `src/router/**`
  - `src/state/**`
  - `src/features/**` page-level models/controllers/hooks

## Domain Layer (Business Models & Validation)

- Responsibility: Represent business entities, request/response contracts, validation rules, and view-independent business logic.
- Expected modules/files:
  - `src/domain/**`
  - `src/types/**`
  - `src/lib/validation/**`

## Infrastructure Layer (API / Auth / Browser Integrations)

- Responsibility: Execute HTTP requests, auth/session handling, storage access, analytics emission, and third-party SDK integration.
- Expected modules/files:
  - `src/services/api/**`
  - `src/services/auth/**`
  - `src/services/analytics/**`
  - `src/services/storage/**`

## Configuration & Cross-Cutting Layer

- Responsibility: Environment configuration, feature flags, localization, logging, and shared constants.
- Expected modules/files:
  - `src/config/**`
  - `src/i18n/**`
  - `src/lib/logger/**`
  - `src/constants/**`

## External Integrations Layer

- Responsibility: Third-party and remote platform boundaries.
- Expected integrations:
  - ContactPit backend API(s)
  - Authentication provider(s)
  - Analytics / telemetry provider(s)
  - Deployment platform and form or CRM integrations if added

## Layering Rules

- UI should depend on application-layer state and domain models, not raw fetch logic.
- Domain logic should stay framework-agnostic where practical.
- Infrastructure modules should expose typed interfaces upward instead of leaking transport-specific details into pages or components.
- Cross-repo contract changes must be checked against `../org-context/repos.md`.
