import { defineGame } from '../meta';

export default defineGame({
  id: 'aitaverdict',
  title: 'AITA Court',
  shout: 'BLAME WHOEVER HAS HORNS!',
  how: 'Horns on red OP, on blue THEM, or on both? Rule on it. Halos walk free.',
  labels: ['OP', 'BOTH', 'THEM'],
  duration: 7000,
  kind: 'sort',
  think: 450,
});
