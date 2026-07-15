import { redis } from '@devvit/web/server';
import type { Prompt } from '../../shared/api';

// Seed prompts. Players guess which option the CROWD majority picks.
export const SEED: Prompt[] = [
  { id: 'p001', text: 'Pineapple on pizza?', a: "Yes, it's great", b: "No, it's a crime" },
  { id: 'p002', text: 'Is a hot dog a sandwich?', a: 'Yes', b: 'No' },
  { id: 'p003', text: 'Toilet paper: over or under?', a: 'Over', b: 'Under' },
  { id: 'p004', text: 'Better superpower?', a: 'Flight', b: 'Invisibility' },
  { id: 'p005', text: 'Cereal or milk first?', a: 'Cereal first', b: 'Milk first' },
  { id: 'p006', text: 'Rewatch comfort shows or always new?', a: 'Rewatch', b: 'Always new' },
  { id: 'p007', text: 'Is cereal a soup?', a: 'Yes', b: 'No' },
  { id: 'p008', text: 'Window or aisle seat?', a: 'Window', b: 'Aisle' },
  { id: 'p009', text: 'One horse-sized duck or 100 duck-sized horses?', a: 'One big duck', b: '100 tiny horses' },
  { id: 'p010', text: 'Text or call?', a: 'Text', b: 'Call' },
  { id: 'p011', text: 'GIF: hard G or soft G?', a: 'Hard G (gift)', b: 'Soft G (jif)' },
  { id: 'p012', text: 'Too hot or too cold?', a: 'Too hot', b: 'Too cold' },
  { id: 'p013', text: 'Do ghosts exist?', a: 'Yes', b: 'No' },
  { id: 'p014', text: 'Is water wet?', a: 'Yes', b: 'No' },
  { id: 'p015', text: 'Pancakes or waffles?', a: 'Pancakes', b: 'Waffles' },
  { id: 'p016', text: 'Tip for takeout?', a: 'Yes', b: 'No' },
  { id: 'p017', text: 'Morning person or night owl?', a: 'Morning person', b: 'Night owl' },
  { id: 'p018', text: 'Weekend starts Friday or Saturday?', a: 'Friday', b: 'Saturday' },
  { id: 'p019', text: 'Read terms and conditions?', a: 'Always', b: 'Never' },
  { id: 'p020', text: 'Cat or dog?', a: 'Dog', b: 'Cat' },
];

const pk = (postId: string, s: string) => `herd:${postId}:${s}`;
const uk = (u: string, s: string) => `herd:user:${u}:${s}`;

// ~1 in 4 rounds is a "Black Sheep" twist: match the MINORITY.
function isBlackSheep(id: string): boolean {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 4 === 0;
}

/** Pick the next prompt for a new post: user-submitted pool first, else seed rotation. */
export async function nextPrompt(): Promise<Prompt> {
  const idx = await redis.incrBy('herd:global:idx', 1);
  const poolRaw = await redis.get('herd:pool');
  if (poolRaw) {
    try {
      const pool = JSON.parse(poolRaw) as Prompt[];
      if (pool.length > 0) return pool[(idx - 1) % pool.length]!;
    } catch {
      /* fall through to seed */
    }
  }
  return SEED[(idx - 1) % SEED.length]!;
}

export async function setPostPrompt(postId: string, prompt: Prompt): Promise<void> {
  await redis.set(pk(postId, 'prompt'), JSON.stringify(prompt));
}

export async function getPostPrompt(postId: string): Promise<Prompt> {
  const raw = await redis.get(pk(postId, 'prompt'));
  if (raw) {
    try {
      return JSON.parse(raw) as Prompt;
    } catch {
      /* fall through */
    }
  }
  const p = await nextPrompt();
  await setPostPrompt(postId, p);
  return p;
}

async function tallies(postId: string): Promise<{ a: number; b: number }> {
  const [a, b] = await Promise.all([
    redis.get(pk(postId, 'a')),
    redis.get(pk(postId, 'b')),
  ]);
  return { a: a ? parseInt(a) : 0, b: b ? parseInt(b) : 0 };
}

// A guess is "correct" if the guessed side is the current majority.
// Black Sheep round flips it: correct if guessed side is the MINORITY.
function isCorrect(choice: 'a' | 'b', a: number, b: number, black: boolean): boolean {
  if (a === b) return false; // exact tie never rewards
  const majority: 'a' | 'b' = a > b ? 'a' : 'b';
  const target = black ? (majority === 'a' ? 'b' : 'a') : majority;
  return choice === target;
}

export type State = {
  hasVoted: boolean;
  choice?: 'a' | 'b';
  votesA: number;
  votesB: number;
  correct?: boolean;
  streak: number;
  score: number;
  played: number;
  blackSheep: boolean;
};

export async function getState(postId: string, username: string): Promise<State> {
  const prompt = await getPostPrompt(postId);
  const black = isBlackSheep(prompt.id + postId);
  const [t, choiceRaw, streak, score, played] = await Promise.all([
    tallies(postId),
    redis.get(pk(postId, `voter:${username}`)),
    redis.get(uk(username, 'streak')),
    redis.get(uk(username, 'score')),
    redis.get(uk(username, 'played')),
  ]);
  const choice = (choiceRaw as 'a' | 'b' | null) ?? undefined;
  const s: State = {
    hasVoted: !!choice,
    choice,
    votesA: t.a,
    votesB: t.b,
    streak: streak ? parseInt(streak) : 0,
    score: score ? parseInt(score) : 1000,
    played: played ? parseInt(played) : 0,
    blackSheep: black,
  };
  if (choice) s.correct = isCorrect(choice, t.a, t.b, black);
  return s;
}

export async function castVote(
  postId: string,
  username: string,
  choice: 'a' | 'b'
): Promise<State> {
  const existing = await redis.get(pk(postId, `voter:${username}`));
  if (existing) return getState(postId, username); // one vote per user per post

  await redis.set(pk(postId, `voter:${username}`), choice);
  await redis.incrBy(pk(postId, choice), 1);

  const prompt = await getPostPrompt(postId);
  const black = isBlackSheep(prompt.id + postId);
  const t = await tallies(postId);
  const correct = isCorrect(choice, t.a, t.b, black);

  // Herd Sense (ELO-ish): +25 correct, -20 wrong; streak on correct.
  const prevScore = parseInt((await redis.get(uk(username, 'score'))) ?? '1000');
  const nextScore = Math.max(0, prevScore + (correct ? 25 : -20));
  await redis.set(uk(username, 'score'), String(nextScore));
  await redis.incrBy(uk(username, 'played'), 1);
  if (correct) {
    await redis.incrBy(uk(username, 'streak'), 1);
  } else {
    await redis.set(uk(username, 'streak'), '0');
  }

  return getState(postId, username);
}

/** Add a user-submitted prompt to the pool (used for future posts). */
export async function submitPrompt(text: string, a: string, b: string): Promise<void> {
  const poolRaw = await redis.get('herd:pool');
  let pool: Prompt[] = [];
  if (poolRaw) {
    try {
      pool = JSON.parse(poolRaw) as Prompt[];
    } catch {
      pool = [];
    }
  }
  pool.push({ id: `u${Date.now().toString(36)}`, text, a, b });
  await redis.set('herd:pool', JSON.stringify(pool.slice(-200)));
}
