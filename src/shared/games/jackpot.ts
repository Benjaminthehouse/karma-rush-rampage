import { defineGame } from '../meta';

export default defineGame({
  id: 'jackpot',
  title: 'Karma Jackpot',
  shout: 'STOP EVERY REEL ON GOLD!',
  how: 'Each button stops its own reel. Catch the gold star on all three.',
  labels: ['STOP', 'STOP', 'STOP'],
  duration: 8000,
  kind: 'timing',
  think: 0,
});
