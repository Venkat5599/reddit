# HERD — did you read the room? 🐑

A daily crowd-guessing game for Reddit. Every round shows one spicy either/or question.
**You don't pick what *you* like — you guess what the community will pick.** Guess the
majority right and your streak grows and your **Herd Sense** rating climbs. Then the
comments become the arena: "HOW did 60% pick pineapple?!"

## How to play

1. A question appears (e.g. *"Pineapple on pizza?"*).
2. Tap the side you think **most people** will choose.
3. Watch the herd stampede into two pens and reveal the split.
4. Match the majority → streak up, Herd Sense up. Miss → streak resets.
5. **Black Sheep rounds** flip it — match the *minority* to win.
6. Come back for the next round. Suggest your own questions with **＋ Suggest a question**.

## Why it hooks

- **Daily loop** — a new question every round, a streak you don't want to break.
- **Herd Sense** — an ELO-style score for how well you read your community.
- **User-generated** — players submit the questions, so it never runs out of content.
- **Comment-native** — the reveal is built to start arguments in the thread.

## Tech

Built on **Devvit Web** + **Phaser 4**.

- `src/client/scenes/Herd.ts` — Phaser game: vote to lock to sheep-stampede reveal to stats
- `src/client/splash.html` / `splash.ts` — in-feed launch screen
- `src/server/routes/api.ts` — `/api/init`, `/api/vote`, `/api/submit-prompt`
- `src/server/core/herd.ts` — Redis: prompt rotation, tallies, streaks, Herd Sense, UGC pool
- `src/server/core/post.ts` — creates a round post (mod menu to "Create a HERD round")

State lives in Redis: per-post vote tallies + one-vote-per-user, and per-user streak/score/played.

## Run it

```bash
npm install
npm run dev      # devvit playtest — installs to your test subreddit
```

Then, as a moderator, use the subreddit menu to **Create a HERD round** to post a question.

## Deploy

```bash
npm run deploy   # type-check + lint + upload
npm run launch   # deploy + publish
```
