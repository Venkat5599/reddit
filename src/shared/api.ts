export type Role = 'crew' | 'imposter';

export type Seat = {
  name: string; // color name, Among-Us style
  isYou: boolean;
  clue: string; // bot clue text; '' for your seat until you submit
};

// Sent on init. NOTE: for CREW we never send which seat is the imposter — real deduction.
export type ImposterInit = {
  type: 'init';
  postId: string;
  username: string;
  category: string; // shown to everyone
  word?: string; // shown only to CREW
  role: Role;
  wordOptions: string[]; // imposter picks the secret word from these to escape
  seats: Seat[]; // 5 seats (you + 4 bots)
  yourSeat: number; // index of your seat
  imposterSeat?: number; // only present when YOU are the imposter (it's your own seat)
  hasPlayed: boolean;
  resolved?: ResolveResult;
  streak: number;
  crewWins: number;
  imposterWins: number;
  played: number;
  timerSeconds: number;
};

export type ResolveResult = {
  won: boolean;
  role: Role;
  word: string; // revealed secret word
  imposterSeat: number; // revealed
  imposterName: string;
  yourAccusation?: number; // crew: seat you accused
  yourGuess?: string; // imposter: word you guessed
  streak: number;
  crewWins: number;
  imposterWins: number;
  played: number;
  catchRate: number; // % of community that caught the imposter
  sampleSize: number;
};

export type ResolveResponse = { type: 'resolve' } & ResolveResult;

export type TallyResponse = { type: 'tally'; catchRate: number; sampleSize: number };
