# Repository Map

This repository is currently a documentation-first shell. The code paths below describe the intended map once the website implementation is added.

## App Bootstrap & Composition

- `src/main.*` or framework bootstrap entry
  Initializes the client application, mounts the root app shell, and installs providers for routing, session state, configuration, and telemetry.

- `src/app/**`
  Root layout, route shell, provider composition, and top-level navigation behavior.

## Navigation

- `src/router/**` or framework-native route tree
  Canonical route declarations, route guards, nested layouts, and transitions between public, authenticated, and admin/client-account sections.

## Infrastructure Services

- `src/services/api/**`
  Typed API clients for search, company/person detail, auth-related requests, lead capture, orders, and account actions.

- `src/services/auth/**`
  Session bootstrap, token lifecycle, login/logout helpers, and auth-state observation.

- `src/services/analytics/**`
  Page-view, conversion, search, and form-submission telemetry hooks.

- `src/services/storage/**`
  Browser-local persistence for session helpers, onboarding state, or cached client preferences.

## Domain Models

- `src/domain/**`
  Business entities and contract mapping for companies, people, searches, filters, orders, and account data.

- `src/lib/validation/**`
  Shared form and request validation logic.

## Feature Modules

- `src/features/home/**`
  Landing page and primary conversion surfaces.

- `src/features/search/**`
  Search UI, query handling, result lists, and route transitions to detail pages.

- `src/features/company/**`
  Company detail experience and related actions.

- `src/features/person/**`
  Person detail experience and related actions.

- `src/features/orders/**`
  Leadlist ordering, checkout, or request-submission flows if exposed on the website.

- `src/features/account/**`
  Authentication, profile, saved items, and account-management surfaces.

- `src/features/admin/**`
  Admin or operations UI if this repository later takes on protected management functionality.

## Styling & Assets

- `src/styles/**`
  Design tokens, global styles, and reusable layout primitives.

- `public/**`
  Static assets, icons, metadata images, and downloadable resources.

## Tests

- `src/**/*.test.*`
  Unit and component tests.

- `e2e/**`
  Browser end-to-end tests for key landing, auth, search, and conversion flows.

Update this file with concrete paths as soon as source files exist.
