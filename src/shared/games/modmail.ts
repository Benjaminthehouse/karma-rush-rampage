import { defineGame } from '../meta';

export default defineGame({
  id: 'modmail',
  title: 'Mod Mail',
  shout: 'ALTERNATE TO TYPE! GREEN SENDS!',
  how: 'Alternate red and blue to type your ban appeal, then hit green to send it.',
  labels: ['TYPE', 'SEND', 'TYPE'],
  duration: 8000,
  kind: 'mash',
  think: 0,
});
