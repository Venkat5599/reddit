import { redis } from '@devvit/web/server';
import type { ImposterInit, ResolveResult, Role, Seat } from '../../shared/api';

// ---- content ----
type Pack = {
  category: string;
  word: string;
  options: string[]; // 4 word options (must include word)
  crew: string[]; // clues a crewmate might give about `word`
  decoy: string[]; // subtly-off clues a bot imposter gives
};

export const PACKS: Pack[] = [
  {
    category: '🎬 Movies',
    word: 'Titanic',
    options: ['Titanic', 'Avatar', 'Jaws', 'Frozen'],
    crew: ['boat', 'iceberg', 'romance', 'sinking', 'jack', 'ocean', 'tragedy'],
    decoy: ['blue', 'water', 'cold', 'famous'],
  },
  {
    category: '🍔 Food',
    word: 'Pizza',
    options: ['Pizza', 'Burger', 'Sushi', 'Taco'],
    crew: ['cheese', 'slice', 'pepperoni', 'crust', 'italian', 'round', 'delivery'],
    decoy: ['hot', 'dinner', 'sauce', 'yummy'],
  },
  {
    category: '🐾 Animals',
    word: 'Penguin',
    options: ['Penguin', 'Dolphin', 'Tiger', 'Owl'],
    crew: ['tuxedo', 'antarctica', 'waddle', 'ice', 'flightless', 'fish', 'cold'],
    decoy: ['bird', 'black', 'cute', 'wild'],
  },
  {
    category: '⚽ Sports',
    word: 'Basketball',
    options: ['Basketball', 'Soccer', 'Tennis', 'Golf'],
    crew: ['hoop', 'dribble', 'dunk', 'court', 'orange', 'nba', 'bounce'],
    decoy: ['ball', 'team', 'score', 'game'],
  },
  {
    category: '🌍 Places',
    word: 'Paris',
    options: ['Paris', 'Tokyo', 'Cairo', 'Rome'],
    crew: ['eiffel', 'france', 'louvre', 'baguette', 'romantic', 'seine', 'tower'],
    decoy: ['city', 'travel', 'europe', 'busy'],
  },
  {
    category: '🎮 Games',
    word: 'Minecraft',
    options: ['Minecraft', 'Fortnite', 'Tetris', 'Pacman'],
    crew: ['blocks', 'creeper', 'mining', 'build', 'pixel', 'craft', 'survival'],
    decoy: ['fun', 'screen', 'online', 'play'],
  },
  {
    category: '🎵 Instruments',
    word: 'Guitar',
    options: ['Guitar', 'Piano', 'Drums', 'Violin'],
    crew: ['strings', 'strum', 'chord', 'acoustic', 'rock', 'frets', 'pick'],
    decoy: ['music', 'loud', 'band', 'sound'],
  },
  {
    category: '☕ Drinks',
    word: 'Coffee',
    options: ['Coffee', 'Tea', 'Soda', 'Juice'],
    crew: ['caffeine', 'espresso', 'beans', 'morning', 'latte', 'brew', 'bitter'],
    decoy: ['hot', 'cup', 'drink', 'awake'],
  },
  {
    category: '🌦️ Weather',
    word: 'Snow',
    options: ['Snow', 'Rain', 'Sunny', 'Fog'],
    crew: ['white', 'cold', 'flakes', 'winter', 'shovel', 'ski', 'freeze'],
    decoy: ['sky', 'wet', 'season', 'outside'],
  },
  {
    category: '💼 Jobs',
    word: 'Doctor',
    options: ['Doctor', 'Teacher', 'Chef', 'Pilot'],
    crew: ['hospital', 'stethoscope', 'patient', 'surgery', 'scrubs', 'heal', 'md'],
    decoy: ['work', 'smart', 'help', 'busy'],
  },
  {
    category: '🚗 Vehicles',
    word: 'Motorcycle',
    options: ['Motorcycle', 'Airplane', 'Boat', 'Bicycle'],
    crew: ['helmet', 'harley', 'two-wheels', 'engine', 'ride', 'leather', 'roar'],
    decoy: ['fast', 'road', 'travel', 'loud'],
  },
  {
    category: '🏰 Fantasy',
    word: 'Dragon',
    options: ['Dragon', 'Wizard', 'Knight', 'Elf'],
    crew: ['fire', 'wings', 'scales', 'hoard', 'lair', 'breathe', 'mythical'],
    decoy: ['big', 'story', 'magic', 'scary'],
  },
  {
    category: '🎃 Holidays',
    word: 'Halloween',
    options: ['Halloween', 'Christmas', 'Easter', 'Thanksgiving'],
    crew: ['costume', 'candy', 'spooky', 'pumpkin', 'october', 'ghost', 'trick'],
    decoy: ['party', 'fun', 'night', 'kids'],
  },
  {
    category: '📱 Tech',
    word: 'iPhone',
    options: ['iPhone', 'Laptop', 'Camera', 'TV'],
    crew: ['apple', 'app', 'screen', 'siri', 'facetime', 'pocket', 'expensive'],
    decoy: ['tech', 'device', 'popular', 'new'],
  },
];

