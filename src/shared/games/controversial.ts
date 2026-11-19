import { defineGame } from '../meta';

export default defineGame({
  id: 'controversial',
  title: 'Sort By Controversial',
  shout: 'KEEP IT FIFTY FIFTY!',
  how: 'The crowd keeps shoving the vote. Tap it back into the gold zone.',
  labels: ['DOWNVOTE', 'FREEZE', 'UPVOTE'],
  duration: 8000,
  kind: 'timing',
  think: 0,
});
