import { defineGame } from '../meta';

export default defineGame({
  id: 'doomscroll',
  title: 'Doomscroll',
  shout: 'ROLL RED GREEN BLUE! REPEAT!',
  how: 'Drum the pads in the arrow’s direction. Scrolling past the gold post flips it.',
  labels: ['ROLL', 'ROLL', 'ROLL'],
  duration: 7000,
  kind: 'mash',
  think: 0,
});
