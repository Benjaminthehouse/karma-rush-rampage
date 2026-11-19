import { defineGame } from '../meta';

export default defineGame({
  id: 'deepfry',
  title: 'Deep Fryer',
  shout: 'MASH! DEEP FRY THE MEME!',
  how: 'Each button cranks its own dial. Max all three to fry the meme to a crisp.',
  labels: ['COLOUR', 'CRUNCH', 'GLOW'],
  duration: 7000,
  kind: 'mash',
  think: 0,
  mashable: true,
});
