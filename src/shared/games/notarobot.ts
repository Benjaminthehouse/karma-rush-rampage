import { defineGame } from '../meta';

export default defineGame({
  id: 'notarobot',
  title: 'Not A Robot',
  shout: 'TAP EVERY TRAFFIC LIGHT!',
  how: 'Hit each tile that shows a traffic light. Touch anything else and you fail the check.',
  labels: ['LEFT', 'MIDDLE', 'RIGHT'],
  duration: 8000,
  kind: 'react',
  think: 550,
});
