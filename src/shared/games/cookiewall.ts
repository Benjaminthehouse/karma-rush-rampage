import { defineGame } from '../meta';

export default defineGame({
  id: 'cookiewall',
  title: 'Cookie Wall',
  shout: 'REJECT ALL THE COOKIES!',
  how: 'One button really rejects everything. The other two are traps.',
  labels: ['LEFT', 'MIDDLE', 'RIGHT'],
  duration: 8000,
  kind: 'sort',
  think: 850,
});
