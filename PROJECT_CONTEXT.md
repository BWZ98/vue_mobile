# Project Context

## Purpose

This repository is a mobile-oriented Vue application centered on two visible domains:

- Todo list management
- Statistics visualization based on mock time-series data

There is also an authentication page backed by mock login/register APIs. It is still not wired to a real backend yet.

## Current Stack

- Vue 3 with `<script setup>`
- TypeScript
- Vite 7
- Vue Router 4
- Pinia 3
- Vant 4
- Axios
- ECharts 6
- `vite-plugin-mock` + `mockjs`
- ESLint + Husky + lint-staged + Commitizen

## How The App Starts

Entry flow:

1. `src/main.ts`
2. `src/App.vue`
3. `src/router/index.ts`
4. Route component under `src/views`

`src/main.ts` creates the Vue app, installs Pinia and Vue Router, then mounts `#app`.

`src/App.vue` is intentionally thin and only renders `<RouterView />`.

## Routes

Defined in `src/router/index.ts`:

- `/` -> `TodoListView`
- `/stats` -> `StatisticsView`
- `/auth` -> `AuthView`

This means the project is effectively organized around route pages rather than a large app shell.

## Directory Map

### `src/views`

Primary page-level features:

- `TodoListView.vue`: todo list page and current home page
- `StatisticsView.vue`: ECharts-based stats page with zoom, long-press, calendar filtering, and timestamp deep-link behavior
- `AuthView.vue`: login/register page wired to mock auth APIs

### `src/components`

Reusable UI units:

- `TodoItem.vue`: single todo rendering and delete interaction
- `SwipeCell.vue`: custom swipe-to-reveal action container

### `src/api`

HTTP wrappers around the Axios instance:

- `auth.ts`
- `todo.ts`
- `stats.ts`

### `src/utils`

- `request.ts`: shared Axios instance and global response handling

### `src/stores`

- `todo.ts`: Pinia store for todo state and CRUD operations

Note: the store exists, but the current `TodoListView.vue` bypasses it and calls the API directly.

### `mock`

Mock backend for local development:

- `mock/index.ts`

Mock routes are only enabled when running the Vite dev server.

## Runtime Behavior

### Todo flow

- `TodoListView.vue` fetches todos on mount
- CRUD actions call `src/api/todo.ts`
- Axios sends requests to `/api/*`
- `vite-plugin-mock` responds from `mock/index.ts`
- UI renders each record through `TodoItem.vue`
- Delete behavior depends on the custom `SwipeCell.vue`

### Statistics flow

- `StatisticsView.vue` loads stats through `getStatsApi('30d')`
- Returned data is grouped into one or more ECharts series
- The page implements custom zoom guardrails, custom axis labels, calendar date selection, and timestamp-based route entry
- Current data is generated entirely from mocks

### Auth flow

- `AuthView.vue` validates fields locally
- Submit actions call `src/api/auth.ts`
- Requests hit mock login/register endpoints in `mock/index.ts`
- Successful responses return a mock token plus basic user info
- There is still no persisted auth state or real backend integration yet

## Styling Direction

Global styling lives in `src/style.css` and provides:

- design tokens via CSS variables
- light/dark mode foundation
- shared container/title helpers

Most page styling is still local to each view component.

The visual direction is modern mobile UI, with gradients, rounded cards, and motion-heavy interactions.

## Local Development

Key scripts from `package.json`:

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run lint`

Vite dev server settings in `vite.config.ts`:

- host enabled
- port `3000`

## Important Observations

### 1. The README is not project-specific

`README.md` is still the default Vite template, so new contributors currently need to read code to understand the app.

### 2. Todo state management is duplicated

There are two todo data paths:

- `src/stores/todo.ts`
- direct API calls inside `src/views/TodoListView.vue`

This is a design inconsistency and will matter if we later add auth, persistence, optimistic updates, or cross-page state sharing.

### 3. The project is mock-first

The current app assumes mock APIs for local behavior. Real backend integration will require:

- API contract definition
- auth state persistence
- error/loading strategy review
- mock/data separation cleanup

### 4. Source files are UTF-8, but some terminals may misrender Chinese text

After checking the repository files directly, the current source files read as valid UTF-8.

The earlier mojibake observed in terminal output appears to be a display-layer issue rather than persisted file corruption.

To reduce future confusion, the repository should keep explicit UTF-8 editor settings and avoid mixed local editor encodings.

### 5. The auth page is now mock-backed but not production-ready

Git status shows active local work related to routing and auth:

- modified: `src/router/index.ts`
- modified: `src/views/TodoListView.vue`
- untracked: `src/views/AuthView.vue`

The auth route, home entry, and auth view are now connected, but the flow still depends on in-memory mock data.

## Recommended Working Model

For collaboration on this repository, it is useful to keep one lightweight context document like this, but not a large always-updated spec.

The most helpful durable notes are:

- project purpose
- route map
- state/data flow
- local run instructions
- known inconsistencies or risks

That is enough to avoid re-learning the project every turn without creating heavy maintenance overhead.

## Good Next Steps

If we continue working on this project, the highest-value follow-ups are likely:

1. Decide whether todo state should live in Pinia or stay page-local
2. Add persisted auth state if the user should remain logged in
3. Replace mock auth endpoints with a real backend contract
4. Separate "demo/mock behavior" from "production-ready architecture"
