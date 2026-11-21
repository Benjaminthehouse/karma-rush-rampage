import { defineGame } from '../meta';

export default defineGame({
  id: 'tothemoon',
  title: 'To The Moon',
  shout: 'HOLD! LET GO ON THE MOON!',
  how: 'Hold the lit rocket’s button to fly it up. Let go when the rocket is on the moon.',
  labels: ['HOLD', 'HOLD', 'HOLD'],
  duration: 8000,
  kind: 'timing',
  think: 0,
});
