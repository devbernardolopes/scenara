# Scenara — Agent Guide

Architecture decisions, conventions, and constraints for human and AI-agent maintainers.

## Stack

- **Vite + React** (JavaScript, not TypeScript)
- **Tailwind CSS v4** (mobile-first, Vite plugin, no PostCSS config)
- **React Router v7+** (nested routes with `<Outlet />`)
- **Dexie.js** (IndexedDB wrapper, client-side persistence — the only backend)
- **i18next + react-i18next** (localization, EFIGS + pt-BR, namespace-based JSON files)
- **@huggingface/transformers** (in-browser local inference, runs in a Web Worker — see AI Request Pipeline)
- **gpt-tokenizer** (client-side token estimation for context budgeting)
- **react-markdown + remark-gfm + rehype-sanitize** (message rendering)
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
- Modals are wrapped in `<Suspense>` by the provider. Heavy modals (like Settings) can be `lazy()` imported and automatically code-split — see `main.jsx` for the pattern.
- Passing `{ modalSize: 'lg' }` to `openModal()` renders the modal at `max-w-4xl` instead of `max-w-lg`.
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
- Schema (version 14):

| Table                 | Primary Key | Indexes                                                                                    |
| --------------------- | ----------- | ------------------------------------------------------------------------------------------ |
| `threads`             | `++id`      | `title`, `characterId`, `personaId`, `updatedAt`, `isFavorite`, `isLocked`, `threadNumber` |
| `characters`          | `++id`      | `name`, `createdAt`, `updatedAt`, `characterNumber`, `*tags`                               |
| `personas`            | `++id`      | `name`, `title`, `createdAt`, `isDefault`                                                  |
| `settings`            | `++id`      | `key`                                                                                      |
| `uiState`             | `++id`      | `key`                                                                                      |
| `messages`            | `++id`      | `threadId`, `role`, `personaId`, `createdAt`, `summarizedAt`                               |
| `writingInstructions` | `++id`      | `name`, `createdAt`                                                                        |
| `connectionProfiles`  | `++id`      | `name`, `createdAt`                                                                        |
| `inChatShortcuts`     | `++id`      | `name`, `createdAt`                                                                        |
| `promptHistory`       | `++id`      | `threadId`, `createdAt`                                                                    |
| `tags`                | `++id`      | `&name`, `createdAt`                                                                       |
| `threadMemories`      | `++id`      | `threadId`, `createdAt`                                                                    |

- **`settings`** — user preferences (theme, language, API config). Persistent, import/exportable.
- **`uiState`** — transient UI state (collapse/expand, scroll positions). Never exported. Queried via `src/services/uiState.js`.
- **`threadMemories`** — durable per-thread memory entries produced by summarization, re-injected into future prompts (see AI Request Pipeline below).
- Summary/auto-title checkpoints are stored as empty marker messages (`isSummaryMarker` / `isAutoTitleMarker` flags on a `role: 'system'` row, `messages.summarizedAt`) rather than a separate table — filter them out when counting real messages (see `getThreadMessageCounts` in `services/messages.js`).

No business logic in `db.js` — just table definitions. Query/mutate from `services/`.

**Migrating the schema:** add a new `db.version(N).stores({...})` block with the _entire_ table set (Dexie requires the full schema per version, not a diff), rather than editing an existing version in place.

## AI Request Pipeline

This is the core of the app and the most active area of development — read this before touching anything related to sending a message, providers, or prompts.

### Three-layer API configuration

1. **Providers & keys** (`src/services/apiProviders.js`) — `PROVIDERS` is a declarative array (like `SETTINGS`): each entry declares `id`, auth needs (`needsKey`/`needsUrl`), whether it exposes a `/models` endpoint, and a `params` schema (key, label, type, min/max/step, default) describing that provider's sampling parameters. Multiple named API keys per provider are supported and stored here. **To add a provider:** add one object to `PROVIDERS`, plus a matching entry in `modelFetcher.js`'s `STRATEGIES` if it needs model listing.
2. **Connection profiles** (`src/services/connectionProfiles.js`) — a saved, named bundle of `{ providerId, keyId, model, params }`. Users create as many profiles as they want (e.g. "Groq — creative", "LM Studio — fast draft").
3. **Request kinds** (`REQUEST_KINDS` in `connectionProfiles.js`: `chat`, `autoTitle`, `summarization`, `ooc`, `director`, `interface`) — each kind can be pointed at a different connection profile, so e.g. auto-titling can run on a cheap/local model while chat uses a stronger one. **To add a request kind:** add its id to `REQUEST_KINDS` and give it a profile picker in the relevant settings panel.

### Sending a request

