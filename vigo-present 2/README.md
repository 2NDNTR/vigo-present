# Vigo Present

A presentation **design system** disguised as an extremely simple presentation builder,
for Vigo Importing Company / Vigo Foods / Alessi Foods.

The brand team controls the system. The employee controls the content. The platform
controls the design.

---

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

## Deploy it

Push this folder to a Git repo and import it at vercel.com, or:

```bash
npx vercel --prod
```

No environment variables are required. Presentations are stored in the browser
until you add a database.

### Turning on the shared backend

Add one environment variable in Vercel:

```
DATABASE_URL = postgres://...      # Neon, Supabase, RDS, anything Postgres
```

On the next request the app switches from browser-local storage to the shared
Postgres backend automatically (`lib/store/index.ts` decides by pinging
`/api/health`). Tables are created on first use. From then on:

- everyone in the org sees the same dashboard
- `/p/<slug>` share links work for recipients on any device
- publishing state is enforced server side

Nothing else in the codebase changes.

---

## Architecture

```
Brand  ->  Design Tokens  ->  Components  ->  Page Templates
       ->  Presentation Templates  ->  Presentation  ->  Published Web Experience
```

| Layer | Where | What it owns |
|---|---|---|
| Brand themes | `lib/brand/themes.ts` | colour, type scale, logo, rules per brand |
| Data model | `lib/model/types.ts` | Presentation → Page → Slots → Blocks |
| Page templates | `lib/templates/registry.ts` | 37 designed layouts, grid + typed slots |
| Deck templates | `lib/templates/starters.ts` | Retail / Recap / Brand starter decks |
| Renderer | `components/render/Stage.tsx` | one renderer for editor, preview and live site |
| Editor | `components/editor/*` | navigator, canvas, contextual panel |
| Presentation | `components/present/Presenter.tsx` | scroll + slide modes, responsive |
| Guardrails | `lib/guardrails.ts` | the silent creative director |
| Storage | `lib/store/*` | local driver + Postgres driver, one interface |

### The two principles everything else follows

**1. Presentations are structured data, never HTML.**
A page stores a template id, a background, and typed blocks in named slots. It
never stores a font size, a hex value or a pixel position. Change
`lib/brand/themes.ts` and all 200 existing decks re-render with the new system.

**2. Users choose roles, not values.**
"Headline", "Metric XL", "Brand Primary" — the theme decides what those mean.
There is no font size input and no colour picker anywhere in the product.

### Replacing the placeholders

| Placeholder | File |
|---|---|
| Brand colours, fonts, type scale, logo wordmarks | `lib/brand/themes.ts` |
| Photography / asset library | `lib/assets/placeholders.ts` → point `assetLibrary()` at real URLs |

---

## Portable build

`node build-standalone.js` compiles the same components into a single
self-contained `dist/index.html` with no build step and no dependencies — useful
for reviewing the product without deploying it.
