# Frame packet: 02-requests

## Project inputs

- Project: /Users/dylanjones/apps/offer-sdk/videos/offer-sdk-launch
- Design tokens: /Users/dylanjones/apps/offer-sdk/videos/offer-sdk-launch/frame.md
- RULES_DIR: /Users/dylanjones/.claude/skills/hyperframes-animation/rules

## Assigned storyboard block

## Frame 2 — Every yes is another deploy

- scene: Customer requests arrive as message cards; each one spawns an if-statement typing into billing.ts and a "Deploying…" toast; the file gets messier with every yes
- voiceover: "Then one customer asked for a longer trial. Another wanted more seats. An influencer wanted a deal for her audience, live by Friday. Every yes meant more spaghetti code and another deploy."
- duration: 12.4s
- transition_in: crossfade
- status: outline
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

## Selected blueprint: overwhelm-surround

# overwhelm-surround — Overwhelm / Close-In

**intent**: Convey overwhelm by accumulation. Recognizable subjects assemble, density markers scatter in to amplify "look how much," then the central subject morphs into the viewer's own avatar and elements close in from ALL sides — the frame feels surrounded, not zoomed-into. The emotional arc is recognition → claustrophobia.

**roles served**

- Problem (from `problem-mockup-overwhelm`): when the problem beat must first show "too many tools / too much surface area" and then put **the viewer inside it** — a literal swap of subject (product → person) followed by a closing-in that feels invasive. Reach for it when the pain is "you're buried," not "this metric is bad" (that's `dataviz-countup`).
- Problem (from `desktop-clutter-accumulation`): when the overwhelm is a **workspace**, not a tool
  count — live windows, stickies, and alert toasts pile up until the frame is chaotically full, and
  the beat resolves not by closing in but by shoving the clutter aside and asking the question.
  Reach for this variant when the pain lands on words ("how can you X… when you spend months on
  Y?"), not on a surrounded avatar.

**duration**: 6–9s (clutter-shove-to-question variant ~10s)

**shot structure** (a `[bg]` canvas; recognizable surfaces first, the viewer's avatar revealed underneath, then a radial crowd)

- **Scene 1 (0.0–~1.6s) — recognizable assembly.** Three `[product mockups / surfaces]` assemble into something the viewer knows — staggered scale-in, the **center** one full-size, the two flanks smaller (~0.86). Each rides a low-amplitude float so they feel like live context, not a static collage. Camera static.
- **Scene 2 (~1.6–3.0s) — density amplifies.** `[platform icons / logos]` scatter in around the mockups (staggered), used purely as **density markers** — "look how much surface area," not animated dials.
- **Scene 3 (~3.0–4.6s) — the morph (signature move).** The CENTER mockup MORPHS: its content fades out, the container reshapes, and the viewer's `[avatar]` is revealed **underneath** — a literal swap of subject, product → person.
- **Scene 4 (~4.6–end) — close-in.** `[task bubbles / demands]` close in from ALL sides toward the avatar (radial staggered entry). The avatar **stays put** while the bubbles invade — the claustrophobia comes from being surrounded, never from a camera push. Holds on the crowded state.
- **Variant — clutter-shove-to-question** (replaces Scenes 3–4 and
  inverts the camera contract — see modifier): accumulation runs under a **slow steady zoom-out** —
  `[sticky notes]` bounce in springy, `[dashboard / editor windows]` pop and slide up, a stack of
  `[alert toasts]` slides in at one edge, inner content keeps typing / log-scrolling as live density,
  windows overlap until the frame is chaotically full. The camera then REVERSES into a quick
  push-in that **shoves the clutter to the frame edges**, opening central negative space where a
  `[two-part serif question]` builds word-by-word (line 1 swaps in place to line 2); a `[cursor]`
  glides in from off-frame and comes to rest under the text; a very slow forward creep and hold.
  No morph, no avatar — the question is the payoff.

**motion vocabulary**: staggered scale-in assembly; resting-scale-preserving low float; density-marker icon scatter; content-fade → container-reshape → reveal-anchor-beneath morph; radial close-in entry from all compass points; held crowded end-state. Clutter-shove variant: slow steady zoom-out under accumulation; reverse quick push-in; clutter
shoved to frame edges opening center negative space; continuous live typing / log scroll inside
windows as ambient density; toast-stack slide-in; word-by-word serif build with in-place line swap;
cursor glide-to-rest; very slow forward creep + hold.

**rule mapping**

- staggered mockup + icon entries (smooth settle onto their resting scale) → `spring-pop-entrance` (smooth-settle register) backed by `gsap-effects`
- platform icons as density markers (positions pre-baked, scale/opacity only — NOT internal-parts animation) → `svg-icon-enrichment` (its DOM contract only)
- center mockup → avatar morph (HF forbids `width`/`height` tweens → drive the reshape on `scaleX`/`scaleY`, anchor = the avatar layer rendered beneath) → `card-morph-anchor`
- radial bubble close-in (positions baked once via `cos`/`sin`, staggered entry) → `gsap-effects` (radial layout) + `spring-pop-entrance` (per-bubble arrival)
- low-amplitude float on background mockups/icons → `sine-wave-loop` (low-amplitude register — subtle jitter that composes onto each element's resting scale, never a `fromTo` yoyo that re-tweens to its start)
- (variant) zoom-out under accumulation → quick push-in → slow forward creep → `multi-phase-camera`
  (pull-back / push / drift as sequential phases on one world wrapper; counter-translate math in
  `viewport-change`)
- (variant) clutter shoved to the edges as the push-in lands → `center-outward-expansion` (outward
  vectors to edge resting positions), fired at the same timeline position as the camera push so the
  shove reads as CAUSED by it (`reactive-displacement` register)
- (variant) word-by-word serif question build → `gsap-effects` (staggered word reveal); the
  in-place line-1 → line-2 swap → `discrete-text-sequence`
- (variant) live typing inside windows → `gsap-effects` (typewriter); the continuous inner
  log-scroll — composition: looping content translateY via `gsap-effects` (masked)
- (variant) cursor glide-in coming to rest → `cursor-click-ripple` (approach portion only — no click)

**camera modifier**: camera-static — the close-in must read as the world crowding the subject, so the frame holds; a push-in would convert "surrounded" into "zoomed-into" and kill the claustrophobia. The clutter-shove-to-question variant is the sanctioned exception: there the camera IS the
storyteller (zoom-out ↔ push-in via `multi-phase-camera`), and the claustrophobia comes from
accumulation, not surround — never mix the two resolutions in one shot.

## Selected motion rule: discrete-text-sequence

---
name: discrete-text-sequence
description: Replace entire text states at frame thresholds for non-linear typing effects — typos, bulk additions, pauses, backspaces, simulated thinking.
metadata:
  tags: text, typing, discrete, threshold, non-linear, sequence
---

# Discrete Text Sequence

Instead of character-by-character typewriter, replace entire string states at time thresholds — enabling non-linear effects (typos, backspaces, bulk paste, "thinking" gaps) that smooth per-char typing can't achieve. If your effect is "type each character, no edits", this rule is overkill — use the smooth-slice variation below.

## How It Works

The typing is authored as a sparse array of `{ t, text }` states; on every `onUpdate` a **reverse search** finds the latest entry whose `t` has passed and renders its text. Display jumps between states with no animation between them — the realism comes from the schedule shape: fast keystroke clusters (0.06–0.20s apart), pauses at word breaks (0.3–0.6s), a typo, backspaces peeling back to the fork, then a bulk paste replacing many chars in one entry. A block cursor blinks via a deterministic sin square wave on the same timeline.

## Recipe

```html
<!-- inside a standard scene clip (hyperframes-core) -->
<div class="terminal">
  <div class="prompt">$</div>
  <div class="text-wrap">
    <span class="text" id="text"></span><span class="cursor" id="cursor">_</span>
  </div>
</div>
```

```css
.terminal {
  font-family: {monoFont}; /* monospace required — proportional jitters even in a fixed box */
  display: flex;
  align-items: baseline;
  font-size: TERMINAL_FONT_SIZE;
}
.text-wrap {
  display: inline-flex;
  align-items: baseline;
  min-width: TEXT_WRAP_MIN_WIDTH; /* ≥ widest state — stops right-edge jitter */
  white-space: nowrap;
}
.cursor {
  display: inline-block; /* inline ignores width */
  width: CURSOR_WIDTH;
}
```

```js
// Each entry shows from its t until the NEXT entry's t.
// Shape: keystrokes → typo → backspace to the fork → bulk paste → completion mark.
const SEQUENCE = [
  { t: 0.0, text: "" },
  { t: T_K1, text: "{p1}" }, // first keystrokes (~3-5 chars, 0.1-0.2s apart)
  { t: T_K2, text: "{p1 + ' ' + p2_typo}" }, // continuation containing a typo
  { t: T_BS, text: "{p1 + ' ' + p2_partial}" }, // backspace(s) — peel back to the fork
  { t: T_BULK, text: "{fullCorrectedText}" }, // bulk paste — many chars in one jump
  { t: T_DONE, text: "{fullCorrectedText + ' ✓'}" }, // completion marker
];

// Reverse-search for the latest entry whose t has passed
function textAt(time) {
  for (let i = SEQUENCE.length - 1; i >= 0; i--) {
    if (time >= SEQUENCE[i].t) return SEQUENCE[i].text;
  }
  return "";
}

const textEl = document.getElementById("text");
const cursorEl = document.getElementById("cursor");

const driver = { t: 0 };
tl.to(
  driver,
  {
    t: TOTAL_DURATION,
    duration: TOTAL_DURATION,
    ease: "none",
    onUpdate: () => {
      textEl.textContent = textAt(driver.t);
    },
  },
  0,
);

// Cursor blink — deterministic sin square wave, never a CSS animation
const blink = { p: 0 };
tl.to(
  blink,
  {
    p: Math.PI * 2 * BLINK_CYCLES,
    duration: TOTAL_DURATION,
    ease: "none",
    onUpdate: () => {
      cursorEl.style.opacity = Math.sin(blink.p) > 0 ? "1" : "0";
    },
  },
  0,
);
```

## Variations

- **Smooth character slice** (continuous typewriter — no pauses, no edits): faster to author but uniformly "machine-typed", missing the human realism:

```js
const fullText = "{fullPhrase}";
const len = { v: 0 };
tl.to(
  len,
  {
    v: fullText.length,
    duration: TYPE_DUR,
    ease: "power1.inOut",
    onUpdate: () => {
      textEl.textContent = fullText.substring(0, Math.floor(len.v));
    },
  },
  0,
);
```

- **Thinking pause** — hold one state for `THINK_HOLD_DUR` (0.8–2.0s; under 0.5s reads as a stutter, not thought) simply by leaving a gap before the next entry's `t`.
- **State pulse on completion** — when the final state lands, `tl.to(".text", { scale: 1.03–1.08, duration: 0.15–0.3, yoyo: true, repeat: 1 }, T_DONE)`.
- **Per-state color shift** — in `onUpdate`, branch on `driver.t` vs the milestones: success color after `T_DONE`, dim mid-edit, normal while typing.

## Values

| token               | range                                        | notes                                                                  |
| ------------------- | -------------------------------------------- | ---------------------------------------------------------------------- |
| TERMINAL_FONT_SIZE  | 48–96px                                      | full-bleed comps; smaller for terminal-style detail                    |
| TEXT_WRAP_MIN_WIDTH | ≥ widest state                               | measure with a hidden probe after `document.fonts.ready` if unsure     |
| milestone `t`s      | keystrokes 0.06–0.20s apart; pauses 0.3–0.6s | monotonically increasing; `T_DONE ≤ TOTAL_DURATION − ~1s` climax dwell |
| TYPE_DUR (smooth)   | `chars × 0.06–0.12s`                         | fast → relaxed                                                         |
| BLINK_CYCLES        | one cycle per 0.5–0.8s                       | `TOTAL_DURATION / 0.8 ≤ BLINK_CYCLES ≤ TOTAL_DURATION / 0.5`           |
| CURSOR_WIDTH        | ~0.3× font size                              | gap to text single-digit px so the cursor feels attached               |

## Critical Constraints

- **Reverse-search the array each frame** — O(n) with small n (≤30 typical); don't index by frame, the sequence is sparse.
- **`min-width` on the text wrap is mandatory** — without it the right edge jitters as state length changes.
- **Discrete jumps must be INSTANT** — any transition on the text turns the jump into a smear and kills the "typing" feel.
- **Cursor blink is sin/sequence-driven on the timeline**, `display: inline-block`, monospace font, `white-space: nowrap` (wrapping mid-state breaks the illusion; trailing spaces must survive).
- **Discrete vs smooth** — use discrete only for non-linear states (typos, pauses, bulk paste); plain typing takes the smooth-slice variation.

## See also

`context-sensitive-cursor` (same SEQUENCE pattern + segment-colored cursor) · `3d-text-depth-layers` (discrete text with layered depth) · `counting-dynamic-scale` (discrete label beside a smooth counter) · `press-release-spring` (post-completion press beat).
