import { defineGame } from '../meta';

export default defineGame({
  id: 'anypercent',
  title: 'Any% Run',
  shout: 'RED BLUE RUN! GREEN JUMPS!',
  how: 'Alternate red and blue to sprint. Tap green on the green pad to hop the spike.',
  labels: ['RED SHOE', 'JUMP', 'BLUE SHOE'],
  duration: 7000,
  kind: 'mash',
  think: 0,
});
