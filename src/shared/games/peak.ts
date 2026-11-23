import { defineGame } from '../meta';

export default defineGame({
  id: 'peak',
  title: 'Peak Hour',
  shout: 'POST INSIDE THE COLOUR!',
  how: 'A slice of the clock lights up. Tap its colour while the hand is inside it.',
  labels: ['RED', 'GREEN', 'BLUE'],
  duration: 8000,
  kind: 'timing',
  think: 0,
});
