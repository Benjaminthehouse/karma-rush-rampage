import { defineGame } from '../meta';

export default defineGame({
  id: 'poll',
  title: 'Poll Results',
  shout: 'WHICH COLOUR WON?',
  how: 'Call the colour with the most votes. Fast.',
  labels: ['RED', 'GREEN', 'BLUE'],
  duration: 8000,
  kind: 'brain',
  think: 1000,
});