- `src/services/chatGeneration.js` — orchestration layer that both `doChatRequest` and `handleRegenerate` call. Resolves the connection profile, builds the payload via `chatApi.js`, calls `sendChatCompletion`, optionally runs the Director review pass, trims the result, and returns a typed outcome (`'no-profile' | 'empty' | 'success' | 'error'`). AbortErrors re-throw so callers can distinguish cancellation from failure. Exported pure utilities `parseBundleEntries` and `computeMessageFlags` also live here.
- `src/services/chatApi.js` — builds the outgoing payload (`buildMessagesPayload`, `buildChatRequestPayload`), does `{{char}}`/`{{user}}`/`{{name}}` template substitution (`replaceVars`), and sends it (`sendChatCompletion`). Provider quirks (e.g. `max_completion_tokens` vs `max_tokens`, stripping zero-value params) are handled here — always use `null`/`undefined`, never `0`, as the "omit this param" signal.
- `src/services/apiQueue.js` — single request queue per app (not per thread): enforces cooldown/timeout, tracks streaming state, and supports cancellation (`cancelRequest`, `cancelThreadRequests`). Any new code path that hits an LLM provider must go through this queue, not `fetch` directly.
- `src/services/director.js` — an optional secondary pass that reviews/rewrites a response using the character's own instructions. Its `applyDirectorTemplate` implements the shared `{{message}}` / `{{char}}` / `{{user}}` / `{{writing_instructions}}` template-variable syntax reused by auto-titling and summarization prompts — extend this function, not a new templating scheme, when a new template variable is needed.
- `src/services/summarization.js` + `threadMemories.js` — condense older messages into a `threadMemories` entry that's re-injected into future prompts once a thread grows long, so context stays bounded.
- `src/services/autoTitle.js` / `titleManager.js` — generate a thread title after the first exchange, either via the active provider or the local in-browser model.

### Local (on-device) inference

`src/lib/inferenceClient.js` talks to `src/workers/inference.worker.js`, which runs `@huggingface/transformers` inside a Web Worker so a small model can run fully offline (currently used for auto-titling). Model load/unload and idle-unload timing live in the worker — don't block the main thread with transformer calls.

## Folder Structure

```plaintext
src/
  components/
    shared/       — CollapsibleSection, future reusable primitives
    shell/        — ShellLayout, Sidebar, TopBar
    modals/
      settings/   — feature subfolder for modals with multiple sub-components (SettingsSidebar, SettingRow, controls)
      character/  — feature subfolder for character creation sub-panels (CharacterSection, CharacterSidebar, etc.)
      *.jsx       — flat modal components, one file per modal
  pages/          — CharacterDiscovery, ChatView (route-level, no business logic)
  lib/            — shared utilities: modal context, i18n init, icons, toast, confirm, download. No JSX components with state.
  services/       — one file per domain concern: chat API calls, message CRUD, settings, threads, characters, personas, etc. No business logic outside this folder.
  hooks/          — React hooks (useModal, useTheme, useLocale, usePersistedState).
  locales/
    en/           — common.json, chat.json, settings.json, characterCreation.json
    pt-BR/        — same namespaces (EFIGS + pt-BR supported)
    fr/, it/, de/, es/
  styles/         — tokens.css (design tokens, themes, utility classes)
  db.js           — Dexie database setup
  App.jsx         — route definitions
  main.jsx        — entry point, provider wiring, modal registration
```

## Design Tokens

All visual properties are defined as CSS custom properties in `src/styles/tokens.css` — a single source of truth for every theme. **Never hardcode color values in JSX** — use the utility classes below instead.

### Available utility classes

| Token                     | Utility class                     |
| ------------------------- | --------------------------------- |
| Primary background        | `bg-primary`                      |
| Primary hover             | `hover:bg-primary-hover`          |
| Primary subtle bg         | `bg-primary-subtle`               |
| Primary text              | `text-primary`                    |
| Text on primary bg        | `text-on-primary`                 |
| Surface background        | `bg-surface`                      |
| Surface secondary bg      | `bg-surface-secondary`            |
| Surface hover             | `hover:bg-surface-hover`          |
| Primary text              | `text-text`                       |
| Secondary text            | `text-secondary`                  |
| Tertiary text             | `text-tertiary`                   |
| Default border            | `border-border`                   |
| Light border              | `border-border-light`             |
| Backdrop overlay          | `bg-overlay`                      |
| Success / Warning / Error | `text-success`, `bg-warning` etc. |
| Accent                    | `text-accent`, `bg-accent`        |
| Theme-aware shadows       | `shadow-surface-sm/md/lg`         |

Spacing, typography, and radius use Tailwind's built-in classes (`p-4`, `text-sm`, `rounded-lg`). Do not create custom tokens for these.

### Adding a new token

1. Add `--token-name` to each `.theme-*` block in `tokens.css`
2. Add a matching utility class in the utility classes section
3. Use `className="utility-name"` in components

## Localization

