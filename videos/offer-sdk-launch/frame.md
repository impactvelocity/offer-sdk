---
version: beta
name: Offer SDK — Neon (frame layer)
description: >
  Frame spec for the Offer SDK walkthrough, built from the product's current design system
  (offer-app dark theme + the site/ landing page, Oct 2026 neon refresh). Near-black canvas, ONE
  neon-green accent (#34d599) with a green→cyan brand gradient as the pop of color, outlined neon
  buttons with a soft glow, mono-caps eyebrows and outlined mono section numbers, two-tone
  headlines (bright lead + muted continuation), Cal Sans for type, Geist Mono for code. Half the
  video is the real dashboard UI rebuilt with the shared app kit (assets/app-kit/).
unit: the frame — 1920×1080
principle: the product is the hero · show the real UI · one neon accent · fewer words, more motion

colors:
  canvas: "#0f0f11"
  panel: "#161618"
  surface: "#18181b"
  surface-raised: "#202024"
  surface-muted: "#222226"
  border: "#2a2a2f"
  border-strong: "#37373d"
  text: "#ececee"
  text-muted: "rgba(236, 236, 238, 0.68)"
  text-faint: "#6f7178"
  icon: "#9c9ea5"
  accent: "#34d599"
  accent-hover: "#5ce0b0"
  accent-fg: "#5fe3b1"
  accent-subtle: "rgba(52, 213, 153, 0.13)"
  accent-contrast: "#03140c"
  brand-from: "#34d599"
  brand-to: "#2cc0de"
  success-fg: "#5ed29a"
  danger: "#e5484d"
  danger-fg: "#ff8a8d"
  warning: "#f0a020"
  warning-fg: "#ffc35f"
  code-keyword: "#5fe3b1"
  code-string: "#6fd69f"
  code-key: "#93b8ff"
  code-number: "#ffa072"
  code-comment: "#7f828a"
  paypal-yellow: "#ffc439"
  zapier: "#ff5f1f"

gradients:
  brand: "linear-gradient(90deg, #34d599, #2cc0de)"
  brand-vertical: "linear-gradient(180deg, #4fe0b0, #2fc48c)"
  glow: "radial-gradient(closest-side, rgba(52,213,153,0.20), transparent)"

effects:
  neon-border: "inset 0 0 0 1px rgba(52,213,153,0.85), inset 0 0 14px -6px rgba(52,213,153,0.35), 0 0 16px -6px rgba(52,213,153,0.4)"
  neon-wash: "rgba(52,213,153,0.08)"

radii:
  window: "18px"
  card: "14px"
  panel: "12px"
  control: "8px"
  tag: "5px"
  pill: "999px"

typography:
  # Cal Sans is variable: weight 400–700 + a "GEOM" axis. Display uses GEOM 50, UI uses GEOM 25.
  display-xl: { fontFamily: "Cal Sans", px: 112, weight: 500, lineHeight: 1.0, tracking: "-0.025em", geom: 50, color: "text" }
  display:    { fontFamily: "Cal Sans", px: 84, weight: 500, lineHeight: 1.04, tracking: "-0.02em", geom: 50, color: "text" }
  h1:         { fontFamily: "Cal Sans", px: 64, weight: 500, lineHeight: 1.08, tracking: "-0.02em", geom: 50, color: "text" }
  h2:         { fontFamily: "Cal Sans", px: 48, weight: 500, lineHeight: 1.12, tracking: "-0.015em", geom: 50, color: "text" }
  h3:         { fontFamily: "Cal Sans", px: 34, weight: 500, lineHeight: 1.2, tracking: "-0.01em", geom: 50, color: "text" }
  body:       { fontFamily: "Cal Sans", px: 26, weight: 400, lineHeight: 1.45, geom: 25, color: "text-muted" }
  label:      { fontFamily: "Cal Sans", px: 20, weight: 500, geom: 25, color: "text" }
  code:       { fontFamily: "Geist Mono", px: 22, weight: 400, lineHeight: 1.6, color: "text" }
  ui:         { fontFamily: "Cal Sans", px: 14, weight: 400, geom: 25, note: "inside the app window only, at logical size; the window is scaled up" }

components:
  app-window:
    source: "assets/app-kit/shell.html + assets/app-kit/app-kit.css"
    description: "The real offer-app dashboard (rail · nav panel · page card). Logical 1366×800, scaled ~1.08–1.12 to fill the frame, punched in to 1.5–1.9× on the region being discussed."
  neon-button:
    source: "app-kit .ak-btn.is-primary / .is-gradient (bigger glow)"
    description: "THE primary button everywhere (app + site): hairline neon-green border with soft outer glow, faint green wash fill, green ink text. No solid violet, no white-on-gradient buttons."
  solid-brand-tile:
    source: "app-kit .ak-btn.is-solid / .ak-app-tile"
    description: "Brand-vertical green fill with dark ink (#03140c) — app tiles, avatars, a confirming 'done' chip."
  code-panel:
    source: "app-kit .ak-code"
    description: "#131315 panel, 1px border, 14px radius, title bar with three dots + filename, Geist Mono, syntax colors (keywords neon green)."
  two-tone-headline:
    description: "Site section opener (after neon.com): ONE left-aligned statement, bright title sentence in {colors.text} + dimmed lead continuing it in {colors.text-muted}, same size, weight 500. No section numbers, no eyebrow above it."
  tag:
    description: "app-kit .ak-tag — 5px radius, tinted fill + light text; .brand is the green tag (Featured, Live)."
  glow:
    description: "One soft {gradients.glow} bloom behind the hero element. Never more than one per frame."
  backdrop:
    source: "assets/hero-bg-neon.webp (hero), assets/section-bg-neon.webp (section), assets/footer-bg-neon.webp (closing)"
    description: "The site's neon line-art illustrations (green wave lines, coins, charts, glowing nodes). Full-bleed at ~45–70% opacity behind type-led frames, dimmed under text with a canvas radial fade. Never behind the app-window frames (those use the flat canvas + one green glow)."
---

# Offer SDK — Neon

## Overview

The look of the Offer SDK product as it ships now: the dark dashboard and the landing page after
the neon refresh. The video should feel like the app and site are presenting themselves.
**Real UI is the hero.** Type-led frames borrow the landing page (big Cal Sans statement,
two-tone, neon line-art backdrop, outlined neon CTA). Product frames ARE the dashboard, rebuilt
with the shared app kit so they match the real screens in `capture/assets/app-v2/*.png`.

## The frame

- 1920×1080. Keep every element above y ≈ 900 (bottom band stays clear for captions).
- Ground is always `{colors.canvas}` (#0f0f11). Depth from layered surfaces (canvas → panel →
  surface → raised) with 1px borders and app-kit shadows.
- **One neon accent.** Green `{colors.accent}` / `{colors.accent-fg}` carries every emphasis:
  active nav, primary buttons (outlined + glow), focus rings, highlights, keywords in code. The
  green→cyan brand gradient is the spice: chart/meter fills, a progress line, a glow. **Never
  gradient text** on headline words. **No violet or pink anywhere** (the old purple
  theme is retired). Semantic red / amber only for state (402, limit reached, failed deploy).
- Neon is light, not paint: prefer hairline neon borders + glow over big solid green fills.

## Typography

- Cal Sans (weight 500 for display, GEOM 50) for statements; Cal Sans GEOM 25 for UI.
  Geist Mono for code and ids only. Fonts: `assets/fonts/CalSansVF.woff2`
  and `assets/fonts/geist-mono-latin.woff2`.
- Statements are two-tone (bright + muted) rather than multi-line explanations.
- On-screen copy outside the app UI is **minimal**: a label, a number, a 2–4 word chip. Never the
  narration sentence; never a paragraph. If the voice says it and the picture shows it, delete
  the caption.

## Motion (tighter + more fun)

- Snappy arrivals: `expo.out` / `power4.out` at 0.35–0.6s for UI pieces; `power3.out` for camera.
  Staggers 40–70ms. Overlap tweens so beats chain without dead air.
- Fun = physical and responsive, not bouncy: cursor clicks with ripple + a quick press (scale
  0.96 → 1), numbers that count, meters that fill, chips that pop in with a short scale
  (0.85 → 1) and a neon glow flash, lines that draw, a punch-in that lands exactly on the word.
- Every reveal lands on its spoken word (cue sheets give word times). Hold the final state
  briefly; no dead time at the start of a frame — the first element is moving by ~0.1s.
- Still banned: bounce/elastic overshoot as a default, infinite loops, random, CSS transitions.

## No "AI tells" (the user's rule for the site — applies to every non-app frame)

- No eyebrow / kicker labels (mono-caps or pill) above headings or panels.
- No icon tiles or check-icon bullets in feature lists/cards — icons only on real controls.
- No gradient text on headline words. No centered headline + lead stacks: statements are
  left-aligned, two-tone (bright + dimmed), like neon.com and the site's `SectionHeading`.
- No section numbers ("01"). Pill-shaped buttons are fine.
- App UI rebuilt from the real dashboard keeps its own app styling (it is the product).

## App kit (every UI-demo frame — READ THIS)

The dashboard is rebuilt in HTML so it can animate. Use it; do not redraw the app from scratch.

- `assets/app-kit/app-kit.css` — paste the whole file into your frame's style block (tokens,
  @font-face rules, every component class, all prefixed `ak-`). It is already neon.
