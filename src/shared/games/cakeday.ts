import { defineGame } from '../meta';

export default defineGame({
  id: 'cakeday',
  title: 'Cake Day',
  shout: 'LIGHT CANDLES ON THE BEAT!',
  how: 'Hit each lane as its flame lands on the candle. Stray presses cost you.',
  labels: ['LEFT', 'MIDDLE', 'RIGHT'],
  duration: 8000,
  kind: 'timing',
  think: 0,
});
