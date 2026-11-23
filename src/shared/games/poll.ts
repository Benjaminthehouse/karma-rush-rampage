import { defineGame } from '../meta';

export default defineGame({
  id: 'poll',
  title: 'Poll Results',
  shout: 'WHICH COLOUR WON?',
  how: 'One box of votes. Tap the colour there is the most of. Fast.',
  labels: ['RED', 'GREEN', 'BLUE'],
  duration: 8000,
  kind: 'brain',
  think: 1000,
});
