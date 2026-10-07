---
format: 1920x1080
duration: 140s
message: "Pricing changes shouldn't need a pull request"
arc: Hook → Problem (every yes is a deploy) → Turn (plans, access, promotions out of your code) → Tagline → Own it → App tour → Agent → Integrations → CTA
audience: Solo founders and small SaaS teams who hardcoded plans at launch and now drown in custom deals
mode: autonomous
music: warm minimal tech underscore, low synth pads, unobtrusive, minor-to-major lift at the turn
captions: skipped (voiceover recorded: assets/audio/voiceover.mp3; srt available)
vo_mode: verbatim
---

# Offer SDK — walkthrough storyboard

## Video direction

**Palette system (from frame.md).** Ground `canvas #0f0f11` everywhere. Surfaces layer canvas → panel → surface → raised with 1px `border`. One accent: violet `accent / accent-fg`. The brand gradient (violet→pink) only on: primary CTAs, meters/chart fills, and at most ONE accent word per headline. Semantic green/red/amber only for state (Live, 402, failed). Problem frames (01–03) may tint toward `danger-fg` on the code; everything after the turn (04+) is violet-led and calm.

**Two frame families.**
- *Type/code frames* (01–07, 20): landing-page language — big Cal Sans display, code panels in the site's CodeBlock style (`.ak-code`), feature cards, the contour backdrop `assets/brand/hero-bg-muted.webp` at low opacity.
- *App frames* (08–19): the REAL dashboard rebuilt with the app kit (`assets/app-kit/shell.html` + `app-kit.css`, see frame.md § App kit). The window sits centered on the flat canvas with one soft violet glow behind it. It is one continuous app: same window position at rest (centered, ~1.1 scale, top ≈ 60px), same cursor, the nav's active item changes page to page. Each app frame establishes the window briefly, then **punches in** (`coordinate-target-zoom`) on the rows/panels the VO names — this is what makes the UI readable and makes it feel like a guided demo rather than a slideshow.

**Motion grammar.** Smooth long-tail settles (`power3` default, `expo.out` for quick UI arrivals). Every element reveals on its voiceover cue; nothing is dumped at t=0. A real-feeling cursor (`.ak-cursor`) moves on gentle curves, clicks with `cursor-click-ripple`, buttons depress with `press-release-spring` (no overshoot). Typing uses `discrete-text-sequence` with a caret. Numbers count with `counting-dynamic-scale` / meters fill with `stat-bars-and-fills`. Camera on app frames = `coordinate-target-zoom` punch-ins and gentle pull-backs; on type frames = a slow single push (`multi-phase-camera`) that finishes before the back half. During holds: stillness; at most `sine-wave-loop` low-amplitude jitter on one element.

**Rhythm / held frames.** Held breathers: **06-tagline** (the thesis, still), **20-cta** (end card held). Busy beats: 02, 03 (pile-up accelerates), 16 (agent theater). Everything else: VO-paced reveals that land and hold.

**Timing note.** There is no recorded voiceover yet. Every frame is timed to the verbatim script at ~150 wpm with a breath; Scene windows follow that estimate. When the real VO arrives, frames get retimed — so keep each reveal tied to its phrase, not to a beat grid.

**Negative list.** No light backgrounds. No bouncy/elastic easing. No infinite loops, no `Math.random`. No lazy breathing, no drifting back-half pans. No floating bokeh / purple-blue AI blobs. No invented metrics, testimonials or partner logos — partner names (Render, PayPal, Zapier, Slack, Claude) appear as simple text wordmarks / pills only. No narration sentences as on-screen text. Nothing below y ≈ 900. Both failure modes are banned: slideshow (front-load then freeze) and screensaver (many things floating independently).

---

## Frame 1 — You launched your app

