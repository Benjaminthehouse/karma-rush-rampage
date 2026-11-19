import { defineGame } from '../meta';

export default defineGame({
  id: 'dodge',
  title: 'Downvote Dodge',
  shout: 'CATCH UPVOTES! DODGE DOWNVOTES!',
  how: 'Jump lanes to grab the green arrows and avoid the purple ones.',
  labels: ['LEFT', 'MIDDLE', 'RIGHT'],
  duration: 8000,
  kind: 'timing',
  think: 450,
});
