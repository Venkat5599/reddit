import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { submitPrompt } from '../core/herd';

type PromptFormValues = {
  text?: string;
  optionA?: string;
  optionB?: string;
};

export const forms = new Hono();

forms.post('/submit-prompt', async (c) => {
  const { text, optionA, optionB } = await c.req.json<PromptFormValues>();
  const t = (text ?? '').trim();
  const a = (optionA ?? '').trim();
  const b = (optionB ?? '').trim();

  if (!t || !a || !b) {
    return c.json<UiResponse>({ showToast: 'Fill in the question and both options.' }, 200);
  }
  if (t.length > 80 || a.length > 30 || b.length > 30) {
    return c.json<UiResponse>({ showToast: 'Too long — keep it short and punchy.' }, 200);
  }

  await submitPrompt(t, a, b);
  return c.json<UiResponse>(
    { showToast: '🐑 Added to the herd! It may appear in a future round.' },
    200
  );
});
