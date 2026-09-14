# AGENTS.md — Frontend

## Structure
Feature-based, not type-based. `src/pages/<Page>/` owns its own `components/` and `hooks/` used only by that page. Promote to top-level `src/components/` or `src/hooks/` only when used by 2+ pages.

```
src/
├── app/           # router, providers, App.tsx
├── pages/         # one folder per route
├── components/    # shared, dumb, reusable UI (Button, Modal, AppShell, Badge)
├── hooks/         # cross-cutting hooks (useLocalStorage, useSSE, useDeviceIdentity)
├── lib/           # API client, SSE client, storage helpers, locales
├── types/         # shared TS types
├── config/        # static config
└── styles/
    └── tokens.css # all colors/spacing/fonts as CSS custom properties
```

## Rules
- **Styling:** CSS Modules only (`*.module.css`). No inline CSS. Never hardcode colors/spacing — always reference `var(--...)` from `styles/tokens.css`.
- **Shared UI before feature UI:** if something like a modal, button, or nav bar is needed, check `src/components/` first. Build/extend the shared version instead of a page-local copy. Do not duplicate the app shell (nav + ticker) per page — one `AppShell` component, reused everywhere.
- **Pages are thin:** pages fetch data and compose components. Shared components (`src/components/`) take props only — no data-fetching, no business logic inside them.
- **Data fetching:** use TanStack Query for REST/session/match data. Local UI state (modal open, selection before confirm) uses plain `useState`/`useReducer`. No Redux/Zustand unless explicitly agreed first.
- **Routing:** React Router.
- **Before adding a new component:** search the codebase for an existing one that does the same job. Extending > duplicating.
- **Tone/copy:** no marketing language anywhere in the UI. Plain, functional text only.
- **i18n:** all user-facing strings go through the i18n layer (e.g. react-i18next) — never hardcode text in components. Locales: en-US, pt-BR. Keys organized per page/feature (home.create_session.title, match_broadcast.play_by_play.title), not one flat file. New copy must be added to both locale files in the same change — no English-only strings left behind. Use snake case for the keys.