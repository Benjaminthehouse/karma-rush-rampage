import { defineGame } from '../meta';

export default defineGame({
  id: 'tothemoon',
  title: 'To The Moon',
  shout: 'HOLD! RELEASE AT THE MOON!',
  how: 'Hold the lit rocket’s button to climb. Let go inside the gold zone.',
  labels: ['HOLD', 'HOLD', 'HOLD'],
  duration: 8000,
  kind: 'timing',
  think: 0,
});
