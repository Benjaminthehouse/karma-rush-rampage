import { defineGame } from '../meta';

export default defineGame({
  id: 'votemath',
  title: 'Vote Math',
  shout: 'UPVOTES MINUS DOWNVOTES! PICK TOP!',
  how: 'Three posts, three scores to work out. Tap the one that is really winning.',
  labels: ['LEFT', 'MIDDLE', 'RIGHT'],
  duration: 8000,
  kind: 'brain',
  think: 1150,
});
