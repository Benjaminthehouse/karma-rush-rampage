import { defineGame } from '../meta';

export default defineGame({
  id: 'maincharacter',
  title: 'Main Character',
  shout: 'GET IN THE SPOTLIGHT! POSE!',
  how: 'Red and blue step left and right. Green strikes a pose, but only in the light.',
  labels: ['LEFT', 'POSE', 'RIGHT'],
  duration: 8000,
  kind: 'react',
  think: 260,
});
