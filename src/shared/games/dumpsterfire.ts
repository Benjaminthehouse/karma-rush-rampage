import { defineGame } from '../meta';

export default defineGame({
  id: 'dumpsterfire',
  title: 'Dumpster Fire',
  shout: 'HOSE DOWN THE FLAME WARS!',
  how: 'Each button hoses its own bin. Every fire out scores, more if fast. Never hose a calm one.',
  labels: ['HOSE', 'HOSE', 'HOSE'],
  duration: 7000,
  kind: 'mash',
  think: 330,
});
