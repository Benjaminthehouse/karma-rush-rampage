import { defineGame } from '../meta';

export default defineGame({
  id: 'firstcomment',
  title: 'First!',
  shout: 'WAIT... THEN COMMENT FIRST!',
  say: 'wait, then comment first!',
  how: 'When the post drops, hit its colour before anyone else. No jumping the gun.',
  labels: ['FIRST!', 'FIRST!', 'FIRST!'],
  duration: 8000,
  kind: 'react',
  think: 280,
});
