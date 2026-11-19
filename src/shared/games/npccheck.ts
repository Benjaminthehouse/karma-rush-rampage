import { defineGame } from '../meta';

export default defineGame({
  id: 'npccheck',
  title: 'NPC Check',
  shout: 'TWO NPCS! SPOT THE PLAYER!',
  say: 'two en pee sees! spot the player!',
  how: 'NPCs move in perfect sync. Hit the colour of the one who is doing their own thing.',
  labels: ['RED GUY', 'GREEN GUY', 'BLUE GUY'],
  duration: 8000,
  kind: 'react',
  think: 520,
});
