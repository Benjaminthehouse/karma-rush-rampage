import { defineGame } from '../meta';

export default defineGame({
  id: 'ninetynine',
  title: 'Stuck At 99',
  shout: 'STOP EACH BAR ON GOLD!',
  how: 'Each button stops its own bar. Stop it on the gold, before it crashes.',
  labels: ['INSTALL', 'BUILD', 'DEPLOY'],
  duration: 8000,
  kind: 'timing',
  think: 0,
});