- scene: A clean launch: a small "AmazingApp AI" pricing page assembles — three tidy plan cards — while a tiny, neat billing.ts sits beside it
- voiceover: "You launched your app. It started simple, with just three plans."
- duration: 3.34s
- transition_in: crossfade
- status: animated
- src: compositions/frames/01-launch.html
- type: hook
- persuasion: Pain validation (start from the viewer's own happy launch day)
- beat: excitement → calm
- blueprint: compose
- asset_candidates: assets/hero-bg-muted.webp — site hero contour line-art backdrop
- focal: three plan cards
- roles: hero-bg-muted = background (dim ~30%) · plan cards = foreground built from app-kit card styles · billing.ts = supporting (.ak-code)
- sfx: none

narrativeRole: the "before" — everything is simple and clean on launch day.
keyMessage: you shipped, and pricing was three plans.

Compose: a single statement building onto a payoff object (three plan cards).
Scene 1 (0.0–1.6s): canvas + contour backdrop at low opacity. On "You launched your app" a small rounded "Launched 🚀"-style status pill is NOT used — instead a browser-less product card labelled "AmazingApp AI" (Cal Sans h3, with the layers-2 mark) rises into center with a long-tail settle; a green `ak-dot` + "Live" tag pops beside the name on the word "launched" (`spring-pop-entrance`, smooth). Centered, ~35% of frame.
Scene 2 (1.6–4.2s): on "It started simple, with just three plans" the name card slides up to the top third and three plan cards cluster→expand outward into a row beneath it (`center-outward-expansion`): Starter $12/mo · Pro $29/mo (purple "Featured" tag, brand-gradient top border) · Enterprise "Talk to us". Each card shows 2 short entitlement lines with green checks (Starter: Projects 20, AI credits 500; Pro: Projects Unlimited, AI credits 2,500; Enterprise: SSO / SAML, Priority support). Triptych, ~60% of frame width. Simultaneously a compact `.ak-code` panel "billing.ts" fades in lower-right showing 3 neat lines: `const plans = ["starter", "pro", "enterprise"]` — small, supporting, clearly tidy.
Scene 3 (4.2–5.4s): hold the clean state — still. A single soft glow under the Pro card (`ambient-glow-bloom`). Nothing else moves.

## Frame 2 — Every yes is another deploy

- scene: Customer requests arrive as message cards; each one spawns an if-statement typing into billing.ts and a "Deploying…" toast; the file gets messier with every yes
- voiceover: "Then one customer asked for a longer trial. Another wanted more seats. An influencer wanted a deal for her audience, live by Friday. Every yes meant more spaghetti code and another deploy."
- duration: 10.1s
- transition_in: crossfade
- status: animated
- src: compositions/frames/02-requests.html
- type: pain_point
- persuasion: Pain agitation (stack familiar, reasonable requests until they hurt)
- beat: tension → frustration
- blueprint: overwhelm-surround (Adapt)
- asset_candidates: assets/app-site-story-full.png — the site's /story page (billing.ts stage reference for look)
- focal: billing.ts code panel
- roles: app-site-story-full = supporting reference only (do not show the screenshot; match its billing.ts stage look) · billing.ts = cutout hero · request cards + toasts = supporting
- sfx: none

narrativeRole: show how reasonable requests turn into code debt.
keyMessage: every yes = an if-statement + a deploy.

Adapt: keep overwhelm-surround's accumulation (surfaces assemble around the subject and close in), but the subject is the billing.ts file and the surrounding surfaces are customer requests + deploy toasts. No avatar morph.
Scene 1 (0.0–3.2s): billing.ts (`.ak-code`, ~46% width, center-left, starting with the 3 tidy lines from Frame 1) holds. On "one customer asked for a longer trial" a message card slides in top-right: avatar "S" + "Sally" + "Could I get a 30-day trial?" (short). Instantly a new block types into billing.ts (`discrete-text-sequence` with caret): `if (user.email === "sally@…") trialDays = 30;` and a toast "Deploying… " with a spinner appears bottom-right then flips to a green check "Deployed".
Scene 2 (3.2–5.4s): on "Another wanted more seats" a second card ("Bill · Acme" — "We need 50 seats + SSO") slides in from the left edge; billing.ts grows: `if (user.org === "acme") { seats = 50; sso = true; } // ask Dave` — new toast "Deploying…" stacks above the first.
Scene 3 (5.4–8.6s): on "An influencer wanted a deal for her audience, live by Friday" a third card ("@sarahbuilds" — "Deal for my audience? Video goes live Friday") arrives with an amber "Fri" deadline tag; billing.ts types `if (ref === "sarah" && Date.now() < FRIDAY) price = 19;`. The file panel now scrolls slightly as lines exceed its height.
Scene 4 (8.6–12.4s): on "Every yes meant more spaghetti code and another deploy" the pace quickens: two more lines append fast (`// TODO: affiliate bundles???`, `if (plan === "pro" || user.id === "u_8812") enableExports();`), the newest toast turns amber "Deploy queued (3)", and the three request cards close in a little toward the code (surrounded). The new lines tint `danger-fg` faintly. Hold the crowded state on the last word — no exit.

## Frame 3 — The pile of special cases

- scene: Pull back to reveal billing.ts is huge — special cases everywhere; question marks hang over which deal is whose and which features make money
- voiceover: "A few months in, your billing code is a pile of special cases. Nobody remembers which customer got which deal, and nobody can tell which features make money. Every yes was an expensive guess."
- duration: 9.58s
- transition_in: crossfade
- status: animated
- src: compositions/frames/03-pileup.html
- type: pain_point
- persuasion: Negative contrast + cost of inaction
- beat: overwhelm → anxiety
- blueprint: compose
- asset_candidates: assets/hero-bg-muted.webp — contour backdrop
- focal: the giant billing.ts wall
- roles: hero-bg-muted = background (dim ~20%) · billing.ts wall = hero · annotations = supporting
- sfx: none

narrativeRole: the cost of saying yes the old way — confusion and blind spots.
keyMessage: special cases you can't track, and no idea what earns.
Scene 1 (0.0–4.0s): open close on the last lines of billing.ts from Frame 2, then ONE decelerating zoom-out (`multi-phase-camera`) reveals the file is enormous: three tall columns of code (`.ak-code` style, Geist Mono, small) filled with `if (user.id === …)`, `// custom deal`, `// ask Dave`, `// temporary` lines. A header chip "billing.ts · 1,184 lines" is NOT used (no invented numbers) — instead a "Month 4" pill (eyebrow style) sits top-left. Layered depth: code wall midground, darker vignette edges.
Scene 2 (4.0–9.0s): on "Nobody remembers which customer got which deal" three special-case lines highlight in turn (`css-marker-patterns` highlight sweep, violet at low alpha) and a small floating label pops beside each with a "?" chip: "Acme — why SSO?", "u_8812 — exports?", "sarah — still live?". 
Scene 3 (9.0–11.6s): on "nobody can tell which features make money" a small analytics-style card slides over the right side: "Revenue by feature" with four bars whose values are just "?" (bars drawn as dashed outlines, `svg-path-draw`), labels PDF export · Team seats · AI credits · SSO.
Scene 4 (11.6–14.2s): on "Every yes was an expensive guess" the whole wall dims slightly and one phrase-length label lands center in display type: "expensive guess" is NOT shown (it is narration) — instead a large red "$ ?" glyph mark sits in a soft danger glow over the code for the hold. Still.

## Frame 4 — Take it out of your code

- scene: The spaghetti lifts out of billing.ts into three labelled blocks — Plans, Access, Promotions — that slot into Offer SDK; the code collapses to one check and one API answer
- voiceover: "Offer SDK takes plans, access and promotions out of your code. Your app only asks one thing: what can this user do?"
- duration: 6.34s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/04-turn.html
- type: product_intro
- persuasion: Show-don't-tell proof (the code literally shrinks)
- beat: relief + clarity
- blueprint: compose
- asset_candidates: assets/hero-bg-muted.webp — contour backdrop; assets/logo-mark.svg — Offer SDK mark
- focal: the Offer SDK mark + the three blocks
- roles: hero-bg-muted = background (dim ~30%) · logo-mark = hero mark · code panel + API response = supporting
- sfx: none

narrativeRole: the turn — the new approach in one picture.
keyMessage: plans, access and promotions become data; your app asks one question.
Scene 1 (0.0–1.6s): the Offer SDK lockup (logo-mark + "Offer SDK" wordmark, Cal Sans 600, display size) blooms in at center on "Offer SDK" with one violet glow (`ambient-glow-bloom`), then shrinks to the upper-left third as a hub.
Scene 2 (1.6–4.6s): on "takes plans, access and promotions out of your code" a messy `.ak-code` billing.ts sits right; three groups of its lines highlight and LIFT out (each group becomes a rounded block — icon tile + label): Plans (layers icon) · Access (key-round) · Promotions (badge-percent). Each flies into the hub on a smooth curve one after another on its spoken word (`scale-swap-transition` from line-group to block), stacking under the Offer SDK mark as a tidy column. billing.ts collapses as lines leave (`card-morph-anchor` shrinking the panel).
Scene 3 (4.6–9.6s): on "Your app only asks one thing" the collapsed code panel now reads only `const can = useEntitlement("pdf_export")` (site SDK copy). On "what can this user do?" a request row types in under it — GET pill (green) + `/namespaces/acct_42/full-plan` + "200" — and a compact JSON answer cascades in line by line (`dynamic-content-sequencing`): `"plan": "pro"`, `"exports": true`, `"ai_credits": { "limit": 5000, "used": 4120 }`. Hold.

## Frame 5 — Say yes without code

- scene: Three use-case cards land: a Black Friday price that ends Sunday, a bundle for @sarahbuilds, and an A/B price test — each with a "No deploy" check
- voiceover: "So you can run a Black Friday deal, give that influencer a bundle for her audience, or test a new price, all without any code."
- duration: 6.06s
- transition_in: crossfade
- status: animated
- src: compositions/frames/05-say-yes.html
- type: benefit_highlight
- persuasion: Rule of three + friction reduction
- beat: ease → excitement
- blueprint: grid-card-assemble (Adapt)
- asset_candidates: assets/hero-bg-muted.webp — contour backdrop
- focal: the three use-case cards
- roles: hero-bg-muted = background (dim ~25%) · cards = hero
- sfx: none

narrativeRole: make the payoff concrete with the exact deals from the problem.
keyMessage: the same requests are now a few clicks.

Adapt: keep the staggered self-assembling cards, but each card lands on its own VO phrase instead of one cascade.
Scene 1 (0.0–3.2s): on "run a Black Friday deal" card 1 (site use-case card style: orange icon tile megaphone, title "Black Friday 2026", detail chip with clock icon "Ends Sunday at midnight") rises into the left slot. Triptych layout, cards ~30% width each, top ≈ 25%.
Scene 2 (3.2–6.4s): on "give that influencer a bundle for her audience" card 2 (blue tile handshake, "Bundle for @sarahbuilds", detail chip "offer.to/sarah · auto-credited") lands center.
Scene 3 (6.4–8.8s): on "or test a new price" card 3 (teal tile flask-conical, "Pricing test", two mini chips "A · Pro $29" / "B · Pro + credits $35") lands right.
Scene 4 (8.8–10.8s): on "all without any code" a green check pill "No code · No deploy" stamps onto each card in a quick left→right stagger (`press-release-spring`, no overshoot), and the faint billing.ts outline that was behind the row (very low opacity) fades away. Hold.

## Frame 6 — The thesis

- scene: The landing-page hero line, full frame: "Pricing changes shouldn't need a pull request" with "a pull request" in the brand gradient
- voiceover: "Pricing changes shouldn't need a pull request."
- duration: 2.09s
- transition_in: blur-crossfade
- status: animated
- src: compositions/frames/06-tagline.html
- type: benefit_highlight
- persuasion: Belief statement (the one line nobody else can say)
- beat: clarity + confidence
- blueprint: titlecard-reveal (Reproduce)
- asset_candidates: assets/hero-bg-muted.webp — site hero contour backdrop
- focal: the headline
- roles: hero-bg-muted = background (dim ~40%, matches the site hero)
- sfx: none

narrativeRole: the line viewers should repeat — a held breather.
keyMessage: pricing changes shouldn't need a pull request.
Scene 1 (0.0–1.4s): the site hero recreated: contour backdrop with radial canvas fade; a small eyebrow pill "New · PayPal checkout for any offer" (site copy) fades up first; then the two-line display-xl headline "Pricing changes shouldn't need" / "a pull request" slides up with a single restrained crossfade (`titlecard-reveal` signature: ONE move). This is the site's own headline, so it IS allowed on screen.
Scene 2 (1.4–3.0s): the gradient fill on "a pull request" sweeps in left→right (`gradient-text-sweep`).
Scene 3 (3.0–4.4s): held still. Nothing else.

## Frame 7 — Yours, on Render, with PayPal

- scene: An architecture diagram assembles inside a box labelled "Your Render account" — API, Postgres, Admin app — then a PayPal lifecycle rail lights up: checkout, renewals, upgrades, pauses, cancellations
- voiceover: "Offer SDK is self-hosted, so the API and the data are yours, running on your own Render account. PayPal handles checkout and the whole subscription lifecycle: renewals, upgrades, pauses and cancellations."
- duration: 10.35s
- transition_in: crossfade
- status: animated
- src: compositions/frames/07-own-it.html
- type: benefit_highlight
- persuasion: Risk reversal (you own the stack and the data)
- beat: control + trust
- blueprint: constellation-hub (Adapt)
- asset_candidates: assets/hero-bg-muted.webp — contour backdrop
- focal: the "Your Render account" boundary with three services
- roles: hero-bg-muted = background (dim ~15%) · services + rail = hero
- sfx: none

narrativeRole: ownership + the payments story in one diagram.
keyMessage: your API, your data, your Render; PayPal runs checkout and the lifecycle.

Adapt: keep constellation-hub's nodes-springing-around-a-center and the connector lines, but the center is a dashed boundary box and the nodes are services; resolve on a lifecycle rail instead of an orbit.
Scene 1 (0.0–2.6s): on "self-hosted" a dashed rounded boundary draws itself (`svg-path-draw`) center-left (~55% width) with a label tab "Your Render account" (text pill, Render wordmark as plain text, no logo).
Scene 2 (2.6–6.4s): on "the API and the data are yours" three service nodes spring into the box in sequence with server/database/layers-2 icons: "offersdk-api" (green Live dot), "Postgres" (green Live dot), "offer-app · admin" (green Live dot); connector lines draw between them (`avatar-cloud-network` connectors). Outside the box on the left, a small "Your app" node connects by a line into offersdk-api.
Scene 3 (6.4–9.0s): on "PayPal handles checkout" a node "PayPal" (blue #0070e0 text wordmark in a rounded tile) slides in on the right and a connector draws from offersdk-api to it; a PayPal-yellow "Checkout" pill pulses once (`press-release-spring`).
Scene 4 (9.0–13.2s): on "the whole subscription lifecycle" a horizontal rail draws under the diagram, and its five stations light up one per spoken word: Checkout · Renewals · Upgrades · Pauses · Cancellations (each a pill with icon: credit-card, refresh-cw, trending-up, circle-pause, door-open; each lights violet with `asr-keyword-glow` on its word). Hold.

## Frame 8 — Deploy and open the app

- scene: A "Deploy to Render" button is clicked; three services tick to Live; then the Offer admin app window rises into view showing the Apps page with "AmazingApp AI"
- voiceover: "Deploy it to Render.com in a single click, then open your new Offer admin app."
- duration: 3.87s
- transition_in: crossfade
- status: animated
- src: compositions/frames/08-deploy.html
- type: product_intro
- persuasion: Friction reduction
- beat: ease → anticipation
- blueprint: cta-morph-press (Adapt)
- asset_candidates: assets/app-00-apps.png — real Apps page (reference for the window's first screen)
- focal: Deploy button → app window
- roles: app-00-apps = reference (rebuild with app kit; don't paste the screenshot) · app window = hero
- sfx: none

Adapt: keep the condense-to-CTA + human-aimed click; after the click the CTA morphs into the app window instead of ending.
Scene 1 (0.0–2.4s): center: a large button "Deploy to Render" (dark raised button, Render as text, rocket icon). The app-kit cursor glides in and clicks on "single click" (`cursor-click-ripple`, `press-release-spring`).
Scene 2 (2.4–4.2s): the button expands into a compact deploy card listing three services — offersdk-api · offer-app · Postgres — each spinner flips to a green "Live" dot in a quick stagger.
Scene 3 (4.2–6.8s): on "open your new Offer admin app" the deploy card morphs (`card-morph-anchor`) into the full app-kit window at rest position (centered, ~1.1 scale): the Apps page — "Acme Labs" workspace header, two app cards "AmazingApp AI" and "Course Hub" (see app-00-apps.png). The cursor moves onto "AmazingApp AI" and hovers (highlight ring). Hold — next frame opens it.
- handoff_out: app window — centered x=960 y=470 (window center), scale 1.1, opacity 1, static

## Frame 9 — Plans and entitlements

- scene: The dashboard opens on Plans — rows cascade in — then the nav moves to Entitlements and the table splits into Usage (numbers) and Feature flags (yes/no)
- voiceover: "Start building your plans. Add your entitlements. Some are yes or no, like exports. Some are a number, like AI credits or API calls."
- duration: 7.45s
- transition_in: crossfade
- status: animated
- src: compositions/frames/09-plans-entitlements.html
- type: feature_showcase
- persuasion: Show-don't-tell proof
- beat: clarity + control
- blueprint: cursor-ui-demo (Adapt)
- asset_candidates: assets/app-06-plans.png — real Plans table; assets/app-07-entitlements.png — real Entitlements table
- focal: the Plans table, then the Entitlements table
- roles: both screenshots = reference (rebuild with the app kit, matching rows/data exactly) · app window = hero
- sfx: none
- handoff_in: app window — centered x=960 y=470, scale 1.1, opacity 1, static

Adapt: keep the cursor driving the reconstructed UI; the camera holds the window and punches in on the rows the VO names.
Scene 1 (0.0–3.0s): app window at rest (handoff). Nav "Plans" active; header "Plans" with Use SDK / Use API / New plan. On "Start building your plans" the 5 plan rows cascade in top→down (`dynamic-content-sequencing`): Free, Starter $12/mo, Pro $29/mo Featured, Enterprise, Lifetime deal $199 once — exact data per app-06-plans.png. Gentle punch-in (`coordinate-target-zoom`) to ~1.4 on the Plan/Price/Entitlements columns.
Scene 2 (3.0–5.0s): on "Add your entitlements" the camera eases back to ~1.15, the cursor clicks "Entitlements" in the nav (`cursor-click-ripple`); the page swaps to the Entitlements table (header "Entitlements", segmented All · Usage · Feature flags). Rows cascade in.
Scene 3 (5.0–8.0s): on "Some are yes or no, like exports" punch in (~1.6) on the Feature flag rows; "PDF export" row highlights (row tint `is-hl`) and its purple "Feature flag" tag gets a soft glow; a small toggle switch beside it flips ON.
Scene 4 (8.0–11.4s): on "Some are a number, like AI credits or API calls" the camera glides up to the Usage rows; "AI credits" row highlights with its blue "Usage" tag, and a small inline limit chip types "2,500 / mo" beside it; then "API access" row glows briefly on "API calls". Hold the punched-in read.
- handoff_out: app window — scale 1.1 rest framing restored over the last 0.6s (centered x=960 y=470), opacity 1

## Frame 10 — Usage-based pricing

- scene: Usage meters fill live as calls stream in — AI credits and API calls counted per account — framed for selling APIs and tools to AI agents
- voiceover: "Offer SDK counts every call against those numbers, so you can charge by usage. That's a good fit for selling APIs and tools to AI agents."
- duration: 6.82s
- transition_in: crossfade
- status: animated
- src: compositions/frames/10-usage.html
- type: feature_showcase
- persuasion: Feature-to-benefit translation
- beat: power + curiosity
- blueprint: dataviz-countup (Adapt)
- asset_candidates: assets/app-01-overview.png — real Overview (usage chart, stat strip); assets/app-02-analytics.png — real Analytics (usage bars)
- focal: the usage meter + live event feed
- roles: screenshots = reference (rebuild with app kit) · app window = hero
- sfx: none
- handoff_in: app window — centered x=960 y=470, scale 1.1, opacity 1, static

Adapt: keep the count-up + chart as hero and the camera pushing through to one hero metric; the data is a live usage meter.
Scene 1 (0.0–4.0s): window: nav "Overview" active; the stat strip from app-01-overview (Accounts 64 · Plans 5 · Accounts with an incentive 8 · Usage events · 30d 8,146 with sparkline). On "counts every call" a right-side panel "Recent activity" streams new rows in from the top every ~0.5s ("Globex used 1 AI credits", "Ada Turing used 3 API calls"…, small `+` icons), and the "Usage events" number ticks upward (`counting-dynamic-scale`, small increments from 8,146).
Scene 2 (4.0–7.0s): on "so you can charge by usage" punch in (~1.6) on an account usage card that slides over the chart area: "Ada Turing · Pro", meter "AI credits 2,180 / 2,500" filling (`stat-bars-and-fills`, brand gradient), a second meter "API calls 8,400 / 10,000".
Scene 3 (7.0–11.6s): on "selling APIs and tools to AI agents" a small floating chip row enters above the card: a bot icon + "agent · api_key ••••4f2" tag and three request pills ticking `POST /v1/generate` → each tick adds to the API calls meter. The meter approaches the limit, its fill shifting to the warning gradient at ~95%. Hold right at the edge.
- handoff_out: usage card — punched-in framing (scale ~1.6 on the card), meter at ~97%, opacity 1

## Frame 11 — The agent hits its limit

- scene: A terminal: an AI agent's call returns 402 limit_reached with an upgrade offer and checkout link; the agent follows the link, PayPal approves, the limit resets and the retry returns 200
- voiceover: "When an agent hits its limit, the API answers with an upgrade offer it can act on, and PayPal and Offer SDK handle the rest."
- duration: 5.87s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/11-agent-402.html
- type: feature_showcase
- persuasion: Show-don't-tell proof (the real 402 payload)
- beat: intrigue → ease
- blueprint: prompt-type-submit-generate (Adapt)
- asset_candidates: assets/hero-bg-muted.webp — contour backdrop
- focal: the 402 JSON response
- roles: hero-bg-muted = background (dim ~15%) · terminal = hero
- sfx: none

Adapt: keep the command-types-and-the-machine-answers loop; the answer is a 402 with an offer, then the retry succeeds.
Scene 1 (0.0–2.4s): a terminal-style `.ak-code` panel (title "agent · tool call", ~62% width, center-left). On "When an agent hits its limit" a line types: `POST /namespaces/acct_42/usage  { "entitlement": "api_calls" }` (Geist Mono).
Scene 2 (2.4–6.0s): on "the API answers with an upgrade offer" a red "402 Payment Required" status pill appears and the real response cascades in (`dynamic-content-sequencing`): `"error": "limit_reached"`, `"message": "You've used 10,000 of 10,000 API calls on the Pro plan. Scale includes 100,000 API calls for $99/month."`, `"offer": { "plan": { "name": "Scale" }, "price": 99, "checkout_url": "https://…/checkout?offer=…" }`, `"retry_after_purchase": true`. The `checkout_url` line gets a violet highlight sweep (`css-marker-patterns`). (Field names are the real API's; the plan "Scale" and its numbers are illustrative.)
Scene 3 (6.0–8.6s): on "it can act on" a cursor-less handoff: a small PayPal-yellow approval card ("PayPal · Approve $99/mo") slides in on the right and its button depresses (`press-release-spring`); a green toast "Upgraded to Scale".
Scene 4 (8.6–10.4s): on "PayPal and Offer SDK handle the rest" the terminal appends the retry: `POST …/usage` → green "200 OK" pill. Hold.

## Frame 12 — Add-ons

- scene: The Add-ons page; a template pack and a credit top-up land as rows and snap onto the Pro plan card as extras
- voiceover: "Add-ons are extras on top of a plan, like a template pack or a credit top-up."
- duration: 3.99s
- transition_in: crossfade
- status: animated
- src: compositions/frames/12-addons.html
- type: feature_showcase
- persuasion: Value stacking
- beat: ease
- blueprint: cursor-ui-demo (Adapt)
- asset_candidates: assets/app-08-addons.png — real Add-ons table
- focal: the add-on rows stacking onto the plan
- roles: app-08-addons = reference (rebuild with app kit) · app window = hero
- sfx: none

Adapt: cursor-driven UI with a punch-in; the payoff is two add-ons snapping onto a plan chip.
Scene 1 (0.0–2.6s): window at rest, nav "Add-ons" active, header "Add-ons" + New add-on. On "Add-ons are extras on top of a plan" the real rows cascade: AI boost · Extra storage pack · White-label (per app-08-addons.png). 
Scene 2 (2.6–5.0s): on "like a template pack" the cursor clicks "New add-on"; a slim create row slides in at the top and "Template pack" types into its name field with a price chip "+$19" (site funnel copy: Resource pack +$19 — use "Template pack +$19").
Scene 3 (5.0–7.2s): on "or a credit top-up" a second created row "Credit top-up · +1,000 AI credits" appears; then both new rows lift slightly and a "Pro" plan pill on the right shows them attached as two small tags ("+ Template pack", "+ Credit top-up") (`center-outward-expansion` from the pill). Hold.

## Frame 13 — Incentives

- scene: The Incentives page; a "Black Friday 2026" and an "AppSumo partner" incentive open into an override panel where usage is added and entitlements/add-ons are toggled on or hidden
- voiceover: "Incentives override what an account gets. Use one for a promo or as a package for an affiliate. An incentive can add usage, or give or hide entitlements and add-ons."
- duration: 8.36s
- transition_in: crossfade
- status: animated
- src: compositions/frames/13-incentives.html
- type: feature_showcase
- persuasion: Show-don't-tell proof
- beat: control + power
- blueprint: panel-edit-live-sync (Adapt)
- asset_candidates: assets/app-09-incentives.png — real Incentives table
- focal: the override panel bound to an account preview
- roles: app-09-incentives = reference (rebuild with app kit) · app window = hero
- sfx: none

Adapt: keep the bound editor panel → target surface live coupling; the target is a small "what this account gets" preview.
Scene 1 (0.0–3.0s): window at rest, nav "Incentives" active. On "Incentives override what an account gets" the 4 real rows cascade (Beta tester · AppSumo partner · Black Friday 2026 · Win-back offer, with override chips per app-09-incentives.png).
Scene 2 (3.0–6.2s): on "Use one for a promo" punch in on "Black Friday 2026" (row highlight, overrides "AI credits 1,000 · Storage (GB) 50"); on "or as a package for an affiliate" the highlight moves to "AppSumo partner" (overrides "Projects Unlimited · Team seats 5").
Scene 3 (6.2–12.8s): the cursor clicks AppSumo partner; a right-side detail panel slides in (`.ak-elevated`) titled "AppSumo partner" with an "Overrides" list, and beside it a small "Account preview — what they get" card. Live coupling, each on its VO word: "add usage" → AI credits stepper scrubs 500 → 5,000 and the preview's AI credits value counts up; "give" → "Custom domain" switch flips ON and appears in the preview with a green check; "or hide" → "White-label" add-on switch flips OFF and greys out/strikes in the preview. Hold on the edited preview.

## Frame 14 — Every plan has a checkout

- scene: A plan's own checkout: plan card → PayPal button → approved → the account's access flips on in the app
- voiceover: "Each plan gets its own checkout automatically. A customer buys, they get access, and the rest is handled."
- duration: 5.0s
- transition_in: crossfade
- status: animated
- src: compositions/frames/14-checkout.html
- type: feature_showcase
- persuasion: Friction reduction
- beat: ease + trust
- blueprint: device-surface-showcase (Adapt)
- asset_candidates: assets/app-16-settings.png — real App settings (PayPal payments section, checkout page)
- focal: the checkout surface
- roles: app-16-settings = reference only · checkout window = hero
- sfx: none

Adapt: a floating window hero whose screen steps through a flow (checkout → approval → access), cursorless.
Scene 1 (0.0–2.8s): a floating checkout window (app-kit surfaces, ~58% width, centered) — "AmazingApp AI · Pro" with interval toggle (Monthly · Yearly), price "$29/mo", included list (Projects Unlimited, AI credits 2,500, PDF export), and a full-width PayPal-yellow button "Pay with PayPal". On "Each plan gets its own checkout automatically" a small url chip above reads `checkout?plan=pro`.
Scene 2 (2.8–5.4s): on "A customer buys" the PayPal button depresses (`press-release-spring`), a short spinner, then a green check "Payment approved".
Scene 3 (5.4–8.0s): on "they get access" the checkout card slides left and a compact account row slides in on the right: "Jean Stroustrup · Pro" with entitlement chips flipping from grey to green one by one (PDF export ✓, AI credits 2,500 ✓); on "the rest is handled" a small webhook pill "checkout.completed" appears under it. Hold.

## Frame 15 — Offers

- scene: The Offers page; an offer is built on top of Pro — a better price, an incentive, an order bump — producing its own link; then a "Generate with Offer Agent" button
- voiceover: "Offers sit on top of a plan. An offer can give a better deal, change the price, attach incentives and add order bumps. You can build offers yourself, or let the Offer Agent create them."
- duration: 8.8s
- transition_in: crossfade
- status: animated
- src: compositions/frames/15-offers.html
- type: feature_showcase
- persuasion: Value stacking + show-don't-tell
- beat: power + excitement
- blueprint: panel-edit-live-sync (Adapt)
- asset_candidates: assets/app-18-offer-new.png — real New offer form (pricing: percent off / amount off, billing options, plans); assets/app-04-offers.png — real Offers page
- focal: the offer editor bound to a live checkout preview
- roles: screenshots = reference (rebuild with app kit) · app window = hero
- sfx: none

Adapt: editor panel (left) bound to a live "Checkout preview" (right) — each edit updates the preview immediately, matching the real New offer page's "Checkout preview" column.
Scene 1 (0.0–3.0s): window, nav "Offers" active, header crumb "Offers / New offer" with Cancel + Create offer. On "Offers sit on top of a plan" the form's Details block shows Name typing "Spring launch", and a Plans section shows the "Pro" plan chip selected; the right "Checkout preview" shows Pro $29/mo.
Scene 2 (3.0–9.2s): punch in (~1.4) to the form + preview. Each edit lands on its word and updates the preview live: "better deal" → Pricing segmented control picks "Percent off", field types "20" and the preview price strikes $29 → shows "$23.20/mo" (count-down `counting-dynamic-scale`); "change the price" → billing options: "Yearly" checkbox ticks and the preview gains a Monthly/Yearly toggle; "attach incentives" → an incentive chip "+500 AI credits" attaches and appears in the preview's included list; "add order bumps" → a bump row "Template pack +$19" with checkbox appears in the preview.
Scene 3 (9.2–14.6s): pull back to ~1.1; "Create offer" button pressed; a toast "Offer created · offer.to/spring" (link icon). On "or let the Offer Agent create them" a second button with sparkles icon and brand-gradient fill "Generate with Offer Agent" slides in beside Create offer and glows once (`ambient-glow-bloom`). Hold.
- handoff_out: none (clean cut)

## Frame 16 — The agent saves Tom

- scene: Tom (at his credit limit three months running) clicks cancel; the cancel flow hands off to the agent; agent trace reasons; the save offer "5,000 more credits, on us" appears; accepted; "Sale saved" inside the guardrails
- voiceover: "For example, Tom hit his credit limit three months running, then clicked cancel. The cancel flow passed him to the agent, which skipped the discount and gave him five thousand credits at the same price. It saved the sale, inside the limits you set."
- duration: 10.64s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/16-agent-save.html
- type: feature_showcase
- persuasion: Show-don't-tell proof + loss aversion reversed
- beat: tension → relief → triumph
- blueprint: agent-progress-theater (Adapt)
- asset_candidates: assets/app-site-demo-full.png — the site's agent churn-save demo (cancel modal, agent trace, guardrails — look reference); assets/app-17-cancel-flow-edit.png — real cancel flow modal preview; assets/app-05-cancel-flow.png — real Cancel flow page
- focal: the save offer card
- roles: all three = reference (rebuild the customer app billing card, the cancel modal and the agent trace with the app kit) · hero = save offer card
- sfx: none

Adapt: keep the single-trigger → working-state theater → receipt cascade; the trigger is Tom's cancel click and the receipt is the save offer + "Sale saved".
Scene 1 (0.0–4.6s): left ~55%: Tom's view of the customer app (rebuilt like the site demo's "Acme Docs" billing card but titled "AmazingApp AI · Billing"): "Pro plan $29/mo", meter "AI credits 2,500 / 2,500" in the warning gradient, and a tiny 3-bar history labelled "Jul · Aug · Sep" each at 100% (red caps). On "Tom hit his credit limit three months running" the three bars fill in turn. On "then clicked cancel" the cursor clicks "Cancel subscription" (danger outline button).
Scene 2 (4.6–8.6s): a cancel modal pops (`spring-pop-entrance`, smooth) — "Why are you cancelling?" with answers (It's too expensive · I keep running out of credits · …, per the real cancel flow preview); the cursor picks "I keep running out of credits". On "passed him to the agent" a right-side "Agent trace" panel (sparkles icon, like trace.tsx) slides in and steps tick (`agent-progress-theater` status theater): "Read usage: at limit 3 months" ✓ → "Reason: credits, not price" ✓ → "Guardrails: max 40% off · credits allowed" ✓.
Scene 3 (8.6–13.6s): on "skipped the discount" a struck-through ghost option "40% off" fades in the trace and is crossed out; on "gave him five thousand credits at the same price" the modal swaps to the save offer card: headline "Here are 5,000 more credits, on us", chips "+5,000 AI credits" · "Pro price unchanged", price "$29/mo", button "Add the credits" (brand gradient). The cursor clicks it.
Scene 4 (13.6–18.2s): on "It saved the sale" a green toast "Sale saved · Tom stays on Pro" and the trace logs two webhook events `cancel_flow.saved` and `account.addon_granted`; on "inside the limits you set" a guardrails pill row highlights in the trace ("Max discount 40%" · "Credits ✓" · "Pause ✓"). Hold.

## Frame 17 — Dashboard and MCP

- scene: The Overview dashboard (usage chart, accounts by plan), then Claude connected through the MCP server asks for usage and creates an offer that appears in the dashboard
- voiceover: "The dashboard shows your insights and every customer's usage. Or connect the MCP server, so your agent can review usage and create offers and incentives on the fly, so you can grow revenue without growing your team."
- duration: 9.76s
- transition_in: crossfade
- status: animated
- src: compositions/frames/17-dashboard-mcp.html
- type: feature_showcase
- persuasion: Future pacing (one person runs pricing)
- beat: control → aspiration
- blueprint: prompt-type-submit-generate (Adapt)
- asset_candidates: assets/app-01-overview.png — real Overview dashboard; assets/app-13-mcp.png — real MCP server page; assets/app-10-accounts.png — real Accounts table
- focal: the Overview chart, then the chat→tool-call→new offer loop
- roles: screenshots = reference (rebuild with app kit) · app window + chat panel = hero
- sfx: none

Adapt: first an establishing dashboard read, then the prompt → tool calls → generated artifact loop, where the artifact appears in the dashboard.
Scene 1 (0.0–4.4s): window at rest, nav "Overview" active — the real overview: stat strip, "Usage · last 30 days" area chart drawing left→right (`svg-path-draw`, brand gradient fill), "Accounts by plan" bars filling (Free 27 · Pro 16 · Starter 14 · Lifetime deal 6 · Enterprise 1). On "every customer's usage" the "Top accounts · 30d" list fills in (Ada Turing 800 events, Globex 549…).
Scene 2 (4.4–8.0s): on "connect the MCP server" the window slides left/scales to ~0.85 and a chat panel enters on the right styled as a generic AI chat (text wordmark "Claude" + "Offer MCP server · Live" tag — no logo). The prompt types: "Which Pro accounts hit their AI credit limit this week? Give them a 20% upgrade offer."
Scene 3 (8.0–12.4s): on "review usage" tool-call chips cascade (`agent-progress-theater` style): `list_accounts` ✓ · `get_usage` ✓ → a 3-row mini result (Tom · Priya · Ada) ; on "create offers and incentives on the fly" `create_offer` ✓. In the dashboard window the nav "Offers" count ticks 0 → 1 and a new row "Credit limit upgrade · 20% off" slides into view with a "New" tag.
Scene 4 (12.4–15.4s): on "grow revenue without growing your team" hold; the chat shows the assistant's short confirmation "Created offer for 3 accounts." Still.

## Frame 18 — The React SDK + agent skill

- scene: Code panel shows the three SDK pieces — gate, checkout, cancel flow — each lighting the matching UI on a mini app; then a coding-agent prompt installs the SDK with the Offer SDK skill
- voiceover: "The React Offer SDK gates features, triggers checkouts and runs cancel flows. Add the Offer SDK agent skill, and one prompt installs it in your app."
- duration: 7.84s
- transition_in: crossfade
- status: animated
- src: compositions/frames/18-react-sdk.html
- type: feature_showcase
- persuasion: Friction reduction
- beat: ease + confidence
- blueprint: prompt-type-submit-generate (Adapt)
- asset_candidates: assets/app-11-integration.png — real Integration guide (keys + steps)
- focal: the code panel
- roles: app-11-integration = reference only · code + mini app = hero
- sfx: none

Adapt: code on the left bound to a mini "your app" on the right; then a typed agent prompt produces the install diff.
Scene 1 (0.0–5.8s): left `.ak-code` "app/settings.tsx" (~50% width); right a small "Your app · Settings" window. Each SDK piece types on its word and lights its UI twin: "gates features" → `<Gate feature="custom_domains" fallback={<UpgradeOffer />}>` and the right shows a locked "Custom domains" row with an Upgrade chip; "triggers checkouts" → `<Offer.Checkout />` and a PayPal-yellow button appears; "runs cancel flows" → `<CancelFlow />` and a "Cancel subscription" link with the cancel modal peeking. (Gate/useEntitlement copy as on the site's SDK visual.)
Scene 2 (5.8–11.2s): on "Add the Offer SDK agent skill" the code panel flips to a terminal: `npx skills add offer-sdk` types and a green "✓ skill installed"; on "one prompt installs it in your app" a prompt types "Add Offer SDK to my app" and a diff cascades in: `+ import { OfferProvider } from "offer-sdk"` · `+ <OfferProvider appId="app_lnpSrz">` (green add lines) and a final "✓ 3 files changed". Hold.

## Frame 19 — Zapier and webhooks

- scene: The Webhooks page with "Connect Zapier"; lifecycle events fire as pills and each triggers a downstream action: an email when someone hits their limit, a Slack ping when a cancel is saved
- voiceover: "And every customer and billing event can trigger a Zap or a webhook, so you can send a personal email when someone hits their limit, or ping Slack when a cancel is saved."
- duration: 7.25s
- transition_in: crossfade
- status: animated
- src: compositions/frames/19-zapier.html
- type: feature_showcase
- persuasion: Feature-to-benefit translation
- beat: power + ease
- blueprint: camera-journey (Adapt)
- asset_candidates: assets/app-15-webhooks.png — real Webhooks page with Zapier card
- focal: event pill → action card
- roles: app-15-webhooks = reference (rebuild with app kit) · app window + action cards = hero
- sfx: none

Adapt: sub-shape A — a small action in one panel pays off in another region, connected by a camera move; two round-trips (email, Slack).
Scene 1 (0.0–4.4s): window at rest, nav "Webhooks" active, header with "Connect Zapier" (zapier orange text) + "Add endpoint". On "every customer and billing event" an events list cascades in a card: account.created · checkout.completed · subscription.renewed · subscription.paused · usage.limit_reached · cancel_flow.saved (mono pills, real event names). On "a Zap or a webhook" two endpoint rows appear: "Zapier · Send email" (orange Z mark as text) and "https://hooks.yourapp.com/offer" (green dot).
Scene 2 (4.4–9.4s): on "send a personal email when someone hits their limit" the `usage.limit_reached` pill glows and a delivery line draws out of the window to the right (`svg-path-draw`); the camera follows to an email card: "To: priya@… · Subject: You're out of credits — here's 2,000 on us" (short), green "Sent".
Scene 3 (9.4–13.8s): camera swings back past the window to the left; on "or ping Slack when a cancel is saved" the `cancel_flow.saved` pill glows and a Slack-style message card appears: "#revenue · Offer SDK: Tom accepted a save offer (+5,000 credits)". Hold.

## Frame 20 — offersdk.com

- scene: End card: Offer SDK lockup, "Deploy your own agentic offer API", the URL offersdk.com and the gradient "Get started free" button, over the site's footer artwork
- voiceover: "Go to offersdk.com and deploy your own agentic offer API for your app today."
- duration: 6.37s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/20-cta.html
- type: cta
- persuasion: Clear next step
- beat: urgency-to-act
- blueprint: cta-morph-press (Reproduce)
- asset_candidates: assets/footer-bg.webp — the site's footer CTA backdrop; assets/logo-mark.svg — Offer SDK mark
- focal: offersdk.com + CTA button
- roles: footer-bg = background (dim ~45%) · logo-mark = hero mark
- sfx: none

Scene 1 (0.0–2.4s): the site footer CTA look: contour footer art, centered lockup (logo-mark + "Offer SDK") blooms in (`ambient-glow-bloom`).
Scene 2 (2.4–5.0s): on "Go to offersdk.com" the lockup condenses upward and the URL "offersdk.com" types in large below it (`discrete-text-sequence` with caret); on "deploy your own agentic offer API" a muted subline fades in: "Your own agentic offer API · Self-hosted on Render · PayPal checkout".
Scene 3 (5.0–8.0s): the gradient "Get started free →" button (site hero CTA) rises; the cursor arrives and clicks it (`cursor-click-ripple`, `press-release-spring`); hold the end card to the last frame (final frame — a gentle settle is allowed).
