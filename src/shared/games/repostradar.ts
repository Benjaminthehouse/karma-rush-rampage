import { defineGame } from '../meta';

export default defineGame({
  id: 'repostradar',
  title: 'Repost Radar',
  shout: 'SPOT THE REPOST!',
  how: 'One of the three new posts is already pinned on the wall. Tap that one.',
  labels: ['LEFT', 'MIDDLE', 'RIGHT'],
  duration: 8000,
  kind: 'brain',
  think: 700,
});
