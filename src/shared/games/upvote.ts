import { defineGame } from '../meta';

export default defineGame({
  id: 'upvote',
  title: 'Upvote Crisis',
  shout: 'MASH THE ARROW’S COLOUR!',
  how: 'Pump the post up to the front page. The wrong colour drags it down.',
  labels: ['UPVOTE', 'UPVOTE', 'UPVOTE'],
  duration: 7000,
  kind: 'mash',
  think: 250,
});
