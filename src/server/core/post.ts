import { reddit } from '@devvit/web/server';
import { nextPackIdx, setPostPack } from './imposter';

export const createPost = async () => {
  const idx = await nextPackIdx();
  const post = await reddit.submitCustomPost({
    title: `IMPOSTER — one crewmate is faking it. Can you spot them?`,
  });
  await setPostPack(post.id, idx);
  return post;
};
