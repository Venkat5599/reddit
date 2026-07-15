import { reddit } from '@devvit/web/server';
import { nextPrompt, setPostPrompt } from './herd';

export const createPost = async () => {
  const prompt = await nextPrompt();
  const post = await reddit.submitCustomPost({
    title: `HERD — ${prompt.text}`,
  });
  await setPostPrompt(post.id, prompt);
  return post;
};