const BOT_NAMES = ['Red', 'Blue', 'Lime', 'Pink', 'Cyan', 'Gold', 'Gray', 'Teal', 'Rose', 'Mint'];
const IMPOSTER_CHANCE = 0.25;
const TIMER_SECONDS = 20;

// deterministic RNG so a user's board is stable across reloads
function seeded(seedStr: string): () => number {
  let h = 2166136261;
  for (const ch of seedStr) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}
function shuffle<T>(rng: () => number, arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

// ---- redis keys ----
const gk = (postId: string, s: string) => `imp:${postId}:${s}`;
const uk = (u: string, s: string) => `imp:user:${u}:${s}`;
const stateKey = (postId: string, u: string) => gk(postId, `state:${u}`);

type Stored = {
  role: Role;
  packIdx: number;
  seats: Seat[];
  yourSeat: number;
  imposterSeat: number;
  resolved?: ResolveResult;
};

async function packForPost(postId: string): Promise<number> {
  const raw = await redis.get(gk(postId, 'pack'));
  if (raw) return parseInt(raw);
  const idx = (await redis.incrBy('imp:global:idx', 1)) % PACKS.length;
  await redis.set(gk(postId, 'pack'), String(idx));
  return idx;
}

export async function setPostPack(postId: string, idx: number): Promise<void> {
  await redis.set(gk(postId, 'pack'), String(idx));
}

export async function nextPackIdx(): Promise<number> {
  const idx = (await redis.incrBy('imp:global:idx', 1)) % PACKS.length;
  return idx;
}

async function userStats(u: string) {
  const [streak, cw, iw, played] = await Promise.all([
    redis.get(uk(u, 'streak')),
    redis.get(uk(u, 'crewWins')),
    redis.get(uk(u, 'imposterWins')),
    redis.get(uk(u, 'played')),
  ]);
  return {
    streak: streak ? parseInt(streak) : 0,
    crewWins: cw ? parseInt(cw) : 0,
    imposterWins: iw ? parseInt(iw) : 0,
    played: played ? parseInt(played) : 0,
  };
}

async function catchRate(postId: string): Promise<{ catchRate: number; sampleSize: number }> {
  const [caught, total] = await Promise.all([
    redis.get(gk(postId, 'crewCaught')),
    redis.get(gk(postId, 'crewTotal')),
  ]);
  const c = caught ? parseInt(caught) : 0;
  const t = total ? parseInt(total) : 0;
  return { catchRate: t > 0 ? Math.round((c / t) * 100) : 0, sampleSize: t };
}

export async function tally(postId: string) {
  return catchRate(postId);
}

function buildBoard(postId: string, username: string, packIdx: number): Stored {
  const pack = PACKS[packIdx]!;
  const rng = seeded(postId + '|' + username);
  const role: Role = rng() < IMPOSTER_CHANCE ? 'imposter' : 'crew';
  const names = shuffle(rng, BOT_NAMES).slice(0, 4);
  const yourSeat = Math.floor(rng() * 5);

  let imposterSeat: number;
  if (role === 'imposter') {
    imposterSeat = yourSeat;
  } else {
    const botSeats = [0, 1, 2, 3, 4].filter((i) => i !== yourSeat);
    imposterSeat = pick(rng, botSeats);
  }

  const crewClues = shuffle(rng, pack.crew);
  const decoyClues = shuffle(rng, pack.decoy);
  let ci = 0;
  let di = 0;
  const seats: Seat[] = [];
  let botName = 0;
  for (let i = 0; i < 5; i++) {
    if (i === yourSeat) {
      seats.push({ name: 'You', isYou: true, clue: '' });
    } else {
      const isImp = i === imposterSeat;
      const clue = isImp
        ? decoyClues[di++ % decoyClues.length]!
        : crewClues[ci++ % crewClues.length]!;
      seats.push({ name: names[botName++]!, isYou: false, clue });
    }
  }
  return { role, packIdx, seats, yourSeat, imposterSeat };
}

export async function getInit(postId: string, username: string): Promise<ImposterInit> {
  const packIdx = await packForPost(postId);
  const pack = PACKS[packIdx]!;
  let stored: Stored;
  const raw = await redis.get(stateKey(postId, username));
  if (raw) {
    stored = JSON.parse(raw) as Stored;
  } else {
    stored = buildBoard(postId, username, packIdx);
    await redis.set(stateKey(postId, username), JSON.stringify(stored));
  }
  const stats = await userStats(username);

  const init: ImposterInit = {
    type: 'init',
    postId,
    username,
    category: pack.category,
    role: stored.role,
    wordOptions: shuffle(seeded(postId + username + 'opt'), pack.options),
    seats: stored.seats,
    yourSeat: stored.yourSeat,
    hasPlayed: !!stored.resolved,
    streak: stats.streak,
    crewWins: stats.crewWins,
    imposterWins: stats.imposterWins,
    played: stats.played,
    timerSeconds: TIMER_SECONDS,
  };
  if (stored.role === 'crew') init.word = pack.word;
  else init.imposterSeat = stored.imposterSeat;
  if (stored.resolved) init.resolved = stored.resolved;
  return init;
}

export async function resolve(
  postId: string,
  username: string,
  accusation: number | undefined,
  guess: string | undefined
): Promise<ResolveResult> {
  const raw = await redis.get(stateKey(postId, username));
  if (!raw) throw new Error('no round state');
  const stored = JSON.parse(raw) as Stored;
  const pack = PACKS[stored.packIdx]!;

  if (stored.resolved) return stored.resolved; // idempotent

  let won: boolean;
  if (stored.role === 'crew') {
    won = accusation === stored.imposterSeat;
  } else {
    won = (guess ?? '').toLowerCase() === pack.word.toLowerCase();
  }

  await redis.incrBy(gk(postId, 'crewTotal'), 1);
  const crewCaught = stored.role === 'crew' ? won : !won;
  if (crewCaught) await redis.incrBy(gk(postId, 'crewCaught'), 1);

  const stats = await userStats(username);
  const newStreak = won ? stats.streak + 1 : 0;
  await redis.set(uk(username, 'streak'), String(newStreak));
  await redis.incrBy(uk(username, 'played'), 1);
  if (won && stored.role === 'crew') await redis.incrBy(uk(username, 'crewWins'), 1);
  if (won && stored.role === 'imposter') await redis.incrBy(uk(username, 'imposterWins'), 1);

  const cr = await catchRate(postId);
  const impName = stored.seats[stored.imposterSeat]!.name;
  const result: ResolveResult = {
    won,
    role: stored.role,
    word: pack.word,
    imposterSeat: stored.imposterSeat,
    imposterName: impName,
    streak: newStreak,
    crewWins: stats.crewWins + (won && stored.role === 'crew' ? 1 : 0),
    imposterWins: stats.imposterWins + (won && stored.role === 'imposter' ? 1 : 0),
    played: stats.played + 1,
    catchRate: cr.catchRate,
    sampleSize: cr.sampleSize,
  };
  if (accusation !== undefined) result.yourAccusation = accusation;
  if (guess !== undefined) result.yourGuess = guess;

  stored.resolved = result;
  await redis.set(stateKey(postId, username), JSON.stringify(stored));
  return result;
}
