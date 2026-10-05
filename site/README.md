# site

Landing page for Offer SDK. Dark-only, and shares offer-app's dark design tokens and Cal Sans so the site and the dashboard look like one product. "Sign in" / "Get started" link to `NEXT_PUBLIC_APP_URL` (the deployed `offer-app`).

```bash
pnpm dev:site   # http://localhost:6769
```

## Design system

- **Tokens:** [`src/app/globals.css`](src/app/globals.css) uses the same names and values as the `[data-theme="dark"]` block in [`offer-app/src/app/globals.css`](../offer-app/src/app/globals.css). If you change a color in one, change it in the other.
- **Surfaces:** the page sits on `bg-canvas`, cards on `bg-bg` / `bg-panel`, all with hairline `border-border`.
- **Type:** Cal Sans. Body and UI text use the "UI" geometry. Headlines use `font-display` with the `text-4xl`–`text-6xl` display sizes, which only the site has. Long body copy uses `text-fg-muted`.
- **Color:** violet `accent` for links and focus. The violet→pink brand gradient is the pop of color: `bg-brand-vertical` on primary buttons, plus `text-brand`, `bg-brand-glow` and `bg-brand-soft`.
- **Components:** `src/components/ui` holds the button (`buttonVariants` in `button-variants.ts`, callable from server components), the badge, `IconTile`, `Eyebrow` and `CodeBlock`, matching offer-app's versions. Use tokens only, never raw hex.
