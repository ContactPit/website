# Design Language

This document captures the implemented visual system used by the current home page in [`index.html`](/Users/rasmustauts/website/index.html) and [`styles.css`](/Users/rasmustauts/website/styles.css). New public-facing pages should follow these decisions so the website keeps a coherent ContactPit look.

Any task that touches UI, styling, layout, visual presentation, or public-facing frontend behavior should use [$frontend-design](/Users/rasmustauts/.agents/skills/frontend-design/SKILL.md) alongside this document.

## Core Theme

- Default visual direction: bright, premium, data-product marketing surface.
- Overall mood: light canvas, iridescent purple brand energy, soft glass panels, and clean analytical content blocks.
- Design intent: make business-intelligence content feel approachable and polished rather than dense, dark, or enterprise-heavy.
- Use the home page style as the baseline for new pages. Do not switch to a dark theme or a neutral SaaS look unless the route already has an intentional exception.

## Typography

- Primary body font: `Manrope`, sans-serif.
- Display and headline font: `Space Grotesk`, sans-serif.
- Apply `Space Grotesk` to brand text, page hero headings, section headings, and other display-level labels.
- Apply `Manrope` to paragraph copy, navigation, chips, buttons, and data labels.
- Headline style:
  - Tight line-height near `1` or below.
  - Negative tracking around `-0.04em` to `-0.06em`.
  - Large clamp-based sizing instead of fixed desktop-only values.
- Body copy style:
  - Comfortable line-height around `1.65` to `1.7`.
  - Muted text color instead of pure black for supporting paragraphs.

## Color Tokens

Base tokens implemented in [`styles.css`](/Users/rasmustauts/website/styles.css):

- `--bg: #fcfbff`
- `--bg-soft: #f6f1ff`
- `--surface: rgba(255, 255, 255, 0.78)`
- `--surface-strong: #ffffff`
- `--surface-soft: #faf7ff`
- `--text: #171320`
- `--text-muted: #665d79`
- `--line: rgba(122, 28, 225, 0.12)`
- `--line-strong: rgba(122, 28, 225, 0.22)`
- `--brand: #7a1ce1`
- `--brand-dark: #6b0fa4`
- `--brand-bright: #b828cd`
- `--brand-soft: rgba(122, 28, 225, 0.08)`

Supporting accents:

- Warm highlight used in large gradient blocks: `rgba(255, 210, 69, ...)`
- Success tint for positive emphasis: `rgba(4, 119, 67, 0.08)`

Usage rules:

- Keep the base page light.
- Use purple gradients as the primary brand accent, not as a full-page flood color.
- Reserve high-saturation gradients for CTAs, large feature banners, and footer-like anchor sections.
- Use muted ink colors for secondary text and metadata.
- Keep borders subtle and slightly purple-tinted rather than neutral gray.

## Background System

- Global page background combines:
  - white-to-soft-lilac vertical gradient
  - soft radial purple/pink glows near corners
  - a faint fixed grid overlay masked toward the edges
- This background is part of the brand language. New pages should reuse the same page-level atmosphere instead of using flat white.
- Avoid noisy textures, heavy illustrations, or dark photo backgrounds on default content pages.

## Surfaces And Elevation

- Main cards and panels use near-white backgrounds with soft translucency.
- Default panel treatment:
  - large rounded corners
  - faint white border
  - soft purple-tinted shadow
  - occasional subtle internal gradient wash via `::before`
- Standard corner radii:
  - `--radius-xl: 32px`
  - `--radius-lg: 24px`
  - `--radius-md: 18px`
- The top navigation uses a pill-shaped glass treatment with optional backdrop blur.
- Prefer one strong elevation system across the site instead of mixing flat blocks and harsh shadows.

## Layout And Spacing

- Global content width is capped by `--container: 1200px`.
- The site shell uses narrow outer gutters and keeps content centered.
- Standard section rhythm: around `78px` vertical padding.
- Section headers are compact blocks with an eyebrow, a large heading, and a short supporting paragraph.
- Content should feel airy. Avoid cramped grids or dense dashboard spacing on marketing pages.

