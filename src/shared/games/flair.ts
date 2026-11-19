import { defineGame } from '../meta';

export default defineGame({
  id: 'flair',
  title: 'Flair Check',
  shout: 'READ THE RULE! TAG THE FLAIR!',
  how: 'The rule on screen says whether the word or its colour counts.',
  labels: ['RED', 'GREEN', 'BLUE'],
  duration: 7000,
  kind: 'brain',
  think: 520,
});