- `assets/app-kit/shell.html` — the complete window (icon rail · "AmazingApp AI" nav panel with
  real nav items and counts · page card with header). Copy it, set `.is-active` on your page's
  nav item, replace the header + body with your page.
- `assets/app-kit/icons.html` — the Lucide icons the app uses, as inline SVG.
- Reference screenshots of the current neon app (match layout, copy and data):
  `capture/assets/app-v2/01-overview.png`, `02-analytics.png`, `03-agent.png`, `04-offers.png`,
  `05-cancel-flow.png`, `06-plans.png`, `07-entitlements.png`, `08-addons.png`,
  `09-incentives.png`, `10-accounts.png`, `11-integration.png`, `13-mcp.png`, `14-keys.png`,
  `15-webhooks.png`, `16-settings.png`, `17-cancel-flow-edit.png`, `18-offer-new.png`;
  landing page: `capture/assets/app-v2/site-home-hero.png`, `site-home-full.png`, `site-demo-full.png`.
  (Screenshots say "Notebook AI" — the video's demo product is **"AmazingApp AI"**, tiles "AA".)
- Window at logical 1366×800, scaled ~1.1 at rest (center x=960 y=470), punch in
  (`coordinate-target-zoom`) to 1.5–1.9× on what the voice names.
- Real demo data: plans Free, Starter $12/mo, Pro $29/mo (Featured), Enterprise, Lifetime deal
  $199 once; entitlements Projects, AI credits, Team seats, Storage (GB) [Usage] · PDF export,
  API access, Custom domain, Priority support, SSO / SAML [Feature flag]; add-ons AI boost, Extra
  storage pack, White-label; incentives Beta tester, AppSumo partner, Black Friday 2026, Win-back
  offer; 64 accounts.

## Don't

- No violet/purple/pink accents, no white-text-on-gradient buttons, no rainbow gradients, no bokeh.
- No invented metrics, testimonials or logos. Partner marks (PayPal, Render, Zapier, Slack,
  Claude) are text wordmarks in their own color.
- No light backgrounds. No explanatory paragraphs on screen.

## Font loading

```html
<style>
@font-face{font-family:"Cal Sans";src:url("assets/fonts/CalSansVF.woff2") format("woff2");font-weight:400 700;font-display:block;}
@font-face{font-family:"Geist Mono";src:url("assets/fonts/geist-mono-latin.woff2") format("woff2");font-weight:400 600;font-display:block;}
</style>
```
(app-kit.css already includes both.)
