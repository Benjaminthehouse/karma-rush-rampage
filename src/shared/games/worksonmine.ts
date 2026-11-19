import { defineGame } from '../meta';

export default defineGame({
  id: 'worksonmine',
  title: 'Works On My Machine',
  shout: 'FOLLOW THE WORKING LAPTOP!',
  how: 'One laptop works. Watch the shuffle, then pick where it ended up.',
  labels: ['LEFT', 'MIDDLE', 'RIGHT'],
  duration: 8000,
  kind: 'memory',
  think: 400,
});
