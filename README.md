# Scenara

Privacy-first, open-source AI roleplay / character chat platform. Client-side only — all data stored locally in IndexedDB.

## Quick Start

```bash
npm install
npm run dev       # → http://localhost:5173
```

## Scripts

| Command           | Description                        |
| ----------------- | ---------------------------------- |
| `npm run dev`     | Start dev server (HMR)             |
| `npm run build`   | Production build to `dist/`        |
| `npm run preview` | Preview production build locally   |
| `npm run lint`    | Run oxlint                         |
| `npm run format`  | Format all source files            |

## Deployment

```bash
npm run build
npx vercel deploy --prod
```

See `AGENTS.md` for architecture documentation and contributor conventions.
