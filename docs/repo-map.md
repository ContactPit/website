# Repository Map

This repository now contains a static landing-page implementation plus the longer-term target structure for the full website client.

## App Bootstrap & Composition

- `index.html`
  Current home page document. Defines the web home surface with live trending, leaderboards, counties, filters entry, political parties, and publicly traded companies.

- `styles.css`
  Shared visual system for the current web pages, including the light-mode ContactPit palette translated into a web-first layout language.

- `script.js`
  Current home-page interaction layer. Loads live home data and powers the debounced unified search dropdown that routes to company and person detail placeholders.

- `api/home.js`
  Same-origin serverless aggregator for the iOS home endpoints: trending, leaderboards, catalog, and counties.

- `api/search.js`
  Same-origin serverless search proxy for the homepage unified search input.

- `api/company.js`
  Same-origin serverless company-detail proxy for slug-based company pages.

- `api/person.js`
  Same-origin serverless person-detail proxy for slug-based placeholder person pages.

- `filters/index.html`
  Dedicated filters page entrypoint for the live web leadlist workflow.

- `filters/filters.js`
  Client-side filters controller. Loads live filter config and legends, maintains browser selection state, and composes the same count payload shape used by the iOS app.

- `checkout/index.html`
  Dedicated checkout route for leadlist ordering. Receives the current filters selection from `/filters/`, mirrors the iOS order setup fields for guests, and hosts the Stripe-ready direct-payment UI.

- `checkout/checkout.js`
  Client-side checkout controller. Loads packages, builds guest order requests, initializes Stripe Elements, and confirms direct payments.

- `api/filters.js`
  Same-origin serverless proxy for the filters page. Aggregates filter configuration plus legends on `GET` and forwards company count checks on `POST`.

- `api/packages.js`
  Same-origin serverless proxy for package loading used by checkout and other leadlist-order surfaces.

- `api/checkout-config.js`
  Same-origin serverless config endpoint for runtime checkout settings such as the Stripe publishable key.

- `api/create-order-and-payment.js`
  Same-origin serverless proxy for direct-payment order creation and PaymentIntent bootstrap.

- `blog/index.html`
  Dedicated blog page entrypoint for editorial and product-writing rollout.

- `about/index.html`
  Dedicated about page entrypoint for company positioning, product framing, and brand context.

- `company/index.html`
  Static route shell for `/company/:slug`, rendering the web company intelligence view from the slug-based API fetch.

- `company/company.js`
  Client-side controller for the company intelligence route, including overview, financial pulse, people, and location modules. The location tab can lazy-load Apple MapKit JS when `VITE_APPLE_MAPS_TOKEN` is configured.

- `person/index.html`
  Static route shell for `/person/:slug`, rendering the web person intelligence view from the slug-based API fetch.

- `person/person.js`
  Client-side controller for the person intelligence route, including the tabbed overview, financial, and locations experience. The locations tab can lazy-load Apple MapKit JS for multi-marker maps when `VITE_APPLE_MAPS_TOKEN` is configured.

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
