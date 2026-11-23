import { defineGame } from '../meta';

export default defineGame({
  id: 'tothemoon',
  title: 'To The Moon',
  shout: 'THRUST UP! LAND ON THE MOON!',
  how: 'Mash red and blue to thrust. Tap green while the rocket is on the moon to land.',
  labels: ['THRUST', 'LAND', 'THRUST'],
  duration: 8000,
  kind: 'mash',
  think: 0,
});
