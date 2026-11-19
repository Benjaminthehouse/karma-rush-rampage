import { defineGame } from '../meta';

export default defineGame({
  id: 'rant',
  title: 'The Rant',
  shout: 'TYPE THE RANT! FOLLOW THE COLOUR!',
  how: 'Mash the colour of the next words to type them. The colour keeps changing.',
  labels: ['TYPE', 'TYPE', 'TYPE'],
  duration: 8000,
  kind: 'mash',
  think: 250,
});
