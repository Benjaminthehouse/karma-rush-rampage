import { defineGame } from '../meta';

export default defineGame({
  id: 'stonks',
  title: 'Stonks',
  shout: 'HOLD WHAT’S GOING UP!',
  how: 'Hold the button under every rising ticker. Let go when it tops out.',
  labels: ['HOLD', 'HOLD', 'HOLD'],
  duration: 8000,
  kind: 'react',
  think: 300,
});
