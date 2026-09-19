# 🗾 Asia 2026 Family Challenge

Japan & South Korea — Ross Family, 16–31 October 2026.

A phone-first web game that turns the trip itinerary into a level map. Each stop
is a mission: take an arrival photo, complete your own scavenger-hunt photos,
beat one of five arcade games, and clear the boss quiz — then submit it for
approval. The admin login approves missions, awards bonus points and hands out
chips.

Built on the same engine as the Route 66 Family Challenge, re-themed for Japan
and Korea: white and Japanese-blue, with a neon skyline behind everything.

## Files
| File | What it is |
|---|---|
| `index.html` | App shell, login, mascot |
| `stops.js` | All 43 stops — facts, hunt items, games, quizzes |
| `app.js` | Game engine, arcade, admin, sync |
| `styles.css` | Neon Tokyo/Seoul theme |
| `service-worker.js` | Offline cache |

## Backend
Unchanged from the Route 66 build — same Google Apps Script `/exec` endpoint,
same spreadsheet, same admin password. Nothing to redeploy.

## Logins
Same as before: Jacob, Lily, Hannah, Ethan, admin — or type `test` with no
password to preview with every stop unlocked.

## Publishing
Live at **https://ross.asia** (GitHub Pages, `main` / root).

The `CNAME` file in this repo sets the custom domain — leave it in place, or
Pages reverts to `wame11.github.io/rossasia/`.

DNS at GoDaddy: four `A` records on `@` → `185.199.108.153`, `185.199.109.153`,
`185.199.110.153`, `185.199.111.153`, plus a `CNAME` on `www` → `wame11.github.io`.

## Deploying a change

Every asset is stamped with a build id so nobody can get a half-updated app.

1. Pick a new build id, e.g. `2026-09-20-1`.
2. Put it in **three** places: `version.json`, the `BUILD` constant at the top of
   `service-worker.js`, and the `?v=` / `window.__BUILD__` values in `index.html`.
3. Commit and push. That is it.

How it heals itself:

- `version.json` is fetched with `no-store` on load and whenever the app is
  brought back to the foreground. If the deployed build differs from the running
  one, the app clears every cache, unregisters the worker and reloads **once**
  (guarded by a per-build session flag, so it cannot loop).
- The service worker sends navigations to the network with `cache: 'no-store'`,
  so an online device can never be served yesterday's `index.html`.
- `?v=<build>` on the script and stylesheet URLs means new HTML always pulls new
  JS and CSS, regardless of the browser's HTTP cache.
- A failed asset request never falls back to `index.html`. Serving HTML in place
  of `app.js` is what silently broke the app before.
- **Escape hatch:** `https://ross.asia/?fresh=1` wipes all caches and the service
  worker, then reloads clean. Use this if a device is ever stuck.
- The **Sync** button also checks for a new build and says either "You are on the
  latest version" or "New version found — updating…".
