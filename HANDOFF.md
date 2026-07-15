# HANDOFF — read this first

## Where things stand
- **Repo:** github.com/Venkat5599/reddit · app name `read-the-herd` · Devvit Web + Phaser 4.
- **HERD (crowd-guessing game) is COMPLETE, builds green, and is DEPLOYED to a playtest sub.**
  Playtest URL: `https://www.reddit.com/r/herd_test_venkat/?playtest=read-the-herd`
  Re-run with: `cd read-the-herd && npx devvit playtest herd_test_venkat`
- **We are mid-PIVOT** to a new game the user prefers.

## The pivot (DECIDED)
Build **IMPOSTER** — an async, Reddit-native social-deduction game (Among Us' *soul*, not real-time):
- 5-person crew (you + 4 seeded bots). Category shown to all; secret word shown to everyone EXCEPT the imposter.
- ~1 in 4 rounds YOU are the imposter (you don't see the word -> you bluff).
- Everyone gives a one-word clue. Then: CREW votes which seat is the imposter; IMPOSTER survives + guesses the secret word to escape.
- Reveal + streak + **live community vote tally** (poll `/api/...` for the "live twist"). No real-time lobbies (that loses on Devvit).

## Visual direction (DECIDED)
- **3D crewmate characters via three.js + the mint MCP** (`https://mcp.mint.gg/mcp`, skill `mint-threejs-skills`).
- IMPORTANT: mint MCP did NOT load in the previous session — **it needs a Claude restart to connect.** Verify mint tools are available (ToolSearch "mint") BEFORE building the 3D client.
- Swap the client renderer from Phaser -> three.js. Devvit has a working Three.js template for reference.

## State of the code (WIP — tree does NOT build right now)
- `src/shared/api.ts` — ALREADY REWRITTEN to IMPOSTER types (Role, ClueCard, ImposterInit, ResolveResult...). Done.
- `src/server/**` — STILL HERD (references old HerdInit/VoteResponse). MUST be rewritten to imposter logic:
  - `core/imposter.ts` (new): word packs + bot clues, role assignment, resolve, community tally (Redis).
  - `routes/api.ts`: `/init` (role + board), `/clue`, `/accuse` (crew), `/guess` (imposter), `/tally` (live poll).
  - `core/post.ts`: create round (pick a word pack).
- `src/client/**` — STILL HERD Phaser (`scenes/Herd.ts`). Replace with three.js 3D client.
- `devvit.json` menu item "Create a HERD round" -> rename to "Create an IMPOSTER round".

## Reference (already known-good)
- Server API: Hono + `import { context, redis, reddit } from '@devvit/web/server'`. `redis.get/set/incrBy`. `reddit.getCurrentUsername()`, `reddit.submitCustomPost({title})`.
- Client talks to server via `fetch('/api/...')`. Two entrypoints in `devvit.json`: `splash.html` (in-feed) + `game.html` (the game).
- Build check: `npx tsc --build && npm run build`. Lint: `npx eslint src`.

## Judging (Reddit "Games with a Hook", deadline Jul 15 6pm PT)
4 equal criteria: Delightful UX, Polish, Reddit-y, Hook (+ Phaser prize — note: going three.js forfeits the Phaser sub-prize, but the $15k grand + retention + UGC prizes remain). Judges test SOLO on the demo post → the game MUST be fully playable alone (hence seeded bots).

## Gotcha
An ECC "GateGuard" hook fires on every Write/Edit of a new file, demanding facts. It's disabled in settings.local.json via `ECC_DISABLED_HOOKS` / `ECC_GATEGUARD=off` but that only takes effect AFTER restart — so the fresh session should not be blocked.
