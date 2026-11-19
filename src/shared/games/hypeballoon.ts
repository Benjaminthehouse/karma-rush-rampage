import { defineGame } from '../meta';

export default defineGame({
  id: 'hypeballoon',
  title: 'Hype Balloon',
  shout: 'HOLD TO PUMP! DON’T POP!',
  how: 'Hold the balloon’s colour to pump up the launch. Let go just before the pop line.',
  labels: ['HOLD', 'HOLD', 'HOLD'],
  duration: 8000,
  kind: 'timing',
  think: 0,
});
