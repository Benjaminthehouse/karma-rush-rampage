import { defineGame } from '../meta';

export default defineGame({
  id: 'controversial',
  title: 'Sort By Controversial',
  shout: 'KEEP IT FIFTY FIFTY!',
  how: 'The crowd shoves the vote. Tap it back to the gold middle. ORDER! stuns the crowd.',
  labels: ['DOWNVOTE', 'ORDER!', 'UPVOTE'],
  duration: 8000,
  kind: 'timing',
  think: 0,
});
