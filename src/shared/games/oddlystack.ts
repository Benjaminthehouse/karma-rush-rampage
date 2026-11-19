import { defineGame } from '../meta';

export default defineGame({
  id: 'oddlystack',
  title: 'Oddly Satisfying',
  shout: 'PRESS ITS COLOUR DEAD CENTRE!',
  how: 'Press the sliding slab’s colour to drop it flush on the tower.',
  labels: ['DROP', 'DROP', 'DROP'],
  duration: 8000,
  kind: 'timing',
  think: 0,
});
