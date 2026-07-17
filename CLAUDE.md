# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`timesheeter` is an Electron desktop app (Electron Forge + Webpack + TypeScript + React 19) for recording time entries against Dynamics 365 Project Operations projects/tasks, then uploading them. The app is early-stage/WIP — several renderer components are stub placeholders (`recordentry.tsx`, `combobox.tsx`, `editingdayslist.tsx`, `editingday.tsx` currently just render placeholder text).

## Commands

- `npm start` — run the app in development (Electron Forge + Webpack dev flow, includes hot reload and DevTools opened automatically).
- `npm run package` — package the app without creating installers.
- `npm run make` — build distributable installers (Squirrel for Windows, ZIP for macOS, deb/rpm for Linux).
- `npm run lint` — run ESLint over `.ts`/`.tsx` files.

There is no test suite configured in this repo (no test runner in `package.json`).

## Architecture

This is a standard Electron main/renderer split, wired together with Electron Forge's Webpack plugin (config in `forge.config.ts`, `webpack.main.config.ts`, `webpack.renderer.config.ts`, `webpack.rules.ts`, `webpack.plugins.ts`).

### Main process (`src/index.ts`)

- Bootstraps `MyDynamicsWebApi`, `UserService`, `ProjectService`, and `RecordedDataService`, then creates the `BrowserWindow`.
- On window creation, calls `userService.getLoggedInUser()` and pushes the result to the renderer over the `authenticated` IPC channel — the renderer has no "logged in" state until this arrives (login itself happens as a side effect of the first Dynamics API call, see below).
- Registers IPC handlers (`ipcMain.handle`) for `get-all-projects`, `get-tasks-for-project`, `get-all-recorded-data`, `save-recorded-data`. Any new main-process capability the renderer needs must be added here as an `ipcMain.handle`, exposed through `src/preload.ts`, and typed in `src/mainprocess.d.ts` (`IMainProcessAPI`) — all three need to stay in sync.

### Preload / IPC bridge

- `src/preload.ts` exposes `window.mainProcess` via `contextBridge`, implementing `IMainProcessAPI`.
- `src/mainprocess.d.ts` declares `IMainProcessAPI` and augments the global `Window` interface — this is the contract the renderer codes against.
- `src/ipctypes.ts` holds shared types crossing the IPC boundary (e.g. `LoggedInAccount`).

### Auth + Dynamics 365 integration (`src/auth/`)

- `authConfig.ts` hardcodes the MSAL client ID, tenant authority, and the Dynamics 365 org URL (`dynamicsResource`) this app talks to (truenorthit.crm11.dynamics.com).
- `dynamicswebapiconnection.ts` defines `MyDynamicsWebApi` (extends `DynamicsWebApi` from the `dynamics-web-api` package) wired to an MSAL `PublicClientApplication`. Token acquisition (`acquireTokenFactory`) tries `acquireTokenSilent` first using a cached `AccountInfo`, falling back to `acquireTokenInteractive`, which opens the system browser (`shell.openExternal`) for the login flow — there's no in-app login window. Login is lazy: it happens the first time a Dynamics Web API call needs a token, not proactively at app startup.

### Services (`src/services/`)

- `userservice.ts` — fetches the current Dynamics `systemuser` via FetchXML (`eq-userid` operator resolves to whoever is authenticated).
- `projectservice.ts` — reads `msdyn_projects` / `msdyn_projecttasks` (active records only, `statecode eq 0`) from Dynamics.
- `recordeddataservice.ts` — persists recorded time entries as local JSON files under `<userData>/recorded/YYYY-MM-DD.json` (one file per day), keyed in memory by date string. Loads all existing files into memory once at construction (`this.recordedData` is a cached `Promise`), then reads/writes through that cache. This is local-only storage; nothing here syncs to Dynamics — that upload path is not yet implemented (see `EditingDaysList`/`EditingDay` stubs).

### Renderer (React)

- `renderer.ts` is the Webpack entry point; it imports `index.css` (Tailwind) and `app.tsx`.
- `app.tsx` renders a login gate: shows `Home` once `window.mainProcess.onAuthenticated` has fired, otherwise a message telling the user to complete login in the externally-launched browser tab.
- `home.tsx` is a simple internal router driven by local `useState`, switching between `Recording`, `EditingDaysList`, and the default menu — there is no routing library.
- `recording.tsx` implements the time-recording flow: loads today's existing entries via `getAllRecordedData`, validates new entries for overlap against existing ones, then saves via `saveRecordedData`.
- `verticalcontent.tsx` is a shared layout wrapper (flex column) used across screens; styling uses Tailwind utility classes.

## Notes / gotchas

- `tailwind.config.js` content glob currently targets `./src/renderer/**/*` — but source files live directly under `src/`, not `src/renderer/`. Be aware of this mismatch if Tailwind classes don't seem to apply to a new component.
- Dates in `RecordedTimeEntry` are plain `Date` objects serialized to/from JSON — the file-based `RecordedDataService` round-trips them through `JSON.stringify`/`JSON.parse` without a reviver, so values read back from disk are strings even though the TypeScript type says `Date`.
