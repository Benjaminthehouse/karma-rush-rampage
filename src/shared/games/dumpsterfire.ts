import { defineGame } from '../meta';

export default defineGame({
  id: 'dumpsterfire',
  title: 'Dumpster Fire',
  shout: 'KEEP ALL THREE FIRES SMALL!',
  how: 'Each button hoses its own thread. You only score while all three are under the line.',
  labels: ['HOSE', 'HOSE', 'HOSE'],
  duration: 7000,
  kind: 'mash',
  think: 250,
});
