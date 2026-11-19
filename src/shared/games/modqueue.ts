import { defineGame } from '../meta';

export default defineGame({
  id: 'modqueue',
  title: 'Mod Queue',
  shout: 'CLEAR THE MOD QUEUE!',
  how: 'Remove the spam, approve the nice stuff, lock the fights.',
  labels: ['REMOVE', 'APPROVE', 'LOCK'],
  duration: 8000,
  kind: 'sort',
  think: 600,
});
