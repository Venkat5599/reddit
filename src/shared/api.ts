export type Role = 'crew' | 'imposter';

export type ClueCard = {
  name: string; // player/bot display name
  clue: string; // their one-word clue
  isYou: boolean;
};

// Sent on init: your role + the board of clues (bots pre-filled, you add yours).
export type ImposterInit = {
  type: 'init';
  postId: string;
  username: string;
  category: string; // shown to everyone
  word?: string; // shown only to CREW (undefined for imposter)
  role: Role;
  wordOptions: string[]; // 4 options the imposter picks from to escape
  bots: ClueCard[]; // 4 bot crewmates' clues
  imposterSeat: number; // index in the 5-seat lineup that is the imposter (for crew voting)
  hasPlayed: boolean;
  resolved?: ResolveResult;
  streak: number;
  crewWins: number;
  imposterWins: number;
  played: number;
  timerSeconds: number; // live-twist countdown length
};

export type ResolveResult = {
  won: boolean;
  role: Role;
  word: string; // revealed secret word
  imposterName: string; // who the imposter was
  yourAccusation?: number; // seat you accused (crew)
  yourGuess?: string; // word you guessed (imposter)
  streak: number;
  crewWins: number;
  imposterWins: number;
  played: number;
  tally: number[]; // live community accusation counts per seat
};

export type ResolveResponse = { type: 'resolve' } & ResolveResult;

export type SubmitPromptResponse = {
  type: 'submit';
  ok: boolean;
  message: string;
};