## Navigation And Shell

- Header behavior:
  - sticky near the top of the viewport
  - pill-shaped white/glass container
  - centered navigation
  - single high-emphasis CTA on the right
- Navigation should stay minimal and clean. Avoid adding excessive controls to the top bar.
- Footer behavior:
  - treat as a brand anchor section
  - dark purple-to-magenta gradient
  - white text with softened secondary copy
  - large rounded container, not a flat strip

## Buttons, Links, And Chips

- Primary actions use the purple gradient from `--brand-dark` to `--brand` to `--brand-bright`.
- Primary buttons and CTA links should be pill-shaped and visually luminous, with a stronger shadow than neutral surfaces.
- Secondary actions should be white or translucent with subtle purple borders.
- Small metadata chips should be rounded and use either:
  - soft purple fills for type/category markers
  - white fills with purple-tinted borders for counts or values

## Content Patterns To Reuse

### Hero

- Centered composition.
- Large headline with a short, direct promise.
- Supporting paragraph capped to a readable width.
- Search or primary interaction embedded in a large pill-like control.

### Section Headers

- Small uppercase eyebrow in brand purple.
- Large `Space Grotesk` heading.
- Optional muted explanatory paragraph underneath.

### Cards And Data Blocks

- Use rounded cards with soft gradients or white surfaces.
- Keep copy concise and structured.
- Let one data point, badge, or logo serve as the focal element.
- Avoid stuffing too many metrics into one card.

### Feature Banner

- Use a stronger, darker purple gradient only for standout conversion sections.
- Support it with abstract shapes, glow orbits, and translucent overlay panels instead of literal product screenshots.

### Marquee And Motion

- Motion is subtle and ambient.
- Existing patterns include:
  - slow auto-scrolling marquees
  - scroll reveal with upward fade
  - light hover lift on chips and controls
- Keep motion optional and respect `prefers-reduced-motion`.
- Avoid spring-heavy or playful microinteraction overload.

## Responsive Behavior

- Collapse multi-column areas to one column progressively around tablet and mobile breakpoints.
- On smaller screens:
  - header becomes stacked
  - full-width buttons are acceptable
  - card grids reduce from 4 or 3 columns to 2, then 1
- Preserve generous spacing and large-radius surfaces on mobile, with slightly reduced padding.

## Imagery And Illustration

- Prefer:
  - abstract gradients
  - product/data motifs
  - clean logos
  - isolated brand imagery
- Avoid generic stock-photo styling on standard sections.
- If imagery is needed, frame it inside the same rounded, elevated system used elsewhere.

## Voice Of The UI

- Headlines should be direct, confident, and short.
- Supporting copy should describe research, targeting, filters, rankings, and company intelligence in plain language.
- Avoid buzzword-heavy enterprise phrasing and avoid playful consumer-app copy.

## Do And Do Not

- Do keep new pages light, polished, and slightly iridescent.
- Do reuse the existing purple token family and typography pair.
- Do use rounded glass-like cards and restrained gradients.
- Do keep page sections editorial and scannable, not dashboard-dense.
- Do make one element per section visually dominant.
- Do not introduce unrelated accent colors as new primaries.
- Do not default to plain gray borders, square cards, or flat white backgrounds.
- Do not switch headline fonts or fall back to generic system-font aesthetics.
- Do not use dark mode styling unless the route already requires its own sub-theme.

## Filters Route

- The filters experience in [`filters/index.html`](/Users/rasmustauts/website/filters/index.html) should use the same core palette, typography, surface treatment, and spacing system as the home page.
- Tool-like interactions on that route can become denser and more utility-focused, but they should still read as ContactPit through the shared purple token family, glass cards, and light atmospheric background.
- Do not introduce a separate accent system for filters unless a future product requirement clearly justifies a documented route-level variant.
