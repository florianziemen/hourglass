# AGENTS.md

Static PWA: Vite + Preact + TypeScript. No backend; state persists in `localStorage`.

## Layout

- `src/model.ts` – data types, empty state, id generation.
- `src/logic.ts` – pure state transitions (timer, bookings, compaction, categories,
  settings). Take `now` as a parameter; throw `ValidationError` on invalid input.
- `src/io.ts` – JSON (de)serialisation with strict validation, CSV export.
- `src/storage.ts` – `Store` interface + `WebStorageStore`.
- `src/ui/` – Preact components. `App.update(fn)` applies a transition, compacts,
  saves, and shows errors as a toast.
- `src/sw.js` – service worker template. The `hourglass-sw` plugin in `vite.config.ts`
  fills in a precache list of all build output and a content-hash version, and emits
  `dist/sw.js`. It is cache-first; any change to the build yields a new worker/cache.
  Not used by `npm run dev`. New files in `public/` are precached automatically.
- `scripts/make-icons.mjs` – icons.
- `.github/workflows/pages.yml` – CI: test, lint, format check, build on PRs; on `main`
  also deploys `dist/` to GitHub Pages.
- `test/` – vitest unit tests for logic, io, storage, format.

## Rules

- Keep logic pure and covered by tests; UI only calls `update`.
- Bump `State.version` and add a migration in `parseState` when changing the schema.
- Run `npm test`, `npm run lint`, `npm run format:check`, `npm run build` before commit.
