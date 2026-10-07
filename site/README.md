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

## Docs

`/docs` lives in [`src/app/docs`](src/app/docs): one folder per page, with the sidebar, "On this page" and the previous/next links in its `layout.tsx`.

- **Add a page:** create `src/app/docs/<path>/page.tsx` and add it to `DOCS_NAV` in [`src/components/docs/nav.ts`](src/components/docs/nav.ts). The nav order is also the pager order, and the overview page lists every group from it.
- **Write it** as plain JSX: start with `<DocsHeader>`, then `<p>`, `<ul>`, `<code>` and links, which `.docs-prose` in `globals.css` styles. Use the blocks in [`src/components/docs/prose.tsx`](src/components/docs/prose.tsx) for the rest: `H2`/`H3` (anchored, and listed in "On this page"), `Code`, `Callout`, `Steps`, `Table`, `TermList`, `EndpointList`, `FileTree` and `CardGrid`. Keep blocks as direct children of the page so the spacing rules apply.
- **Style:** no eyebrows, icon lists or gradient text, same as the landing page.
