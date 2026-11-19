import { defineGame } from '../meta';

export default defineGame({
  id: 'sortbynew',
  title: 'Sort By New',
  shout: 'TAP THE NEWEST POST!',
  how: 'Minutes beat hours, hours beat days. Find the freshest post.',
  labels: ['LEFT', 'MIDDLE', 'RIGHT'],
  duration: 8000,
  kind: 'brain',
  think: 800,
});
