import { defineGame } from '../meta';

export default defineGame({
  id: 'rugpull',
  title: 'Rug Pull',
  shout: 'SELL BEFORE IT CRASHES!',
  how: 'Each button sells its coin. Higher is richer, but a shaking coin is about to go.',
  labels: ['SELL', 'SELL', 'SELL'],
  duration: 8000,
  kind: 'timing',
  think: 0,
});
