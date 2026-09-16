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
Settings → Pages → Deploy from a branch → `main` / root.
