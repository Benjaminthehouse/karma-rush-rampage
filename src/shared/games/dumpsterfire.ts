import { defineGame } from '../meta';

export default defineGame({
  id: 'dumpsterfire',
  title: 'Dumpster Fire',
  shout: 'HOSE DOWN THE FLAME WARS!',
  how: 'Each button hoses its own thread. Put fires out fast. Hosing a calm thread is mod abuse.',
  labels: ['HOSE', 'HOSE', 'HOSE'],
  duration: 7000,
  kind: 'mash',
  think: 330,
});
