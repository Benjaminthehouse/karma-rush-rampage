import { defineGame } from '../meta';

export default defineGame({
  id: 'copypasta',
  title: 'Copypasta',
  shout: 'PASTE IT AGAIN!',
  how: 'Hit the colours in order, left to right.',
  labels: ['RED', 'GREEN', 'BLUE'],
  duration: 7000,
  kind: 'react',
  think: 240,
});
