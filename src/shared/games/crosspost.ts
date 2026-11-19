import { defineGame } from '../meta';

export default defineGame({
  id: 'crosspost',
  title: 'Crosspost',
  shout: 'PRESS BOTH LIT SUBS TOGETHER!',
  how: 'Lit communities want your post. Hit their buttons at the same moment.',
  labels: ['r/RED', 'r/GREEN', 'r/BLUE'],
  duration: 7000,
  kind: 'react',
  think: 480,
});
