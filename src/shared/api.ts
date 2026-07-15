export type Prompt = { id: string; text: string; a: string; b: string };

export type HerdInit = {
  type: 'init';
  postId: string;
  username: string;
  prompt: Prompt;
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

export type VoteResponse = {
  type: 'vote';
  votesA: number;
  votesB: number;
  choice: 'a' | 'b';
  correct: boolean;
  streak: number;
  score: number;
  played: number;
  blackSheep: boolean;
};

export type SubmitPromptResponse = {
  type: 'submit';
  ok: boolean;
  message: string;
};
