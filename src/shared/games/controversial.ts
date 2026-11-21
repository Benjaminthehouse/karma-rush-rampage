import { defineGame } from '../meta';

export default defineGame({
  id: 'controversial',
  title: 'Sort By Controversial',
  shout: 'KEEP THEM FIFTY FIFTY!',
  how: 'Trolls keep downvoting. Tap a button to upvote its arrow. Keep all three in the gold.',
  labels: ['UPVOTE', 'UPVOTE', 'UPVOTE'],
  duration: 8000,
  kind: 'timing',
  think: 0,
});
