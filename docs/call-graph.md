# Call Graph (Runtime Flows)

This file captures expected runtime flows for the website client. Replace these with concrete implementation traces as the codebase takes shape.

## 1) App Bootstrap & Initial Routing

browser request
→ HTML shell and client bundle load
→ root app bootstrap initializes config, routing, auth/session state, and analytics
→ root layout renders public landing page, authenticated area, or loading state

## 2) Marketing / Landing Conversion Flow

landing page render
→ user interacts with CTA
→ route transition or modal open
→ form state and validation run
→ submission API or CRM integration fires
→ success or error state renders

## 3) Authentication Flow

login or signup action
→ auth UI collects credentials or redirects to provider
→ auth service exchanges or stores session credentials
→ protected user state refreshes
→ route guard or app shell re-renders authenticated content

## 4) Search to Detail Flow

home-page hero search input
→ user types at least 2 characters
→ client debounces for 666 ms
→ same-origin `/api/search?q=...` proxy calls upstream search API
→ ranked company/person results render in dropdown
→ user selects company or person
→ browser routes to `/company/:slug` or `/person/:slug`
→ detail shell calls same-origin `/api/company?slug=...` or `/api/person?slug=...`
→ company or person page maps the payload into route-specific detail modules and renders the fetched entity

## 5) Lead Capture / Order Request Flow

user completes lead form or order request
→ client validation runs
→ API client submits payload
→ analytics conversion event records
→ success confirmation or follow-up step renders

## 6) Account Flow

authenticated route load
→ session check or user bootstrap runs
→ account API requests fetch profile, saved items, or order history
→ account views render and support updates or logout actions

## 7) Content / SEO Flow

route request
→ page metadata, canonical URLs, and social preview data are assembled
→ content sections render
→ analytics page-view or performance hooks emit

## Current State

- The repository already implements static runtime flows for the public routes `/`, `/filters/`, `/blog/`, and `/about/`.
- The repository already implements live search-to-detail routing for `/company/:slug` and `/person/:slug`, and both detail routes now render richer multi-section intelligence views alongside the public routes `/`, `/filters/`, `/blog/`, and `/about/`.
- The flows above still describe the broader intended client behavior as the site grows beyond the current static implementation.
