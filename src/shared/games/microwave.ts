import { defineGame } from '../meta';

export default defineGame({
  id: 'microwave',
  title: 'Microwave Ninja',
  shout: 'OPEN THE MICROWAVE AT ONE!',
  how: 'Open the door’s colour on 0:01. If it hits zero, the beep wakes the whole house.',
  labels: ['OPEN', 'OPEN', 'OPEN'],
  duration: 8000,
  kind: 'timing',
  think: 0,
});
