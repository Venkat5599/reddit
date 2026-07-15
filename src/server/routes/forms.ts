import { Hono } from 'hono';

// No custom forms in IMPOSTER — kept as an empty router so the server mounts cleanly.
export const forms = new Hono();
