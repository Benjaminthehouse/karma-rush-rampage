import { defineGame } from '../meta';

export default defineGame({
  id: 'anypercent',
  title: 'Any% Run',
  shout: 'RED BLUE RUN! GREEN JUMPS!',
  how: 'Alternate red and blue to sprint. Tap green on the glowing pad to hop the spikes.',
  labels: ['LEFT LEG', 'JUMP', 'RIGHT LEG'],
  duration: 7000,
  kind: 'mash',
  think: 0,
});
