import { defineGame } from '../meta';

export default defineGame({
  id: 'bananascale',
  title: 'Banana For Scale',
  shout: 'HOW MANY BANANAS TALL?',
  how: 'One banana for scale. Pick how many bananas tall the thing is.',
  labels: ['LOW', 'MID', 'HIGH'],
  duration: 8000,
  kind: 'brain',
  think: 850,
});
