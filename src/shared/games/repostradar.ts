import { defineGame } from '../meta';

export default defineGame({
  id: 'repostradar',
  title: 'Repost Radar',
  shout: 'SPOT THE REPOST!',
  how: 'One of the three posts has been on screen before. Call it out.',
  labels: ['LEFT', 'MIDDLE', 'RIGHT'],
  duration: 8000,
  kind: 'memory',
  think: 650,
});
