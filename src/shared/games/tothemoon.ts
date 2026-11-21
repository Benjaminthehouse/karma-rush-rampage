import { defineGame } from '../meta';

export default defineGame({
  id: 'tothemoon',
  title: 'To The Moon',
  shout: 'HOLD! LET GO ON THE MOON!',
  how: 'Each button flies its own rocket. Hold to climb, let go when it is on its moon.',
  labels: ['HOLD', 'HOLD', 'HOLD'],
  duration: 8000,
  kind: 'timing',
  think: 0,
});
