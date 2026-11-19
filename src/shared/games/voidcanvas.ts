import { defineGame } from '../meta';

export default defineGame({
  id: 'voidcanvas',
  title: 'Hold The Canvas',
  shout: 'MATCH THE COLOUR! BEAT THE VOID!',
  how: 'Press the blinking pixel’s colour to repaint a column and shove the void back.',
  labels: ['RED', 'GREEN', 'BLUE'],
  duration: 7000,
  kind: 'react',
  think: 250,
});