All UI strings live in `src/locales/{lang}/{namespace}.json`. Each language has the same set of namespaces:

| Namespace           | Scope                                                   |
| ------------------- | ------------------------------------------------------- |
| `common`            | Sidebar, TopBar, Discovery, modals, shared labels       |
| `settings`          | Settings modal, categories, setting labels/descriptions |
| `chat`              | Chat view, message UI                                   |
| `characterCreation` | Character and persona creation forms                    |

**Usage in components:**

```jsx
import { useTranslation } from 'react-i18next'

function MyComponent() {
  const { t } = useTranslation('common')
  return <h1>{t('discovery.title')}</h1>
}
```

The namespace prefix (`:`) syntax references other namespaces from any component:

```js
t('settings:appearance.theme.label')
```

## Settings System

Settings are defined declaratively in `src/services/settings.js`:

- **`CATEGORIES`** — array of `{ id, labelKey }` that drives the settings sidebar
- **`SETTINGS`** — array of `{ key, category, type, default, options?, labelKey, descKey, optionLabels?, props? }` that drives the content panel
- **`getSetting(key)`** — reads from Dexie, falls back to the config default
- **`setSetting(key, value)`** — persists to Dexie, then runs the effect from `SETTING_EFFECTS` if one is registered
- **`SETTING_EFFECTS`** — map of `{ key: (value) => void }` for side effects (theme class, i18n changeLanguage, etc.). Adding a new effect is one line.

Effects ensure that persistence and application are always paired — whether the change comes from the settings modal UI or from a hook.

The settings modal (`components/modals/settings/`) renders from these config arrays — no JSX duplication per setting. The control type is driven by `setting.type`:

| `type`     | Component         | Props passthrough                               |
| ---------- | ----------------- | ----------------------------------------------- |
| `select`   | `SettingSelect`   | `options`, `optionLabels`                       |
| `toggle`   | `SettingToggle`   | —                                               |
| `slider`   | `SettingSlider`   | `min`, `max`, `step`                            |
| `text`     | `SettingInput`    | `placeholder`, `type`                           |
| `textarea` | `SettingTextarea` | `rows`, `placeholder`, `collapsible`, `summary` |

The `props` field on a setting config is spread onto the control component. This keeps controls generic and the config declarative.

To add a new setting: add one object to the `SETTINGS` array. The modal renders it automatically.

All tappable controls enforce a minimum `44px` hit target as per mobile accessibility guidelines.

Settings are code-split: `SettingsModal` uses `React.lazy()` and is bundled separately. The `ModalProvider` wraps it in `<Suspense>` with a loading fallback.

## Conventions

- **Small files.** ~200-250 lines max per component. Decompose beyond that.
- **No business logic in UI.** Chat logic, API calls, summarization belong in `services/` — never in a React component.
- **Mobile-first.** Write the unprefixed Tailwind class for mobile layout first, then `md:` / `lg:` overrides for larger screens — never the reverse.
- **No state management library.** Use React built-ins (`useState`, `useContext`) + Dexie for persistence. Revisit only if genuinely needed.
- **Imports:** Use relative imports within `src/`. No barrel files (`index.js`) — import directly from the file.
- **No JSX in `lib/` or `services/`.** Keep non-UI modules free of React.

## UI State Persistence

Transient UI state (collapse/expand, scroll positions) lives in the `uiState` Dexie table — separate from user preferences.

- **`src/services/uiState.js`** exports `getUIState(key)` and `setUIState(key, value)` — identical API to settings but backed by a dedicated table.
- Storage keys follow a convention: `collapsed.{settingKey}`, `scroll.{panelId}`, etc.
- This table is never exported / imported / cleared by user-facing operations.

### CollapsibleSection

`src/components/shared/CollapsibleSection.jsx` is a reusable wrapper that any component can use:

```jsx
<CollapsibleSection
  label="System Prompt"
  summary="64 tokens"
  hasContent={true}
  storageKey="systemPrompt"
  defaultExpanded={true}
>
  <textarea ... />
</CollapsibleSection>
```

- Label highlights in `text-primary` when `hasContent` is true
- Summary shows computed metrics (tokens, words, characters) or custom text
- Collapse state persisted per-instance via `storageKey` → `uiState` table
- All touch targets are `min-h-[44px]`

### Adding a new collapsible control

1. Create the control component wrapping `CollapsibleSection`
2. Add it to the `CONTROL_MAP` in `SettingRow.jsx`
3. The `storageKey` is automatically set to `setting.key` by `SettingRow`

## Commit Convention

When there are changes to commit, AI agents should suggest an one-line commit message at the end of their response following conventional commit format: `type(scope): description`. Use types like `feat`, `fix`, `refactor`, `docs`, `chore` and keep descriptions concise but descriptive — focus on the "why" rather than the "what".
