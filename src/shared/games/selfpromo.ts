import { defineGame } from '../meta';

export default defineGame({
  id: 'selfpromo',
  title: 'Shameless Plug',
  shout: 'PLUG IN COLOUR! FREEZE FOR MODS!',
  how: 'Spam your app with the card’s colour while the mod naps. Stop when they look.',
  labels: ['POST', 'POST', 'POST'],
  duration: 8000,
  kind: 'mash',
  think: 250,
});
