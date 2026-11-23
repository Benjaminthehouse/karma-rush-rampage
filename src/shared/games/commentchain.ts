import { defineGame } from '../meta';

export default defineGame({
  id: 'commentchain',
  title: 'Comment Chain',
  shout: 'WATCH THE CHAIN! THEN REPEAT!',
  how: 'The colours flash in order. Copy them. Each time you get it, the chain grows by one.',
  labels: ['RED', 'GREEN', 'BLUE'],
  duration: 8000,
  kind: 'memory',
  think: 250,
});
