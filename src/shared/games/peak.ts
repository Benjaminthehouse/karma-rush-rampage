import { defineGame } from '../meta';

export default defineGame({
  id: 'peak',
  title: 'Peak Hour',
  shout: 'POST IN THE COLOURED HOUR!',
  how: 'Tap the lit hour’s colour while the hand is inside it. A thin one counts double.',
  labels: ['RED', 'GREEN', 'BLUE'],
  duration: 8000,
  kind: 'timing',
  think: 0,
});
