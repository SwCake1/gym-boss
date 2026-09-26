# GYM BOSS: agent guide

## Project layout

- This directory (`site/`) is the Git repository. Run Git commands here, not in its parent directory.
- `dist/` is the published static site. There is no build step or package manager.
- `dist/engine.mjs` owns game rules, state validation, purchases, and combat. `dist/app.mjs` owns DOM rendering, input, timers, browser storage, and sound.
- `dist/towel.mjs` is the towel-toss side job: a DOM-free cloth simulation (tested in Node) plus a canvas renderer mounted by `app.mjs`. Payout rules stay in `engine.mjs` (`work`).
- `tests/engine.test.mjs` covers the game engine; `tests/towel.test.mjs` checks that every towel layout is solvable and the cloth stays stable. Progress and an active fight are saved in browser `localStorage`.

## Before editing

1. Check `git status --short --branch`, `git remote -v`, and the relevant files. Preserve unrelated work and untracked files.
2. Keep rule changes in the engine and UI changes in the app. Reuse the existing state helpers and render functions before adding another copy of the same logic.
3. The game is still in development and has not had a full release. Breaking changes to existing browser saves are acceptable; do not add migrations or compatibility handling just to preserve old saves. Keep gameplay balance unless the task explicitly changes it.

## Verification

Run from this directory:

```sh
node --check dist/app.mjs
node --check dist/engine.mjs
node tests/engine.test.mjs
node tests/towel.test.mjs
git diff --check
```

For interaction changes, serve `dist/` locally and check the affected flow in a browser. Test training, recovery, the shop, combat, persistence, or new-game reset when the change touches those paths. Existing browser saves are disposable during development; no separate origin or profile is required to protect them.

## Sites publication

- Read `.openai/hosting.json` for the existing Sites `project_id` and static directory. Reuse this project; do not create a replacement site.
- The local checkout may have no Git remote. Get the source repository URL, branch, and a short-lived write credential from Sites when a push is requested. Never print, save, or commit the token.
- Commit only intended files, push the exact commit to the Sites source branch, then save a version from that pushed SHA and deploy it when publication is requested. Preserve the site's current access audience and verify deployment status and URL before reporting success.
- Keep source push, saved version, and live deployment as separate states in the final report.
