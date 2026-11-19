import { defineGame } from '../meta';

export default defineGame({
  id: 'slashs',
  title: '/s',
  shout: 'OBEY! UNLESS IT SAYS /S!',
  say: 'obey! unless it says slash S!',
  how: '"Press red" means red. "Press red /s" is sarcasm: press anything but red.',
  labels: ['RED', 'GREEN', 'BLUE'],
  duration: 7000,
  kind: 'brain',
  think: 600,
});
