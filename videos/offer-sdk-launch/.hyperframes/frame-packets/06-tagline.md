# Frame packet: 06-tagline

## Project inputs

- Project: /Users/dylanjones/apps/offer-sdk/videos/offer-sdk-launch
- Design tokens: /Users/dylanjones/apps/offer-sdk/videos/offer-sdk-launch/frame.md
- RULES_DIR: /Users/dylanjones/.claude/skills/hyperframes-animation/rules

## Assigned storyboard block

## Frame 6 — The thesis

- scene: The landing-page hero line, full frame: "Pricing changes shouldn't need a pull request" with "a pull request" in the brand gradient
- voiceover: "Pricing changes shouldn't need a pull request."
- duration: 4.4s
- transition_in: blur-crossfade
- status: outline
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

## Selected blueprint: titlecard-reveal

# titlecard-reveal — Title-Card / Single-Card Reveal

**intent**: The calm breather/landing beat — one clean title or single brand/proof card revealed with exactly one restrained move (a slide-up crossfade, or a wipe-away-to-reveal), then a still hold. Low motion is the payload, not a deficiency.

**roles served**

- Benefits (from `benefits-titlecard-crossfade`, #34): a calm two-line value title card — headline value line, then one slide-up crossfade to a qualifier/elaboration line that holds center.
- Social_Proof (from `social-proof-reveal-card`, #35): wipe a busy app-collage open away with one diagonal pill-sweep to reveal a clean brand lockup (icon + wordmark) plus a centered "loved by [N]+ [audience] teams" social-proof line that spring-settles and holds.
- CTA (from `hard-cut-card-stack-to-logo`): a monochrome end-card
  CHAIN — statement → CTA / availability line → brand wordmark/logo — separated by instant hard
  cuts at full opacity; each card is its own allocated stillness, and the sequence terminates on
  the logo held to the final frame.
- Product_Intro (from `title-card-prelude-chain`): a three-beat dark title
  PRELUDE before any product UI — `[logo]` pop → `[name]` (a `[version]` appends grey→bright) →
  `[tagline]` card — chained by clears and blur-snap handoffs rather than hard cuts.

**duration**: 3–5s (Benefits 3–4s; Social_Proof ~5s / observed 4.7s). Card chains run 2–3s per
card, ~5.5–9.5s total.

**shot structure**

```
Scene 1 (0.0–~0.4s): static camera on [neutral / dark background]. Establish the opening state.
  Variant — Benefits: empty-to-text — [benefit line 1] is about to fade in centered (no busy open).
  Variant — Social_Proof: a busy intro frame holds briefly — an [app-screenshot / use-case collage] of overlapping cards under a [setup line].

Scene 2 (~0.4–~1.5s): the ONE move executes — a single restrained reveal that brings the calm card to center.
  Variant — Benefits: [benefit line 1] fades in centered while scaling slightly (~95%→100%, smooth ease-out) and holds.
  Variant — Social_Proof: a large [accent-color] rounded pill sweeps diagonally bottom-left → top-right and exits the corner, clip-path wiping the collage away to reveal the [brand logo lockup] beneath as the [logo icon] strokes draw on.

Scene 3 (~1.5s–end): the revealed/settled card holds to the end (the allocated stillness). At most one subtle live element (a slow breathing pulse on the card, or a very slow camera drift). No second development phase.
  Variant — Benefits: [benefit line 1] translates up and fades out as [benefit line 2 — qualifier / elaboration] translates up from below center and fades in to take center; holds. (This single slide-up crossfade IS the one move — Benefits front-loads no Scene-2 wipe.)
  Variant — Social_Proof: the lockup — [logo icon] centered, [wordmark] below, centered [social-proof tagline] "Loved by [N]+ [audience] teams" (the [N]+ may count up) — spring-settles small, then holds.

Variant — card chain (CTA end-card stack / Product_Intro title prelude): the single-card contract
repeats 2–3 times in sequence. Each card is a complete Scene 1–3 in miniature — arrive (or simply
BE there), at most one restrained move, hold — and the seams between cards are INSTANT hard cuts
at full opacity (no crossfade, no fade-through-black) or, in the prelude flavor, a blur-away →
snap-into-focus handoff.
  Card moves stay on budget: a character-by-character type-on with visible partial states, a
  right-to-left backspace that resolves the [wordmark] into the small [logo icon], a grey→bright
  append ("[name]" gains "[version]"), a blur-snap into focus — or nothing beyond a
  barely-perceptible continuous slow scale-up across the hold.
  The final card is always the [brand logo / lockup], held static to the last frame.
```

**motion vocabulary**: single restrained reveal (gentle fade-in + subtle scale-up settle | diagonal clip-path pill-wipe), one slide-up crossfade between two centered lines (Benefits), icon stroke draw-on (Social_Proof), optional "[N]+ teams" count-up, logo+tagline spring-settle-and-hold, subtle breathing on the held card, hold-to-end. Calm register — no spring chains, no tumble, no per-beat flips, no second phase. Camera static (optional very slow drift only). Card-chain register: instant hard cut at full opacity as the only seam, barely-perceptible
continuous slow scale-up across each hold, character-by-character type-on with visible partial
states, right-to-left backspace collapsing the wordmark into the logo icon, grey→bright text
append, blur-away → snap-into-focus card handoff, logo pop with overshoot + glow (prelude opener),
monochrome text-on-solid throughout.

**rule mapping**

- gentle fade-in + subtle scale-up settle (Benefits Scene 2) → `rules/scale-swap-transition.md` (restrained in/settle; cross-reference the fade ease in `techniques.md`)
- single slide-up crossfade between two centered lines (Benefits Scene 3) → `rules/discrete-text-sequence.md` (one line hands off to the next; translate-up + crossfade)
- diagonal pill-wipe reveal (Social_Proof Scene 2) → `../techniques.md` (clip-path reveal masks — the wipe)
- icon stroke draw-on (Social_Proof Scene 2) → `rules/svg-path-draw.md`
- "[N]+ teams" count-up (Social_Proof Scene 3, optional) → `rules/counting-dynamic-scale.md`
- logo + tagline spring-settle-and-hold (Social_Proof Scene 3) → `rules/spring-pop-entrance.md` (single soft settle; intentionally one beat, not a chain)
- subtle breathing on the held card (the one live element during the hold) → `rules/sine-wave-loop.md`
- type-on / backspace / grey→bright append (chain cards) → `rules/discrete-text-sequence.md`
  (non-linear typing incl. backspace; drive the version append as a bulk addition)
- wordmark remainder resolves into the logo icon → `rules/scale-swap-transition.md` (same-center
  swap fired as the last character deletes)
- barely-perceptible slow scale-up across a hold → the camera-modifier drift
  (`rules/multi-phase-camera.md`, micro-drift register) applied per-card
- blur-away → snap-into-focus handoff (prelude flavor) → `rules/depth-of-field-blur.md` (single
  pull on the outgoing / incoming card)
- logo pop with overshoot + glow (prelude card 1) → `rules/spring-pop-entrance.md` +
  `rules/ambient-glow-bloom.md`
- instant hard cut at full opacity → not a rule: a timeline `tl.set` swap — deliberately NO
  transition entry.

**camera modifier**: optional — a single very slow drift/push under the hold only → `rules/multi-phase-camera.md`. Default is fully static; do not add unless the held beat would otherwise read as a freeze-frame.

**stillness note**: This is a legitimate allocated-stillness beat. The hold in Scene 3 is the deliverable, not an unanimated gap — do NOT manufacture a development phase, extra swaps, or force-animation. One restrained move + a subtle hold (optionally one breathing element or one slow drift) is the correct and complete shape. The card-chain variant does not break this: each card individually obeys the one-move + hold
contract, and the hard cut is a seam, not a move. Boundary: if the cards flip at sub-second tempo
or each beat carries its own entrance/exit energy, you have left this blueprint — that is
`kinetic-type-beats` (its CTA variant owns the high-tempo value-line stack).

## Selected motion rule: gradient-text-sweep

---
name: gradient-text-sweep
description: A gradient tweened THROUGH letterforms — background-clip:text + a backgroundPosition tween. Three forms: a continuous horizontal sweep inside a held headline, a traveling word-to-word highlight, and a hue-sweep that settles to a solid. Glyphs never move; finite, deterministic, seek-safe.
metadata:
  tags: gradient, text, sweep, background-clip, highlight, hue, typography, headline
---

# Gradient Text Sweep

Color that lives **inside the glyphs**: the headline's fill is an oversized gradient clipped into the letterforms (`background-clip: text`), and the motion is the gradient sliding **through** the type — the letters never move. Three forms: a **continuous sweep** across a held title card, a **word-to-word highlight** that lights a line left→right, and a **hue-sweep** that settles to a solid.

Boundaries: [asr-keyword-glow.md](asr-keyword-glow.md) is word-timed emphasis railed to ASR timestamps — this rule is a design beat with no audio rail. [ambient-glow-bloom.md](ambient-glow-bloom.md)'s traveling sweep is a sheen riding **over a surface**; here the gradient is masked **into the type** (its "Shimmer sweep" variation is this mechanism re-aimed as a working-state loop). [css-marker-patterns.md](css-marker-patterns.md) draws accents _around_ text, never fills.

## How It Works

The text carries a gradient background **wider than its own box** (`background-size: SWEEP_SPAN 100%`, e.g. `300% 100%`) clipped into the glyphs, so tweening `backgroundPosition` slides the gradient through the visible letterforms. Two gotchas own this rule:

- **`background-position` percentages only produce travel when `background-size` exceeds 100%** — at 100% the image is pinned and the tween is a silent no-op.
- **The percent axis runs opposite to the perceived travel** — tweening `"100% 50%"` → `"0% 50%"` moves the highlight left→right through the text.

1. **Continuous sweep (held title card)** — one long **linear** `backgroundPosition` tween spanning the hold. First and last color stops equal, so the travel has no visible seam and reads as endless while remaining a single finite tween.
2. **Word-to-word highlight** — each word is two pixel-identical stacked copies: a base copy in the resting color and a gradient-clipped copy at `opacity: 0`. A per-word opacity envelope (rise, then fall as the next word rises) passes the highlight along on an index-derived stagger — an **envelope, not a moving mask**: no per-word position measurement.
3. **Hue-sweep → solid** — the gradient holds position while a `filter: hue-rotate()` tween sweeps its hues; the settle is a stacked-copy crossfade to a solid twin — never a color-stop tween (gradients with different stops don't interpolate reliably).

## Recipe

```html
<!-- inside a standard scene clip (hyperframes-core) -->
<!-- Forms A/C: gradient headline; solid twin behind for the Form C settle -->
<div class="headline-stack">
  <h1 class="headline solid-twin">{headlineText}</h1>
  <h1 class="headline gradient-fill" id="headline">{headlineText}</h1>
</div>

<!-- Form B: per-word stacked copies -->
<p class="line">
  <span class="word"><span class="w-base">{word1}</span><span class="w-hot">{word1}</span></span>
  <span class="word"><span class="w-base">{word2}</span><span class="w-hot">{word2}</span></span>
</p>
```

```css
.headline-stack,
.word {
  display: grid; /* twins share one cell — pixel-identical boxes */
}
.headline,
.w-base,
.w-hot {
  grid-area: 1 / 1;
}
.gradient-fill,
.w-hot {
  background-image: {gradient}; /* {sweepGradient} A/C, {highlightGradient} B */
  background-size: SWEEP_SPAN 100%; /* MUST exceed 100% or the position tween is dead */
  background-position: 100% 50%; /* start; tween toward 0% for left→right travel */
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.solid-twin {
  color: {settleColor};
}
.w-base {
  color: {restColor};
}
.w-hot {
  opacity: 0; /* the envelope raises it as the highlight passes */
}
```

```js
// Form A: continuous sweep. 100% → 0% reads left→right (percent axis inverted);
// ease "none" — an eased sweep reads as an object, not light.
tl.fromTo(
  "#headline",
  { backgroundPosition: "100% 50%" },
  { backgroundPosition: "0% 50%", duration: SWEEP_DUR, ease: "none" },
  SWEEP_START,
);

// Form B: traveling highlight — per-word rise/fall envelopes, index stagger.
gsap.utils.toArray(".w-hot").forEach((el, i) => {
  const at = HIGHLIGHT_START + i * WORD_LAG;
  tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: HOT_RISE, ease: "power2.out" }, at);
  tl.to(el, { opacity: 0, duration: HOT_FALL, ease: "power2.in" }, at + WORD_LAG);
});

// Form C: hue-sweep, then crossfade to the solid twin (never tween color stops).
tl.fromTo(
  "#headline",
  { filter: "hue-rotate(0deg)" },
  { filter: `hue-rotate(${HUE_RANGE}deg)`, duration: HUE_DUR, ease: "power1.inOut" },
  HUE_START,
);
tl.to(
  "#headline",
  { opacity: 0, duration: SETTLE_SNAP_DUR, ease: "power2.in" },
  HUE_START + HUE_DUR,
);
```

## Variations

- **Title-card crawl** — Form A stretched across a long terminal hold (3–8s end card): seamless-ended gradient, `ease: "none"`, `SWEEP_DUR` = the whole hold. One tween, no loop.
- **One-pass sheen inside type** — gradient is the resting fill everywhere except one narrow highlight band (≤ ~25% of the span); one `backgroundPosition` pass carries the band through and the text returns to rest with no crossfade.
- **Karaoke settle** — Form B with the fall tweens skipped: the line lights cumulatively left→right and holds fully lit; settle color = the hot state, base copies start dimmer.
- **Gradient climax word** — one emphasized word (often ~-8° rotated) carries the gradient while the line stays solid; static gradient + a short Form C hue shift on landing, settling to the brand accent. Pairs with a `kinetic-beat-slam` arrival.

## Values

| token               | range                  | notes                                                                                |
| ------------------- | ---------------------- | ------------------------------------------------------------------------------------ |
| SWEEP_SPAN          | 200–400%               | must exceed 100%; wider = softer/slower feel, narrower = busier color per glyph      |
| SWEEP_DUR           | 1.2–3s                 | match the card's hold exactly; slower than ~4s stops registering as motion           |
| WORD_LAG            | 0.25–0.5s              | HOT_FALL starts exactly WORD_LAG after the rise so envelopes cross — a gap = a blink |
| HOT_RISE / HOT_FALL | 0.15–0.3s / 0.25–0.45s | fall slightly longer — the highlight "trails"                                        |
| HUE_RANGE / HUE_DUR | 40–180° / 0.8–1.6s     | past ~180° the palette dissociates from itself mid-sweep                             |
| SETTLE_SNAP_DUR     | 0.1–0.35s              | the goldens snap (~0.15s)                                                            |
| {settleColor}       | —                      | one of the gradient's own stops (or the brand ink) so the settle reads as resolution |

## Critical Constraints

- **`background-size` > 100%** on any element whose `backgroundPosition` is tweened — otherwise the tween is a silent no-op.
- **Percent axis is inverted** — left→right perceived travel is `100% → 0%`.
- **Both `-webkit-background-clip: text` AND `background-clip: text`, with `color: transparent`** — missing the prefix renders a solid gradient block over the text in the capture browser.
- **`ease: "none"` on position sweeps** — this is supposed to read as light, not an accelerating object.
- **Seamless ends for a crawl** — first and last stops equal, or the wrap point flashes a hard edge mid-hold.
- **Stacked copies pixel-identical** — same box, font, weight, tracking, one grid cell; any metric drift makes the crossfade a double-exposure.
- **`data-layout-allow-occlusion` on the twin** — pixel-identical stacked copies trip `hyperframes check`'s `text_occluded` gate by construction; the flag is the sanctioned waiver for this mechanism.
- **Settle by crossfade, never by tweening stops**; and the glyphs never move — if the type must travel, that's a separate rule on the wrapper.
- **No CSS `@keyframes` shimmer** — wall-clock animation desyncs from seek; every sweep is a timeline tween.

## See also

`kinetic-beat-slam` (slam lands the climax word, hue settle finishes it) · `spring-pop-entrance` (pop in solid, sweep after) · `discrete-text-sequence` (swap-slot under a riding crawl) · `ambient-glow-bloom` (surface-level sibling) · `css-marker-patterns` (strokes around text; fills here).
