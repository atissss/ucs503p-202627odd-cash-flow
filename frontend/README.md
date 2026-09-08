# Intrinsic — Frontend

React + Vite + TypeScript + Tailwind CSS v4. This is the UI for the Intrinsic
DCF valuation platform.

## Commands

```bash
npm install
npm run dev      # dev server with HMR → http://localhost:5173
npm run build    # type-check + production build to dist/
npm run lint     # oxlint
npm run preview  # preview the production build
```

The dev server proxies `/api/*` to the FastAPI backend on `:8000`
(see `vite.config.ts`).

## Key files

- `src/domain/scenario.ts` — the shared data model (source of truth; mirrored in
  `backend/app/models.py`).
- `src/App.tsx` — the app shell.
- `src/index.css` — Tailwind entry + design tokens (`@theme`).

See [`../DEVELOPMENT.md`](../DEVELOPMENT.md) for the full setup and the agreed
data-model / status conventions.
