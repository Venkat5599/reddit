import { Hono } from 'hono';
import { context, reddit } from '@devvit/web/server';
import { getState, castVote, getPostPrompt, submitPrompt } from '../core/herd';
import type { HerdInit, VoteResponse, SubmitPromptResponse } from '../../shared/api';

type ErrorResponse = { status: 'error'; message: string };

export const api = new Hono();

api.get('/init', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>({ status: 'error', message: 'postId missing' }, 400);
  }
  try {
    const username = (await reddit.getCurrentUsername()) ?? 'anon';
    const [prompt, state] = await Promise.all([
      getPostPrompt(postId),
      getState(postId, username),
    ]);
    return c.json<HerdInit>({ type: 'init', postId, username, prompt, ...state });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'init failed';
    console.error('init error', error);
    return c.json<ErrorResponse>({ status: 'error', message: msg }, 400);
  }
});

api.post('/vote', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>({ status: 'error', message: 'postId missing' }, 400);
  }
  try {
    const body = await c.req.json<{ choice: 'a' | 'b' }>();
    if (body.choice !== 'a' && body.choice !== 'b') {
      return c.json<ErrorResponse>({ status: 'error', message: 'invalid choice' }, 400);
    }
    const username = (await reddit.getCurrentUsername()) ?? 'anon';
    const state = await castVote(postId, username, body.choice);
    return c.json<VoteResponse>({
      type: 'vote',
      votesA: state.votesA,
      votesB: state.votesB,
      choice: state.choice ?? body.choice,
      correct: state.correct ?? false,
      streak: state.streak,
      score: state.score,
      played: state.played,
      blackSheep: state.blackSheep,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'vote failed';
    console.error('vote error', error);
    return c.json<ErrorResponse>({ status: 'error', message: msg }, 400);
  }
});

api.post('/submit-prompt', async (c) => {
  try {
    const { text, optionA, optionB } = await c.req.json<{
      text?: string;
      optionA?: string;
      optionB?: string;
    }>();
    const t = (text ?? '').trim();
    const a = (optionA ?? '').trim();
    const b = (optionB ?? '').trim();
    if (!t || !a || !b) {
      return c.json<SubmitPromptResponse>({ type: 'submit', ok: false, message: 'Fill in all fields.' });
    }
    if (t.length > 80 || a.length > 30 || b.length > 30) {
      return c.json<SubmitPromptResponse>({ type: 'submit', ok: false, message: 'Keep it short.' });
    }
    await submitPrompt(t, a, b);
    return c.json<SubmitPromptResponse>({ type: 'submit', ok: true, message: 'Added to the herd!' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'submit failed';
    return c.json<SubmitPromptResponse>({ type: 'submit', ok: false, message: msg });
  }
});
