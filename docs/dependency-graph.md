# Dependency Graph

## High-Level Flow

Pages / Components
↓
Feature state / controllers / hooks
↓
Domain models and validation
↓
API / auth / analytics / storage services
↓
External systems (ContactPit backend, auth provider, analytics provider, deployment platform integrations)

## Composition Root

The root web app is expected to depend on:

- router or framework route tree
- global app shell/layout
- session or auth provider
- configuration loader
- analytics bootstrap
- shared data-fetching layer if introduced

## Core Service Dependencies

`api client` is expected to depend on:

- environment configuration
- HTTP transport wrapper
- auth/session provider when protected endpoints are used

`auth service` is expected to depend on:

- browser storage or cookies
- external auth provider or backend session endpoints

`analytics service` is expected to depend on:

- runtime environment configuration
- page navigation events
- conversion or interaction hooks

`feature controllers` are expected to depend on:

- domain validation and contracts
- API clients
- route/navigation helpers
- auth/session state where relevant

## Dependency Direction Rules

- Components should not call raw backend endpoints inline when a shared service module is appropriate.
- Validation and domain mapping should be reusable across forms and routes.
- Analytics should be triggered from feature/application boundaries, not scattered through low-level UI primitives.
- Third-party SDK usage should be isolated behind service modules where practical.

## Current State

- No implementation files exist in this repository yet, so this graph is a target architecture baseline rather than a reflection of checked-in code.
