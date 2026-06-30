# Scenara — Agent Guide

Architecture decisions, conventions, and constraints for human and AI-agent maintainers.

## Stack

- **Vite + React** (JavaScript, not TypeScript)
- **Tailwind CSS v4** (mobile-first, Vite plugin, no PostCSS config)
- **React Router v7+** (nested routes with `<Outlet />`)
- **Dexie.js** (IndexedDB wrapper, client-side persistence)
- **ESLint** (flat config) + **Prettier** + **oxlint**
- Deployment: **Vercel** (SPA rewrites in `vercel.json`)

## Architecture

### Persistent Shell + Swappable Content

A persistent shell renders at all times with nested routes:

- `src/components/shell/ShellLayout.jsx` — flex layout: sidebar + top bar + `<Outlet />`
- `src/pages/` — route-level components rendered inside the shell's `<Outlet />`
- Routes:
  - `/` → `CharacterDiscovery` — browse/select characters to start a chat
  - `/chat/:threadId` → `ChatView` — active chat for a specific thread

### Modal System (not routes)

Settings, character creation, and persona management open as **overlays** — not separate routes — so chat state stays alive underneath.

- `src/lib/modal.jsx` exports:
  - `ModalContext` — React context holding `openModal`, `closeModal`, `activeModal`, `modalProps`
  - `ModalProvider` — wraps the app, renders the active modal as a portal overlay (click-outside-to-close)
  - `registerModal(type, Component)` — registers a component for a given modal key
- `src/hooks/useModal.js` — `useModal()` returns `{ openModal, closeModal, activeModal }`
- Modals are registered in `src/main.jsx` to keep registration visible in one place:

```js
registerModal('settings', SettingsModal)
registerModal('characterCreate', CharacterCreateModal)
registerModal('personaEditor', PersonaEditorModal)
```

**To add a new modal:**

1. Create the component in `src/components/modals/`
2. Import and call `registerModal('myType', MyModal)` in `main.jsx`
3. Trigger with `openModal('myType', { optionalProps })`

### Local-First Persistence

All data lives in the browser via IndexedDB. Dexie.js is the only persistence layer — no backend.

- `src/db.js` — single `new Dexie('scenara')` instance
- Schema (version 1):

| Table        | Primary Key | Indexes                             |
|--------------|-------------|-------------------------------------|
| `threads`    | `++id`      | `title`, `characterId`, `updatedAt` |
| `characters` | `++id`      | `name`, `createdAt`                 |
| `personas`   | `++id`      | `name`, `createdAt`                 |
| `settings`   | `++id`      | `key`                               |

No business logic in `db.js` — just table definitions. Query/mutate from `services/`.

## Folder Structure

```plaintext
src/
  components/
    shell/        — ShellLayout, Sidebar, TopBar
    modals/       — SettingsModal, CharacterCreateModal, PersonaEditorModal
  pages/          — CharacterDiscovery, ChatView (route-level, no business logic)
  lib/            — modal system, future utilities (no React components, just context/tools)
  services/       — chat logic, AI provider calls, summarization (pure functions, no JSX)
  hooks/          — useModal, future shared React hooks
  db.js           — Dexie database setup
  App.jsx         — route definitions
  main.jsx        — entry point, provider wiring, modal registration
```

## Conventions

- **Small files.** ~200-250 lines max per component. Decompose beyond that.
- **No business logic in UI.** Chat logic, API calls, summarization belong in `services/` — never in a React component.
- **Mobile-first.** Write the unprefixed Tailwind class for mobile layout first, then `md:` / `lg:` overrides for larger screens — never the reverse.
- **No state management library.** Use React built-ins (`useState`, `useContext`) + Dexie for persistence. Revisit only if genuinely needed.
- **Imports:** Use relative imports within `src/`. No barrel files (`index.js`) — import directly from the file.
- **No JSX in `lib/` or `services/`.** Keep non-UI modules free of React.

## Modal Registration Pattern

Modals are registered at the entry point (`main.jsx`), not auto-discovered. This ensures:

1. All modals are visible in one place (easy to audit)
2. Lazy-loading is straightforward to add later (dynamic `registerModal` call)
3. Tree-shaking works — unused modals don't need importing

To add a new modal:

```js
// 1. Create component
function MyModal() {
  const { closeModal } = useModal()
  return <div>...</div>
}

// 2. Register in main.jsx
import MyModal from './components/modals/MyModal'
registerModal('myModal', MyModal)

// 3. Trigger from any component
const { openModal } = useModal()
openModal('myModal', { someProp: value })
```

## Commit Convention

When there are changes to commit, AI agents should suggest a commit message at the end of their response following conventional commit format: `type(scope): description`. Use types like `feat`, `fix`, `refactor`, `docs`, `chore` and keep descriptions concise but descriptive — focus on the "why" rather than the "what".

## Deployment

`vercel.json` rewrites all routes to `/index.html` for SPA client-side routing:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

Build command: `npm run build` → outputs to `dist/`.
