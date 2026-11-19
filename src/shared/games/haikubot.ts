import { defineGame } from '../meta';

export default defineGame({
  id: 'haikubot',
  title: 'Haiku Bot',
  shout: 'HAIKU! TAP FIVE, SEVEN, FIVE!',
  how: 'Tap red 5 times, green 7, blue 5. One tap too many wipes the line.',
  labels: ['TAP 5', 'TAP 7', 'TAP 5'],
  duration: 8000,
  kind: 'mash',
  think: 300,
});
