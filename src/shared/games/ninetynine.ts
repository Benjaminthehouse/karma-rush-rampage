import { defineGame } from '../meta';

export default defineGame({
  id: 'ninetynine',
  title: 'Stuck At 99',
  shout: 'STOP EACH BAR AT 100!',
  say: 'stop each bar at one hundred!',
  how: 'Each button stops its own bar. Land right on 100 and never go over.',
  labels: ['INSTALL', 'BUILD', 'DEPLOY'],
  duration: 8000,
  kind: 'timing',
  think: 0,
});
