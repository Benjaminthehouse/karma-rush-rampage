import { defineGame } from '../meta';

export default defineGame({
  id: 'haikubot',
  title: 'Haiku Bot',
  shout: 'HAIKU! TAP FIVE, SEVEN, FIVE!',
  how: 'Tap red 5 times, then green 7, then blue 5. One tap too many wipes the line.',
  labels: ['TAP FIVE', 'TAP SEVEN', 'TAP FIVE'],
  duration: 8000,
  kind: 'mash',
  think: 300,
});
