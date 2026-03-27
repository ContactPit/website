# Entry Points

## Application Startup

- `vite.config.mjs`
  Local development entrypoint. Serves the multi-page site and exposes local `/api/home`, `/api/filters`, `/api/search`, `/api/company`, and `/api/person` routes that proxy upstream backend data for browser testing.

- `src/main.*` or framework bootstrap entry
  Primary runtime entrypoint. Mounts the app, installs providers, and starts client-side services.

- `src/app/**` or framework root layout
  Top-level page shell entrypoint for navigation, shared providers, metadata, and route-aware layout behavior.

## Navigation and Route Entry Points

- route definitions under `src/router/**`, `src/pages/**`, or framework-native route folders
  Public entrypoints for landing pages, search, detail pages, auth pages, account pages, and any admin surfaces.

- `/checkout/`
  Public route entrypoint for guest leadlist order setup and direct-payment checkout.

- route guards or auth-aware loaders
  Entry points for redirecting unauthenticated users and bootstrapping protected views.

## User-Initiated Runtime Flows

- search submit handlers
  Entry point for search execution and result navigation.

- CTA and form submit handlers
  Entry points for lead capture, contact requests, checkout, and newsletter or demo flows if added.

- account actions
  Entry points for login, logout, profile updates, saved items, and order-history retrieval.

## Background / Browser Lifecycle Handlers

- analytics bootstrap
  Entry point for page-view and conversion tracking.

- session restore logic
  Entry point for restoring auth or onboarding state from cookies, local storage, or server-provided session data.

## Test Entry Points

- unit/component test runners
  Entry points for isolated UI and domain testing.

- `e2e/**`
  Entry points for browser automation covering critical website journeys.

## Current State

- Static page entrypoints currently include `/`, `/filters/`, `/blog/`, `/about/`, `/company/:slug`, and `/person/:slug`.
- Static page entrypoints currently include `/`, `/filters/`, `/checkout/`, `/blog/`, `/about/`, `/company/:slug`, and `/person/:slug`.
