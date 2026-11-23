import { defineGame } from '../meta';

export default defineGame({
  id: 'peak',
  title: 'Peak Hour',
  shout: 'POST INSIDE THE COLOUR!',
  how: 'Tap the slice’s colour while the hand is inside it. A thin slice counts double.',
  labels: ['RED', 'GREEN', 'BLUE'],
  duration: 8000,
  kind: 'timing',
  think: 0,
});
