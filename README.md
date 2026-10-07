# 🗾 Asia 2026 Family Challenge

Japan & South Korea — Ross Family, 16–31 October 2026.

A phone-first web game that turns the trip itinerary into a level map. Each stop
is a mission: take an arrival photo, complete your own scavenger-hunt photos,
beat one of three themed activity games, and clear a five-question boss quiz — then submit it for
approval. The admin login approves missions, awards bonus points and hands out
chips.

Built on the same engine as the Route 66 Family Challenge, re-themed for Japan
and Korea: white and Japanese-blue, with a neon skyline behind everything.

## Files
| File | What it is |
|---|---|
| `index.html` | App shell, login, mascot |
| `stops.js` | All 46 stops, in itinerary order — facts, 7 hunt items (5 per player), 3 games, 7 quiz questions (5 per player) |
| `games.js` | The 19 activity-game engines (packing, merge, match-3, climb, crossing, conveyor, spot-the-difference, path, pipes, lanterns, maze, pachinko, crane, throw, cooking, balance, archery, word search, sliding puzzle) |
| `hub.js` | The Games Zone's bigger games: Shinkansen Dash, Neon Invaders, Air Hockey (2-player), Neon Pool, Torii Sweeper, Sumo Smash (2-player), Sushi Slice, Taiko Beat, Chopstick Catch, Crossing Rush, Vending Frenzy, Gachapon Tower, Ninja Wall Jump |
| `translate.js` | Phrases tab: the show-the-waiter diet card, the phrasebook (tap to enlarge), live money converter |
| `daily.js` | Kimbap's daily challenge (+15 chips) and the walking leaderboard (steps synced via the player's character field) |
| `app.js` | Level pages, quiz, hunts, Games tab, den, admin, sync |
| `styles.css` | Neon Tokyo/Seoul theme |
| `service-worker.js` | Offline cache |

## Backend
Unchanged from the Route 66 build — same Google Apps Script `/exec` endpoint,
same spreadsheet, same admin password. Nothing to redeploy.

## Logins
Same as before: Jacob, Lily, Hannah, Ethan, admin — or type `test` with no
password to preview with every stop unlocked.

## Countdown lock
Until **16 Oct 2026, 12:00 noon UK time** the site shows only a countdown. This is the only time
in the game that is UK time — everything else is Japan time.
The **Admin** button under it takes the admin password and opens the full site on that device (it
remembers). The page itself stores only a salted PBKDF2 fingerprint of the password. The opening time
is `window.SITE_OPENS` near the top of `index.html`.

## Dates and unlocking
Every date runs on **Japan time** (UTC+9, the same as Korea) whatever the phone's clock says:
stop unlocks, Kimbap's daily challenge, steps, streaks. Each day's stops open on that day;
only stops on the **same** day go in order (the next one waits for the one before to be approved).

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
4. Check `https://ross.asia/version.json` a few minutes later. If it still shows
   the old build, look at the "pages build and deployment" run under Actions.
   During a GitHub outage a run can sit in "queued" for hours and refuse to be
   cancelled or re-run; pushing any further real commit starts a fresh run.

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
