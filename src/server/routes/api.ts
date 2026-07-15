import { Hono } from 'hono';
import { context, reddit } from '@devvit/web/server';
import { getInit, resolve, tally } from '../core/imposter';
import type { ImposterInit, ResolveResponse, TallyResponse } from '../../shared/api';

type ErrorResponse = { status: 'error'; message: string };

export const api = new Hono();

api.get('/init', async (c) => {
  const { postId } = context;
  if (!postId) return c.json<ErrorResponse>({ status: 'error', message: 'postId missing' }, 400);
  try {
    const username = (await reddit.getCurrentUsername()) ?? 'anon';
    const init = await getInit(postId, username);
    return c.json<ImposterInit>(init);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'init failed';
    console.error('init error', error);
    return c.json<ErrorResponse>({ status: 'error', message: msg }, 400);
  }
});

api.post('/resolve', async (c) => {
  const { postId } = context;
  if (!postId) return c.json<ErrorResponse>({ status: 'error', message: 'postId missing' }, 400);
  try {
    const body = await c.req.json<{ accusation?: number; guess?: string }>();
    const username = (await reddit.getCurrentUsername()) ?? 'anon';
    const result = await resolve(postId, username, body.accusation, body.guess);
    return c.json<ResolveResponse>({ type: 'resolve', ...result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'resolve failed';
    console.error('resolve error', error);
    return c.json<ErrorResponse>({ status: 'error', message: msg }, 400);
  }
});

api.get('/tally', async (c) => {
  const { postId } = context;
  if (!postId) return c.json<ErrorResponse>({ status: 'error', message: 'postId missing' }, 400);
  try {
    const t = await tally(postId);
    return c.json<TallyResponse>({ type: 'tally', ...t });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'tally failed';
    return c.json<ErrorResponse>({ status: 'error', message: msg }, 400);
  }
});
