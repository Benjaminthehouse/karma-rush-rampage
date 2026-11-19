import { defineGame } from '../meta';

export default defineGame({
  id: 'peak',
  title: 'Peak Hour',
  shout: 'POST INSIDE THE COLOUR!',
  how: 'Press the named colour while the marker is inside it.',
  labels: ['RED', 'GREEN', 'BLUE'],
  duration: 8000,
  kind: 'timing',
  think: 0,
});
