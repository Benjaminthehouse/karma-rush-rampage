import { defineGame } from '../meta';

export default defineGame({
  id: 'popuppanic',
  title: 'Pop-Up Panic',
  shout: 'CLOSE EVERY POP-UP AD!',
  how: 'Hit the button under every ad. Hands off your unsaved essay!',
  labels: ['CLOSE', 'CLOSE', 'CLOSE'],
  duration: 7000,
  kind: 'react',
  think: 400,
});
