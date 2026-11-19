import { defineGame } from '../meta';

export default defineGame({
  id: 'settleit',
  title: 'Settle It',
  shout: 'BEAT THEIR HAND!',
  how: 'The comment war ends with rock, paper, scissors. Throw the winner.',
  labels: ['ROCK', 'PAPER', 'SCISSORS'],
  duration: 7000,
  kind: 'brain',
  think: 560,
});
