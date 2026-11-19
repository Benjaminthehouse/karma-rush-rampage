import { defineGame } from '../meta';

export default defineGame({
  id: 'upvote',
  title: 'Upvote Crisis',
  shout: 'MASH THE ARROW’S COLOUR!',
  how: 'Send every post to the front page. Wrong colour costs votes.',
  labels: ['UPVOTE', 'UPVOTE', 'UPVOTE'],
  duration: 7000,
  kind: 'mash',
  think: 250,
});
