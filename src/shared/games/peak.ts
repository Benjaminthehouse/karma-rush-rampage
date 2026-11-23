import { defineGame } from '../meta';

export default defineGame({
  id: 'peak',
  title: 'Peak Hour',
  shout: 'POST INSIDE THE COLOUR!',
  how: 'One colour lights up on the bar. Tap that colour while the arrow is inside it.',
  labels: ['RED', 'GREEN', 'BLUE'],
  duration: 8000,
  kind: 'timing',
  think: 0,
});
