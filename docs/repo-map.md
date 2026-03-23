# Repository Map

This repository now contains a static landing-page implementation plus the longer-term target structure for the full website client.

## App Bootstrap & Composition

- `index.html`
  Current home page document. Defines the web home surface with live trending, leaderboards, counties, filters entry, political parties, and publicly traded companies.

- `styles.css`
  Shared visual system for the current web pages, including the light-mode ContactPit palette translated into a web-first layout language.

- `script.js`
  Current home-page interaction layer. Loads live home data and renders the requested sections from shared backend feeds.

- `api/home.js`
  Same-origin serverless aggregator for the iOS home endpoints: trending, leaderboards, catalog, and counties.

- `filters/index.html`
  Dedicated filters page entrypoint for the upcoming web leadlist workflow.

- `blog/index.html`
  Dedicated blog page entrypoint for editorial and product-writing rollout.

- `about/index.html`
  Dedicated about page entrypoint for company positioning, product framing, and brand context.

- `assets/ios/**`
  Static asset bundle copied from the iOS asset catalog for logos, county shapes, brand imagery, and optimized responsive page assets such as the about-page founder portrait variants.

- `builder/index.html`
  Transitional route that redirects the old `/builder` path to the new landing page.

- `src/main.*` or framework bootstrap entry
  Intended future application bootstrap when the repository grows beyond a static landing page.

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
