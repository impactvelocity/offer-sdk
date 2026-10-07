---
workflow: product-launch-video
flow: automation
storyboard: no
message: "Pricing changes shouldn't need a pull request"
destination: youtube
aspect: 1920x1080
language: en
audience: "Solo founders and small SaaS teams who hardcoded plans at launch and now drown in custom deals"
length: 190s
angle: problem-solution walkthrough
vo_mode: verbatim
---

## Intent

A ~3 minute product walkthrough for Offer SDK. Problem first (every yes becomes spaghetti code and a deploy),
then the turn (plans, access and promotions come out of your code), then a tour of the admin app that SHOWS
each piece rather than telling: plans, entitlements, usage-based pricing for agents (402 + upgrade offer),
add-ons, incentives, plan checkout, offers, the Offer Agent + cancel flow (Tom), dashboard + MCP, React SDK +
agent skill, Zapier/webhooks, and the offersdk.com CTA. Calm, confident, polished; no hype voice.

User, verbatim: "I also want the parts that would show the app to use the app UI, so it looks and feels like
the app, so people can see it — a lot of it can be animated / version of it, so not always exactly but I want
it to not feel like it doesn't show vs. just telling."

## Assets

- ../../brag-output/vo-script.md — the final VO script, verbatim. Narration is NOT generated: the user records VO later.
- ../../site/ — landing page (localhost:6769): hero, problems (billing.ts before/after), use-cases, story, agent churn demo.
- ../../offer-app/ — the admin dashboard (localhost:6768): every app-tour beat must look like these screens.

## Customizations

- App-tour beats are animated recreations of the real offer-app screens (same tokens, type, layout, components), with simulated clicks/typing.
- Soft music bed under where the VO will sit; quiet UI sounds.

## Notes

- Voiceover comes later: time every frame to the script at ~150 wpm (best guess) and render without narration.
- Every claim must match what ships; no invented numbers or testimonials.
- Design system: dark canvas, violet accent, violet→pink gradient primary buttons, Cal Sans display.
