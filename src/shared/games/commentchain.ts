import { defineGame } from '../meta';

export default defineGame({
  id: 'commentchain',
  title: 'Comment Chain',
  shout: 'WATCH THE CHAIN! THEN REPEAT!',
  how: 'Replies light up in order. When it says your turn, play them back.',
  labels: ['RED', 'GREEN', 'BLUE'],
  duration: 8000,
  kind: 'memory',
  think: 300,
});
